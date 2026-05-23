'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState('')

  const authedFetch = async (method: 'GET' | 'POST') => {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/settings/mt5-key', {
      method,
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    return response.json()
  }

  useEffect(() => {
    authedFetch('GET').then((data) => {
      if (data.apiKey) setApiKey(data.apiKey)
    })
  }, [])

  const regenerate = async () => {
    const data = await authedFetch('POST')
    if (data.apiKey) setApiKey(data.apiKey)
  }

  const testConnection = async () => {
    const response = await fetch('/api/mt5')
    const data = await response.json()
    setStatus(data.ok ? 'Connection OK' : 'Connection failed')
  }

  return (
    <main className="min-h-screen bg-[#0f1117] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-3 inline-flex text-sm text-amber-400">← Dashboard</Link>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">MT5 연동 및 개인 API 키를 관리합니다.</p>

        <section className="mt-6 rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
          <h2 className="text-lg font-semibold">MT5 연동</h2>
          <p className="mt-2 text-sm text-slate-500">아래 API 키를 TradeLog AI Bridge EA 파라미터에 입력하세요.</p>

          <div className="mt-5 rounded-lg bg-[#0f1117] p-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Personal API Key</div>
            <div className="break-all font-mono text-sm text-amber-300">{apiKey || 'Loading...'}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => void navigator.clipboard.writeText(apiKey)} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black">Copy API key</button>
            <button onClick={() => void regenerate()} className="min-h-11 rounded-lg bg-white/[0.06] px-4 text-sm font-semibold text-slate-200">Regenerate</button>
            <button onClick={() => void testConnection()} className="min-h-11 rounded-lg bg-white/[0.06] px-4 text-sm font-semibold text-slate-200">Test connection</button>
          </div>
          {status && <p className="mt-3 text-sm text-emerald-400">{status}</p>}

          <div className="mt-6 space-y-3 rounded-lg border border-white/[0.06] bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-400">
            <p>1. <Link href="/TradeLogAI_Bridge.mq5" className="text-amber-400 underline">TradeLogAI_Bridge.mq5</Link> 파일을 다운로드해서 MT5 Experts 폴더에 넣습니다.</p>
            <p>2. MT5 옵션 → Expert Advisors → WebRequest 허용 URL에 https://tradelog-ai-one.vercel.app 을 추가합니다.</p>
            <p>3. EA 설정에서 ApiKey에 위 개인 키를 입력합니다.</p>
            <p>4. 거래가 닫힐 때 EA가 /api/mt5로 일지를 자동 전송합니다.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
