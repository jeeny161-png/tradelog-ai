import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getAuthedUser, getSupabaseAdmin } from '@/lib/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Trade = {
  symbol: string
  direction: 'L' | 'S'
  pnl: number
  emotion: string | null
  date: string
  created_at?: string | null
}

export async function POST(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })

  const supabaseAdmin = getSupabaseAdmin()
  const { data: trades, error: tradeError } = await supabaseAdmin
    .from('trades')
    .select('symbol, direction, pnl, emotion, date, created_at')
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  if (tradeError) return NextResponse.json({ error: tradeError.message }, { status: 500 })
  if (!trades?.length) return NextResponse.json({ insights: [], summary: 'No trades to analyze yet.' })

  const localStats = buildLocalStats(trades as Trade[])
  const prompt = `Analyze this trader's journal patterns by time of day, weekday, emotion, and symbol.
Return concise JSON only:
{"summary":"...","insights":[{"title":"Best trading time","value":"...","detail":"..."},{"title":"Worst emotion","value":"...","detail":"..."},{"title":"Strongest day","value":"...","detail":"..."}]}

Local computed stats:
${JSON.stringify(localStats)}

Trades:
${JSON.stringify(trades).slice(0, 18000)}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    return NextResponse.json(JSON.parse(text))
  } catch {
    return NextResponse.json({ summary: text, insights: fallbackInsights(localStats) })
  }
}

function buildLocalStats(trades: Trade[]) {
  return {
    bySymbol: groupStats(trades, (trade) => trade.symbol || 'Unknown'),
    byEmotion: groupStats(trades, (trade) => trade.emotion || 'Unknown'),
    byDay: groupStats(trades, (trade) => new Date(trade.date).toLocaleDateString('en-US', { weekday: 'long' })),
    bySession: groupStats(trades, (trade) => {
      const hour = new Date(trade.created_at || trade.date).getHours()
      if (hour >= 8 && hour < 12) return 'London session (08:00-12:00)'
      if (hour >= 13 && hour < 17) return 'New York session (13:00-17:00)'
      if (hour >= 0 && hour < 8) return 'Asia session (00:00-08:00)'
      return 'Late session (17:00-24:00)'
    }),
  }
}

function groupStats(trades: Trade[], getKey: (trade: Trade) => string) {
  const stats = new Map<string, { trades: number; wins: number; pnl: number }>()
  for (const trade of trades) {
    const key = getKey(trade)
    const current = stats.get(key) || { trades: 0, wins: 0, pnl: 0 }
    current.trades += 1
    current.wins += Number(trade.pnl) > 0 ? 1 : 0
    current.pnl += Number(trade.pnl) || 0
    stats.set(key, current)
  }
  return [...stats.entries()].map(([key, value]) => ({
    key,
    ...value,
    winRate: value.trades ? Math.round((value.wins / value.trades) * 100) : 0,
  }))
}

function fallbackInsights(stats: ReturnType<typeof buildLocalStats>) {
  const bestDay = [...stats.byDay].sort((a, b) => b.winRate - a.winRate)[0]
  const worstEmotion = [...stats.byEmotion].sort((a, b) => a.winRate - b.winRate)[0]
  const bestSession = [...stats.bySession].sort((a, b) => b.pnl - a.pnl)[0]
  return [
    { title: 'Best trading time', value: bestSession?.key || '-', detail: `${bestSession?.pnl ?? 0} PnL` },
    { title: 'Worst emotion', value: worstEmotion?.key || '-', detail: `${worstEmotion?.winRate ?? 0}% win rate` },
    { title: 'Strongest day', value: bestDay?.key || '-', detail: `${bestDay?.winRate ?? 0}% win rate` },
  ]
}
