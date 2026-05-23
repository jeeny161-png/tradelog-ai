import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)

type Profile = {
  id: string
}

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin()
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('plan', 'pro')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Array<{ userId: string; sent: boolean; reason?: string }> = []

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
  const emailById = new Map((authUsers.users || []).map((user) => [user.id, user.email]))

  for (const profile of (profiles || []) as Profile[]) {
    const email = emailById.get(profile.id)
    if (!email) {
      results.push({ userId: profile.id, sent: false, reason: 'No email on profile.' })
      continue
    }

    const { data: trades } = await supabaseAdmin
      .from('trades')
      .select('symbol, direction, pnl, emotion, rationale, notes, date')
      .eq('user_id', profile.id)
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: true })

    if (!trades?.length) {
      results.push({ userId: profile.id, sent: false, reason: 'No trades this week.' })
      continue
    }

    const summary = await createSummary(trades)
    await resend.emails.send({
      from: 'TradeLog AI <onboarding@resend.dev>',
      to: email,
      subject: 'Your weekly TradeLog AI report',
      html: weeklyTemplate(summary, trades.length),
    })

    results.push({ userId: profile.id, sent: true })
  }

  return NextResponse.json({ ok: true, results })
}

async function createSummary(trades: unknown[]) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Create a concise weekly trading report with sections: Summary, Strengths, Risks, Next Week Focus. Trades: ${JSON.stringify(trades).slice(0, 15000)}`,
    }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : 'No summary generated.'
}

function weeklyTemplate(summary: string, count: number) {
  return `
    <div style="font-family:Arial,sans-serif;background:#0f1117;color:#e5e7eb;padding:24px">
      <div style="max-width:640px;margin:auto;background:#1a1f2e;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:24px">
        <h1 style="margin:0 0 8px;color:#f59e0b">TradeLog AI Weekly Report</h1>
        <p style="color:#94a3b8;margin:0 0 20px">${count} trades reviewed from the last 7 days.</p>
        <div style="white-space:pre-line;line-height:1.6">${escapeHtml(summary)}</div>
      </div>
    </div>
  `
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
