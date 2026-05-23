import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Toss 빌링키 발급 후 리다이렉트되는 엔드포인트
export async function GET(req: Request) {
  const supabaseAdmin = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const authKey = searchParams.get('authKey')
  const customerKey = searchParams.get('customerKey')
  const userId = searchParams.get('userId')

  if (!authKey || !customerKey || !userId) {
    return NextResponse.redirect(new URL('/pricing?error=invalid_params', req.url))
  }

  try {
    // 1. Toss API로 빌링키 발급

    const tossSecretKey = process.env.TOSS_SECRET_KEY ?? ''
    const encoded = Buffer.from(`${tossSecretKey}:`).toString('base64')

    const billingRes = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ authKey, customerKey }),
    })

    if (!billingRes.ok) {
      const err = await billingRes.json()
      console.error('Toss 빌링키 발급 실패:', err)
      return NextResponse.redirect(new URL('/pricing?error=billing_fail', req.url))
    }

    const { billingKey } = await billingRes.json()

    // 2. 첫 결제 (19,900원)
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single()

    const chargeRes = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerKey,
        amount: 19900,
        orderId: `order-${userId}-${Date.now()}`,
        orderName: 'TradeLog AI Pro 월간 구독',
      }),
    })

    if (!chargeRes.ok) {
      const err = await chargeRes.json()
      console.error('Toss 결제 실패:', err)
      return NextResponse.redirect(new URL('/pricing?error=charge_fail', req.url))
    }

    // 3. DB 업데이트 — Pro 플랜으로 전환
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      plan: 'pro',
      billing_key: billingKey,
      subscribed_at: new Date().toISOString(),
    })

    console.log(`[결제 완료] userId: ${userId}, 이전 플랜: ${userProfile?.plan ?? 'free'} → pro`)
    return NextResponse.redirect(new URL('/pricing?success=true', req.url))

  } catch (error) {
    console.error('결제 처리 오류:', error)
    return NextResponse.redirect(new URL('/pricing?error=server_error', req.url))
  }
}
