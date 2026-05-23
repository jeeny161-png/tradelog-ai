import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(req: Request) {
  try {
    const trade = await req.json()

    const prompt = `당신은 선물/CFD 전문 트레이딩 코치입니다.

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

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ text })

  } catch (error: any) {
    console.error('AI 분석 오류:', error)
    return NextResponse.json(
      { error: error.message || '알 수 없는 오류' },
      { status: 500 }
    )
  }
}