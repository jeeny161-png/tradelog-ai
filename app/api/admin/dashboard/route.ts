import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { getAuthedUser, getSupabaseAdmin } from '@/lib/server'

const ADMIN_EMAIL = 'jeeny161@gmail.com'
const resend = new Resend(process.env.RESEND_API_KEY)

type TradeRow = {
  user_id: string
  pnl: number
  date: string
  created_at?: string | null
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req)
  if (admin) return admin

  const supabaseAdmin = getSupabaseAdmin()
  const [{ data: profiles }, { data: trades }, authUsers] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, plan, ai_credits, ranking_opt_in, created_at'),
    supabaseAdmin.from('trades').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.auth.admin.listUsers(),
  ])

  const users = authUsers.data.users.map((user) => {
    const profile = (profiles || []).find((item) => item.id === user.id)
    const userTrades = (trades || []).filter((trade) => trade.user_id === user.id)
    const lastTrade = userTrades[0]
    return {
      id: user.id,
      email: user.email || '',
      joinDate: user.created_at,
      plan: profile?.plan || 'free',
      totalTrades: userTrades.length,
      lastActive: lastTrade?.created_at || user.last_sign_in_at || user.created_at,
    }
  })

  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startWeek = new Date(startToday)
  startWeek.setDate(startWeek.getDate() - 7)
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const tradeRows = (trades || []) as TradeRow[]
  const aiProxy = (rows: TradeRow[]) => rows.filter((trade) => trade.created_at && Number(trade.pnl) !== 0).length
  const signups = buildSignupChart(authUsers.data.users.map((user) => user.created_at))

  return NextResponse.json({
    users,
    stats: {
      totalUsers: users.length,
      totalTrades: tradeRows.length,
      aiToday: aiProxy(tradeRows.filter((trade) => new Date(trade.created_at || trade.date) >= startToday)),
      aiWeek: aiProxy(tradeRows.filter((trade) => new Date(trade.created_at || trade.date) >= startWeek)),
      aiMonth: aiProxy(tradeRows.filter((trade) => new Date(trade.created_at || trade.date) >= startMonth)),
      signups,
    },
  })
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req)
  if (admin) return admin

  const body = await req.json().catch(() => ({}))
  const action = body.action as string
  const userId = body.userId as string | undefined
  const supabaseAdmin = getSupabaseAdmin()

  if (action === 'user-trades' && userId) {
    const { data, error } = await supabaseAdmin
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ trades: data || [] })
  }

  if (action === 'upgrade-pro' && userId) {
    const { error } = await supabaseAdmin.from('profiles').upsert({ id: userId, plan: 'pro' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete-user' && userId) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'send-email' && body.email) {
    const subject = body.subject || 'TradeLog AI message'
    const message = body.message || ''
    const result = await resend.emails.send({
      from: 'TradeLog AI <onboarding@resend.dev>',
      to: body.email,
      subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6">${escapeHtml(message).replaceAll('\n', '<br/>')}</div>`,
    })
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid admin action.' }, { status: 400 })
}

async function requireAdmin(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })
  if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin access only.' }, { status: 403 })
  return null
}

function buildSignupChart(dates: string[]) {
  const labels = Array.from({ length: 30 }, (_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - (29 - index))
    return day.toISOString().slice(0, 10)
  })

  return labels.map((date) => ({
    date,
    count: dates.filter((value) => value?.slice(0, 10) === date).length,
  }))
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
