'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import AppShell from './components/AppShell'
import { LanguageToggle, emotionOptions, getEmotionLabel, useLanguage } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'

type Trade = {
  id: string
  symbol: string
  direction: 'L' | 'S'
  entry_price: number
  exit_price: number
  quantity: number
  pnl: number
  emotion: string
  rationale: string
  notes: string
  date: string
  chart_image_url?: string | null
}

type Profile = {
  plan: 'free' | 'pro'
  ai_credits: number
}

async function uploadChart(file: File, uid: string) {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${uid}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('charts').upload(path, file, { upsert: false })
  if (error) return null
  const { data } = supabase.storage.from('charts').getPublicUrl(path)
  return data.publicUrl
}

export default function Home() {
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<Profile>({ plan: 'free', ai_credits: 15 })
  const [trades, setTrades] = useState<Trade[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [symbol, setSymbol] = useState('XAUUSD')
  const [direction, setDirection] = useState<'L' | 'S'>('L')
  const [entry, setEntry] = useState('')
  const [exit, setExit] = useState('')
  const [qty, setQty] = useState('1')
  const [emotion, setEmotion] = useState('Calm')
  const [rationale, setRationale] = useState('')
  const [notes, setNotes] = useState('')
  const [chartFile, setChartFile] = useState<File | null>(null)
  const [chartPreview, setChartPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('plan, ai_credits').eq('id', uid).single()
    if (data) setProfile(data as Profile)
  }, [])

  const loadTrades = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    setTrades((data || []) as Trade[])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || ''
      setUserId(uid)
      if (uid) {
        void loadProfile(uid)
        void loadTrades(uid)
      }
    })
  }, [loadProfile, loadTrades])

  const pnl = entry && exit ? Math.round((Number(exit) - Number(entry)) * (direction === 'L' ? 1 : -1) * Number(qty) * 100) : 0
  const totalPnl = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0)
  const winRate = trades.length ? Math.round((trades.filter((trade) => trade.pnl > 0).length / trades.length) * 100) : 0

  const resetForm = () => {
    setSymbol('XAUUSD')
    setDirection('L')
    setEntry('')
    setExit('')
    setQty('1')
    setEmotion('Calm')
    setRationale('')
    setNotes('')
    setChartFile(null)
    setChartPreview('')
  }

  const saveTrade = async () => {
    if (!userId) return alert('로그인이 필요합니다.')
    if (!entry || !exit) return alert('진입가와 청산가를 입력해 주세요.')
    setSaving(true)
    const chartUrl = chartFile ? await uploadChart(chartFile, userId) : null
    const { error } = await supabase.from('trades').insert({
      user_id: userId,
      symbol: symbol.trim().toUpperCase(),
      direction,
      entry_price: Number(entry),
      exit_price: Number(exit),
      quantity: Number(qty),
      pnl,
      emotion,
      rationale,
      notes,
      chart_image_url: chartUrl,
      date: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)
    if (error) return alert(error.message)
    resetForm()
    setFormOpen(false)
    await loadTrades(userId)
  }

  const handleFile = (file?: File) => {
    if (!file) return
    setChartFile(file)
    const reader = new FileReader()
    reader.onload = (event) => setChartPreview(String(event.target?.result || ''))
    reader.readAsDataURL(file)
  }

  const analyze = async (trade: Trade) => {
    if (profile.plan === 'free' && profile.ai_credits <= 0) {
      router.push('/pricing')
      return
    }
    setSelectedTrade(trade)
    setAiLoading(true)
    setAiResult('')
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(trade),
    })
    const data = await response.json()
    setAiResult(data.text || data.error || '분석에 실패했습니다.')
    setAiLoading(false)
    if (userId) await loadProfile(userId)
  }

  const openMobileForm = () => {
    setFormOpen(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-100">홈</h1>
            <p className="mt-1 text-sm text-slate-500">대시보드와 빠른 매매 일지를 한 화면에서 관리하세요.</p>
          </div>
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="총 거래" value={trades.length.toLocaleString()} sub="records" />
          <StatCard label="승률" value={`${winRate}%`} sub="closed trades" tone={winRate >= 50 ? 'good' : 'bad'} />
          <StatCard label="총 PnL" value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}`} sub="USD" tone={totalPnl >= 0 ? 'good' : 'bad'} className="col-span-2 lg:col-span-1" />
        </section>

        <section ref={formRef} className="mb-5 rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">빠른 일지 작성</h2>
              <p className="mt-1 text-sm text-slate-500">모바일에서는 FAB 버튼으로 바로 열 수 있습니다.</p>
            </div>
            <button onClick={() => setFormOpen((value) => !value)} className="min-h-11 rounded-xl bg-white/[0.06] px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.1]">
              {formOpen ? '접기' : '열기'}
            </button>
          </div>

          {formOpen && (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.symbol}><input className="field-input" value={symbol} onChange={(event) => setSymbol(event.target.value)} /></Field>
              <Field label={t.direction}>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setDirection('L')} className={`min-h-11 rounded-xl text-sm font-semibold ${direction === 'L' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#0f1117] text-slate-400'}`}>{t.long}</button>
                  <button onClick={() => setDirection('S')} className={`min-h-11 rounded-xl text-sm font-semibold ${direction === 'S' ? 'bg-red-500/20 text-red-400' : 'bg-[#0f1117] text-slate-400'}`}>{t.short}</button>
                </div>
              </Field>
              <Field label={t.entryPrice}><input className="field-input" value={entry} onChange={(event) => setEntry(event.target.value)} type="number" /></Field>
              <Field label={t.exitPrice}><input className="field-input" value={exit} onChange={(event) => setExit(event.target.value)} type="number" /></Field>
              <Field label={t.quantity}><input className="field-input" value={qty} onChange={(event) => setQty(event.target.value)} type="number" step="0.01" /></Field>
              <Field label={t.emotion}>
                <select className="field-input" value={emotion} onChange={(event) => setEmotion(event.target.value)}>
                  {emotionOptions.map((item) => <option key={item.value} value={item.value}>{item[language]}</option>)}
                </select>
              </Field>
              <Field label={t.tradeRationale} className="sm:col-span-2"><textarea className="field-input min-h-24" value={rationale} onChange={(event) => setRationale(event.target.value)} /></Field>
              <Field label={t.notesReview} className="sm:col-span-2"><textarea className="field-input min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
              <div className="sm:col-span-2">
                <label className="flex min-h-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-[#0f1117] px-4 text-sm text-slate-400">
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
                  {chartPreview ? '차트 이미지 선택됨' : t.uploadChart}
                </label>
              </div>
              {chartPreview && <img src={chartPreview} alt="Chart preview" className="max-h-64 w-full rounded-xl object-cover sm:col-span-2" />}
              <div className="flex min-h-11 items-center justify-between rounded-xl bg-[#0f1117] px-4 sm:col-span-2">
                <span className="text-sm text-slate-500">{t.estimatedPnl}</span>
                <span className={`font-mono text-lg font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pnl >= 0 ? '+' : ''}{pnl.toLocaleString()}</span>
              </div>
              <button onClick={saveTrade} disabled={saving} className="min-h-11 rounded-xl bg-amber-500 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50 sm:col-span-2">
                {saving ? t.saving : t.saveTrade}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-100">최근 거래 5개</h2>
            <span className="text-xs text-slate-500">AI credits {profile.ai_credits}</span>
          </div>
          <div className="space-y-3">
            {trades.slice(0, 5).map((trade) => (
              <article key={trade.id} className="rounded-xl border border-white/[0.06] bg-[#0f1117] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-lg px-3 py-2 text-sm font-bold ${trade.direction === 'L' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{trade.direction}</span>
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-semibold text-slate-100">{trade.symbol}</div>
                    <div className="mt-1 text-sm text-slate-500">{trade.date} · {getEmotionLabel(trade.emotion, language)}</div>
                  </div>
                  <div className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()}</div>
                </div>
                <button onClick={() => void analyze(trade)} className="mt-3 min-h-11 w-full rounded-xl bg-amber-500/10 text-sm font-semibold text-amber-400 hover:bg-amber-500/15">
                  {aiLoading && selectedTrade?.id === trade.id ? '분석 중...' : 'AI 분석'}
                </button>
                {selectedTrade?.id === trade.id && aiResult && <div className="mt-3 whitespace-pre-line break-words rounded-xl bg-[#151926] p-4 text-sm leading-relaxed text-slate-300">{aiResult}</div>}
              </article>
            ))}
            {!trades.length && <div className="rounded-xl bg-[#0f1117] p-8 text-center text-sm text-slate-500">{t.noTradesYet}</div>}
          </div>
        </section>
      </main>

      <button onClick={openMobileForm} className="fixed bottom-[88px] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-2xl font-bold text-black shadow-lg shadow-amber-500/30 lg:hidden">
        +
      </button>
    </AppShell>
  )
}

function StatCard({ label, value, sub, tone = 'neutral', className = '' }: { label: string; value: string; sub: string; tone?: 'neutral' | 'good' | 'bad'; className?: string }) {
  const color = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : 'text-slate-100'
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 ${className}`}>
      <div className="break-words text-xs text-slate-500">{label}</div>
      <div className={`mt-2 break-words text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 break-words text-xs text-slate-600">{sub}</div>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}
