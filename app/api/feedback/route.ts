import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { getAuthedUser, getSupabaseAdmin } from '@/lib/server'

const ADMIN_EMAIL = 'jeeny161@gmail.com'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const CATEGORY_LABELS: Record<string, string> = {
  '버그 신고': '🐛 버그 신고',
  '기능 제안': '💡 기능 제안',
  '칭찬': '🎉 칭찬',
  '기타': '📝 기타',
}

export async function POST(req: Request) {
  const { user } = await getAuthedUser(req)

  const body = await req.json().catch(() => ({}))
  const { category = '기타', message = '', rating } = body as {
    category?: string
    message?: string
    rating?: number | null
  }

  if (!message.trim()) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  const { error } = await supabaseAdmin.from('feedback').insert({
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    category,
    message: message.trim(),
    rating: rating ?? null,
  })

  if (error) {
    console.error('[feedback] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Email notification to admin (fire-and-forget)
  const stars = rating ? '⭐'.repeat(rating) + '☆'.repeat(5 - rating) : '없음'
  const categoryLabel = CATEGORY_LABELS[category] ?? category
  const resend = getResend()
  resend.emails
    .send({
      from: 'TradeLog AI <onboarding@resend.dev>',
      to: ADMIN_EMAIL,
      subject: `[TradeLog AI 피드백] ${categoryLabel} - ${user?.email ?? '익명'}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.7;color:#1e293b">
          <h2 style="color:#f59e0b;margin-bottom:4px">TradeLog AI 피드백</h2>
          <p style="color:#64748b;margin-top:0;font-size:14px">${new Date().toLocaleString('ko-KR')}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;width:100px">유저</td><td style="padding:8px 12px">${user?.email ?? '익명'}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">카테고리</td><td style="padding:8px 12px">${categoryLabel}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600">별점</td><td style="padding:8px 12px">${stars}</td></tr>
          </table>
          <div style="background:#f1f5f9;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;white-space:pre-wrap;font-size:15px">${message.trim()}</div>
        </div>
      `,
    })
    .catch((err) => console.error('[feedback] email error:', err))

  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })
  if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only.' }, { status: 403 })

  const supabaseAdmin = getSupabaseAdmin()
  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const resolved = url.searchParams.get('resolved')

  let query = supabaseAdmin
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (category && category !== 'all') query = query.eq('category', category)
  if (resolved === 'true') query = query.eq('resolved', true)
  if (resolved === 'false') query = query.eq('resolved', false)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ feedback: data || [] })
}

export async function PATCH(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })
  if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only.' }, { status: 403 })

  const { id, resolved } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabaseAdmin = getSupabaseAdmin()
  const { error: dbError } = await supabaseAdmin
    .from('feedback')
    .update({ resolved: Boolean(resolved) })
    .eq('id', id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
