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
  deal_entry?: string
  entry_type?: string
  entry_price?: number
  exit_price?: number
  volume?: number
  quantity?: number
  profit?: number
  swap?: number
  commission?: number
  pnl?: number
  time?: string
  rationale?: string
  notes?: string
}

const recentTickets = new Map<string, number>()
const TICKET_RATE_LIMIT_MS = 60_000

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json.' }, { status: 415 })
  }

  const payload = await req.json().catch(() => null) as Mt5Payload | null
  if (!payload) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  if (!payload?.api_key) return NextResponse.json({ error: 'api_key is required.' }, { status: 401 })

  if (!isClosingDeal(payload)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Only DEAL_ENTRY_OUT closing deals are processed.' })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, plan, ai_credits')
    .eq('mt5_api_key', payload.api_key)
    .single()

  if (profileError || !profile) return NextResponse.json({ error: 'Invalid API key.' }, { status: 401 })

  const mt5Ticket = payload.ticket ? String(payload.ticket) : ''
  if (mt5Ticket) {
    const now = Date.now()
    const lastSeen = recentTickets.get(mt5Ticket) || 0
    if (now - lastSeen < TICKET_RATE_LIMIT_MS) {
      return NextResponse.json({ ok: true, skipped: true, duplicate: true, reason: 'Ticket already received recently.' })
    }
    recentTickets.set(mt5Ticket, now)

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('trades')
      .select('id')
      .eq('mt5_ticket', mt5Ticket)
      .maybeSingle()

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
    if (existing?.id) {
      return NextResponse.json({ ok: true, skipped: true, duplicate: true, trade_id: existing.id })
    }
  }

  const direction = normalizeDirection(payload.direction || payload.type)
  const grossPnl = Number(payload.profit ?? payload.pnl ?? 0)
  const swap = Number(payload.swap ?? 0)
  const commission = Number(payload.commission ?? 0)
  const netPnl = grossPnl + swap + commission
  const trade = {
    user_id: profile.id,
    symbol: payload.symbol || 'UNKNOWN',
    direction,
    entry_price: Number(payload.entry_price ?? payload.exit_price ?? 0),
    exit_price: Number(payload.exit_price ?? payload.entry_price ?? 0),
    quantity: Number(payload.quantity ?? payload.volume ?? 1),
    pnl: netPnl,
    gross_pnl: grossPnl,
    swap,
    commission,
    emotion: 'Calm',
    rationale: payload.rationale || 'MT5 EA auto-sync',
    notes: payload.notes || '',
    date: toDate(payload.time),
    mt5_ticket: mt5Ticket || null,
    mt5_raw: payload,
  }

  const { inserted, error: insertError } = await saveMt5Trade(trade)
  if (insertError || !inserted) {
    if (mt5Ticket) recentTickets.delete(mt5Ticket)
    return NextResponse.json({ error: insertError?.message || 'Failed to save MT5 trade.' }, { status: 500 })
  }

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

function isClosingDeal(payload: Mt5Payload) {
  const entry = String(payload.deal_entry ?? payload.entry_type ?? '').toUpperCase()
  if (!entry) return true
  return entry === 'DEAL_ENTRY_OUT' || entry === 'OUT' || entry === 'CLOSE' || entry === 'CLOSING'
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

async function saveMt5Trade(trade: Record<string, unknown>) {
  const supabaseAdmin = getSupabaseAdmin()
  const result = await supabaseAdmin
    .from('trades')
    .insert(trade)
    .select('*')
    .single()

  if (!isMissingColumnError(result.error)) return { inserted: result.data, error: result.error }

  const fallbackTrade = { ...trade }
  delete fallbackTrade.gross_pnl
  delete fallbackTrade.swap
  delete fallbackTrade.commission

  const { data, error } = await supabaseAdmin
    .from('trades')
    .insert(fallbackTrade)
    .select('*')
    .single()
  return { inserted: data, error }
}

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return error.code === 'PGRST204' || /gross_pnl|swap|commission|schema cache|column/i.test(error.message || '')
}
