import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 서비스 롤 클라이언트 — 빌드 시 undefined 방지를 위해 함수 내부에서 초기화
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: '유효하지 않은 세션입니다' }, { status: 401 })

    const trade = await req.json()

    // Feature 5: 크레딧 확인
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan, ai_credits')
      .eq('id', user.id)
      .single()

    if (profile?.plan === 'free') {
      if ((profile.ai_credits ?? 0) <= 0) {
        return NextResponse.json({ error: '무료 플랜 AI 분석 횟수를 모두 사용했습니다. Pro 플랜으로 업그레이드하세요.' }, { status: 403 })
      }
    }

    const prompt = `당신은 선물/CFD 전문 트레이딩 코치입니다.${trade.chart_image_url ? '\n첨부된 차트 이미지도 함께 분석해주세요.' : ''}

종목: ${trade.symbol} | 방향: ${trade.direction === 'L' ? '롱' : '숏'}
진입가: ${trade.entry_price} | 청산가: ${trade.exit_price}
수량: ${trade.quantity}계약 | 손익: ${trade.pnl >= 0 ? '+' : ''}${trade.pnl} USD
감정: ${trade.emotion}
매매근거: ${trade.rationale || '미기재'}
메모: ${trade.notes || '미기재'}

반드시 아래 형식으로만 응답하세요:

[요약]
핵심 평가 1-2문장.

[잘한점]
- 잘한 점 1
- 잘한 점 2
- 잘한 점 3

[개선할점]
- 개선점 1
- 개선점 2
- 개선점 3

[다음조언]
다음 조언 1-2문장.`

    // Feature 3: Vision — 이미지가 있으면 멀티모달 메시지 구성
    let messageContent: Anthropic.MessageParam['content']

    if (trade.chart_image_url) {
      const imgRes = await fetch(trade.chart_image_url)
      const buf = await imgRes.arrayBuffer()
      const base64Data = Buffer.from(buf).toString('base64')
      const rawType = imgRes.headers.get('content-type') || 'image/jpeg'
      const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(rawType)
        ? rawType
        : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

      messageContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data }
        },
        { type: 'text', text: prompt }
      ]
    } else {
      messageContent = prompt
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: messageContent }]
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Feature 5: 무료 플랜 크레딧 차감
    if (profile?.plan === 'free') {
      await supabaseAdmin
        .from('profiles')
        .update({ ai_credits: (profile.ai_credits ?? 1) - 1 })
        .eq('id', user.id)
    }

    return NextResponse.json({ text })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류'
    console.error('AI 분석 오류:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
