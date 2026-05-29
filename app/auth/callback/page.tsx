'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'loading' | 'reset' | 'redirecting'>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Supabase puts the session tokens in the URL hash for recovery links.
    // Calling getSession() lets the SDK parse the hash and establish the session.
    supabase.auth.getSession().then(({ data }) => {
      const params = new URLSearchParams(window.location.search)
      const type = params.get('type')

      if (type === 'recovery' || data.session) {
        // Recovery flow: stay on page and show the password form.
        // If the hash contained a valid recovery token, getSession() already
        // exchanged it and the user is now temporarily authenticated.
        setMode('reset')
      } else {
        // Not a recovery link — just send the user home.
        setMode('redirecting')
        router.replace('/')
      }
    })
  }, [router])

  const handleSubmit = async () => {
    setError('')
    if (!password) { setError('새 비밀번호를 입력해주세요.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => router.replace('/'), 2000)
  }

  if (mode === 'loading' || mode === 'redirecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117]">
        <div className="text-sm text-slate-500">잠시만 기다려 주세요...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-xl font-black text-black">
            T
          </div>
          <span className="text-lg font-bold text-slate-100">TradeLog AI</span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#1a1f2e] p-6">
          {success ? (
            <div className="py-4 text-center">
              <div className="mb-3 text-4xl">✅</div>
              <h2 className="mb-1 text-base font-bold text-slate-100">비밀번호가 변경되었습니다</h2>
              <p className="text-sm text-slate-500">잠시 후 홈으로 이동합니다...</p>
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-lg font-bold text-slate-100">새 비밀번호 설정</h1>
              <p className="mb-6 text-sm text-slate-500">6자 이상의 새 비밀번호를 입력해주세요.</p>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">새 비밀번호</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0f1117] px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">비밀번호 확인</span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0f1117] px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  />
                </label>

                {error && (
                  <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="min-h-11 w-full rounded-xl bg-amber-500 text-sm font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
                >
                  {submitting ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
