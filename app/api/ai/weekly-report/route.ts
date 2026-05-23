import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getAuthedUser, getSupabaseAdmin } from '@/lib/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const supabaseAdmin = getSupabaseAdmin()
  const { data: trades, error: tradesError } = await supabaseAdmin
    .from('trades')
    .select('symbol, direction, entry_price, exit_price, quantity, pnl, emotion, rationale, notes, date')
    .eq('user_id', user.id)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: true })

  if (tradesError) return NextResponse.json({ error: tradesError.message }, { status: 500 })
  if (!trades?.length) return NextResponse.json({ report: '최근 7일 동안 분석할 거래가 없습니다.' })

  const prompt = `Create a concise Korean weekly trading report from these trades.
Include:
- weekly performance summary
- strongest pattern
- biggest risk
- 3 practical actions for next week

Trades:
${JSON.stringify(trades).slice(0, 18000)}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })

  const report = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ report })
}
