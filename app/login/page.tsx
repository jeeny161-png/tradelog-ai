'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAuthErrorMessage, getPasswordValidationError, PASSWORD_MIN_LENGTH } from '@/lib/auth-errors'

type Mode = 'login' | 'signup' | 'reset'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!email) return alert('이메일을 입력하세요')
    if (mode !== 'reset' && !password) return alert('비밀번호를 입력하세요')
    if (mode === 'signup') {
      const passwordError = getPasswordValidationError(password)
      if (passwordError) {
        setMessage('오류: ' + passwordError)
        return
      }
    }
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage('오류: ' + getAuthErrorMessage(error, 'signup'))
      else setMessage('가입 완료! 이메일을 확인하고 로그인하세요.')
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`
      })
      if (error) setMessage('오류: ' + getAuthErrorMessage(error, 'reset'))
      else setMessage('비밀번호 재설정 링크를 이메일로 보냈습니다. 받은편지함을 확인하세요.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage('오류: ' + getAuthErrorMessage(error, 'login'))
      else window.location.href = '/'
    }
    setLoading(false)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setMessage('')
    setPassword('')
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-amber-600/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black font-bold text-xl mb-4 shadow-lg shadow-amber-500/30">T</div>
          <h1 className="text-2xl font-bold text-slate-100">TradeLog AI</h1>
          <p className="text-slate-500 text-sm mt-1 tracking-wide">Gold Trading Intelligence</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1f2e] rounded-2xl border border-white/[0.08] p-6 shadow-2xl">
          <p className="text-sm font-medium text-slate-300 mb-5">
            {mode === 'login' ? '로그인' : mode === 'signup' ? '새 계정 만들기' : '비밀번호 재설정'}
          </p>

          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block font-medium">이메일</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
                placeholder="hello@example.com"
                className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">비밀번호</label>
                <input
                  type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
                  placeholder={mode === 'signup' ? `${PASSWORD_MIN_LENGTH}자 이상` : '비밀번호 입력'}
                  minLength={mode === 'signup' ? PASSWORD_MIN_LENGTH : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                />
                {mode === 'signup' && (
                  <div className="mt-2 space-y-1">
                    <p className={`text-xs ${password.length >= PASSWORD_MIN_LENGTH ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {password.length >= PASSWORD_MIN_LENGTH
                        ? `✓ ${PASSWORD_MIN_LENGTH}자 이상`
                        : `${password.length}/${PASSWORD_MIN_LENGTH}자 입력`}
                    </p>
                    <p className="text-[11px] leading-4 text-slate-600">
                      {PASSWORD_MIN_LENGTH}자 이상이면 됩니다. 영문·숫자·특수문자 조합은 필수가 아닙니다.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Feature 2: Forgot password link */}
          {mode === 'login' && (
            <button onClick={() => switchMode('reset')}
              className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors mb-4 block">
              비밀번호를 잊으셨나요?
            </button>
          )}

          {message && (
            <div className={`text-xs rounded-lg px-3 py-2.5 mb-4 ${
              message.includes('오류')
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {message}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 mb-3">
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '재설정 메일 보내기'}
          </button>

          <div className="flex flex-col gap-1">
            {mode !== 'login' && (
              <button onClick={() => switchMode('login')}
                className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1">
                로그인으로 돌아가기
              </button>
            )}
            {mode === 'login' && (
              <button onClick={() => switchMode('signup')}
                className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1">
                계정이 없어요 → 회원가입
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
