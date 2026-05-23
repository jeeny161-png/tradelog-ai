'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) return alert('이메일과 비밀번호를 입력하세요')
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage('오류: ' + error.message)
      else setMessage('가입 완료! 로그인하세요.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage('오류: ' + error.message)
      else window.location.href = '/'
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-amber-600/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black font-bold text-xl mb-4 shadow-lg shadow-amber-500/30">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-100">TradeLog AI</h1>
          <p className="text-slate-500 text-sm mt-1 tracking-wide">Gold Trading Intelligence</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1f2e] rounded-2xl border border-white/[0.08] p-6 shadow-2xl">
          <p className="text-sm font-medium text-slate-300 mb-5">
            {isSignUp ? '새 계정 만들기' : '로그인'}
          </p>

          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block font-medium">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
                placeholder="hello@example.com"
                className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block font-medium">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
                placeholder="6자리 이상"
                className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
              />
            </div>
          </div>

          {message && (
            <div className={`text-xs rounded-lg px-3 py-2.5 mb-4 ${
              message.includes('오류')
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {message}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 mb-3"
          >
            {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
          </button>

          <button
            onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
            className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
          >
            {isSignUp ? '이미 계정이 있어요 → 로그인' : '계정이 없어요 → 회원가입'}
          </button>
        </div>
      </div>
    </div>
  )
}
