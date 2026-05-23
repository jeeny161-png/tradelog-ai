'use client'
import { useState, useEffect } from 'react'
import Script from 'next/script'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window {
    TossPayments: (clientKey: string) => {
      requestBillingAuth: (method: string, options: {
        customerKey: string
        successUrl: string
        failUrl: string
      }) => Promise<void>
    }
  }
}

// Toss Payments 테스트 클라이언트 키
// 실제 배포 시 process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY 로 교체
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? 'test_ck_placeholder'

export default function PricingPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    // URL 파라미터 확인 (결제 후 리다이렉트)
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setSuccessMsg('🎉 Pro 플랜 구독이 완료되었습니다!')
    }

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || null
      setUserId(uid)
      if (uid) {
        supabase.from('profiles').select('plan').eq('id', uid).single().then(({ data }) => {
          if (data?.plan) setPlan(data.plan as 'free' | 'pro')
        })
      }
    })
  }, [])

  const handleSubscribe = async () => {
    if (!userId) { window.location.href = '/login'; return }
    if (!sdkReady) { alert('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.'); return }
    setLoading(true)
    try {
      const tossPayments = window.TossPayments(TOSS_CLIENT_KEY)
      await tossPayments.requestBillingAuth('카드', {
        customerKey: `user-${userId}`,
        successUrl: `${window.location.origin}/api/payment/billing?userId=${userId}`,
        failUrl: `${window.location.origin}/pricing?error=payment_fail`,
      })
    } catch (err) {
      console.error('결제 오류:', err)
      alert('결제 중 오류가 발생했습니다.')
    }
    setLoading(false)
  }

  return (
    <>
      <Script
        src="https://js.tosspayments.com/v1/payment"
        onReady={() => setSdkReady(true)}
      />

      <div className="min-h-screen bg-[#0f1117] text-white">
        {/* Background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/[0.03] rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 py-16">
          {/* Header */}
          <div className="text-center mb-12">
            <a href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-8 transition-colors">
              ← 대시보드로
            </a>
            <h1 className="text-3xl font-bold text-slate-100 mb-3">요금제</h1>
            <p className="text-slate-500">금 트레이딩 실력 향상을 위한 AI 코치</p>

            {successMsg && (
              <div className="mt-4 inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl px-5 py-3 text-sm">
                {successMsg}
              </div>
            )}
          </div>

          {/* Plans */}
          <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">

            {/* Free Plan */}
            <div className="bg-[#1a1f2e] rounded-2xl border border-white/[0.08] p-6">
              <div className="mb-6">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">무료 플랜</div>
                <div className="text-3xl font-bold text-slate-100">₩0</div>
                <div className="text-slate-500 text-sm mt-1">영원히 무료</div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  '거래 일지 무제한 기록',
                  '차트 이미지 업로드',
                  'AI 분석 월 15회',
                  '기본 통계 대시보드',
                  '코치 공유 기능',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-400">
                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <div className={`w-full text-center py-2.5 rounded-xl text-sm font-medium border ${
                plan === 'free'
                  ? 'border-white/[0.08] text-slate-500 cursor-default'
                  : 'border-white/[0.08] text-slate-400'
              }`}>
                {plan === 'free' ? '현재 플랜' : '무료 플랜'}
              </div>
            </div>

            {/* Pro Plan */}
            <div className="bg-[#1a1f2e] rounded-2xl border border-amber-500/30 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-600" />
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent pointer-events-none" />

              <div className="relative mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs text-amber-400 uppercase tracking-wider">Pro 플랜</div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">추천</span>
                </div>
                <div className="text-3xl font-bold text-slate-100">₩19,900</div>
                <div className="text-slate-500 text-sm mt-1">월 / VAT 포함</div>
              </div>

              <ul className="space-y-3 mb-8 relative">
                {[
                  '거래 일지 무제한 기록',
                  '차트 이미지 업로드',
                  'AI 분석 무제한',
                  '기본 통계 대시보드',
                  '코치 공유 기능',
                  '우선 고객 지원',
                ].map((f, i) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <svg className={`w-4 h-4 flex-shrink-0 ${i >= 4 ? 'text-amber-400' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => void handleSubscribe()}
                disabled={loading || plan === 'pro'}
                className="relative w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20">
                {plan === 'pro' ? '✓ 구독 중' : loading ? '처리 중...' : 'Pro 시작하기'}
              </button>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-slate-600 mt-8">
            언제든지 해지 가능 · Toss Payments 보안 결제 · 첫 결제 시 즉시 Pro 전환
          </p>
        </div>
      </div>
    </>
  )
}
