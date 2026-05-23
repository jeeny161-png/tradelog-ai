import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Mt5Payload = {
  api_key?: string
  ticket?: string | number
  symbol?: string
  direction?: 'L' | 'S' | 'BUY' | 'SELL' | 'buy' | 'sell'
  type?: string
  entry_price?: number
  exit_price?: number
  volume?: number
  quantity?: number
  profit?: number
  pnl?: number
  time?: string
  rationale?: string
  notes?: string
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null) as Mt5Payload | null
  if (!payload?.api_key) return NextResponse.json({ error: 'api_key is required.' }, { status: 401 })

  const supabaseAdmin = getSupabaseAdmin()
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, plan, ai_credits')
    .eq('mt5_api_key', payload.api_key)
    .single()

  if (profileError || !profile) return NextResponse.json({ error: 'Invalid API key.' }, { status: 401 })

  const direction = normalizeDirection(payload.direction || payload.type)
  const trade = {
    user_id: profile.id,
    symbol: payload.symbol || 'UNKNOWN',
    direction,
    entry_price: Number(payload.entry_price ?? payload.exit_price ?? 0),
    exit_price: Number(payload.exit_price ?? payload.entry_price ?? 0),
    quantity: Number(payload.quantity ?? payload.volume ?? 1),
    pnl: Number(payload.pnl ?? payload.profit ?? 0),
    emotion: 'Calm',
    rationale: payload.rationale || 'MT5 EA auto-sync',
    notes: payload.notes || '',
    date: toDate(payload.time),
    mt5_ticket: payload.ticket ? String(payload.ticket) : null,
    mt5_raw: payload,
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('trades')
    .upsert(trade, { onConflict: 'mt5_ticket' })
    .select('*')
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  let aiText = ''
  if (profile.plan === 'pro' || (profile.ai_credits ?? 0) > 0) {
    aiText = await analyzeTrade(inserted).catch(() => '')
    if (aiText) {
      await supabaseAdmin.from('trades').update({ notes: aiText }).eq('id', inserted.id)
      if (profile.plan !== 'pro') {
        await supabaseAdmin.from('profiles').update({ ai_credits: Math.max(0, (profile.ai_credits ?? 1) - 1) }).eq('id', profile.id)
      }
    }
  }

  return NextResponse.json({ ok: true, trade_id: inserted.id, ai_analysis: aiText })
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'TradeLog AI MT5 bridge' })
}

function normalizeDirection(value?: string) {
  const text = (value || '').toLowerCase()
  return text.includes('sell') || text === 's' || text === 'short' ? 'S' : 'L'
}

function toDate(value?: string) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

async function analyzeTrade(trade: Record<string, unknown>) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 700,
    messages: [{
      role: 'user',
      content: `Analyze this MT5-synced trade briefly in Korean. Include summary, mistake/risk, and next action. ${JSON.stringify(trade)}`,
    }],
  })
  return message.content[0].type === 'text' ? message.content[0].text : ''
}
