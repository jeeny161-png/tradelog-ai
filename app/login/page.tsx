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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2">TradeLog AI</h1>
        <p className="text-gray-500 text-sm mb-6">
          {isSignUp ? '계정을 만들어보세요' : '로그인하세요'}
        </p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="hello@example.com"
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="6자리 이상"
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        {message && (
          <div className={`text-sm rounded-lg p-3 mb-4 ${message.includes('오류') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {message}
          </div>
        )}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-black text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 mb-3">
          {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
        </button>
        <button onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
          className="w-full text-sm text-gray-500 hover:text-gray-700">
          {isSignUp ? '이미 계정이 있어요 → 로그인' : '계정이 없어요 → 회원가입'}
        </button>
      </div>
    </div>
  )
}