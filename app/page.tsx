'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
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
  share_token?: string | null
}

type Profile = {
  plan: 'free' | 'pro'
  ai_credits: number
}

type Goals = {
  monthly_target: number
  max_daily_loss: number
  max_consecutive_losses: number
}

type PatternInsight = {
  title: string
  value: string
  detail: string
}

async function uploadChart(file: File, uid: string): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${uid}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('charts').upload(path, file, { upsert: false })
  if (error) return null

  const { data } = supabase.storage.from('charts').getPublicUrl(path)
  return data.publicUrl
}

export default function Home() {
  const { language, setLanguage, t } = useLanguage()
  const [trades, setTrades] = useState<Trade[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile>({ plan: 'free', ai_credits: 15 })
  const [symbol, setSymbol] = useState('XAUUSD')
  const [direction, setDirection] = useState<'L' | 'S'>('L')
  const [entry, setEntry] = useState('')
  const [exit, setExit] = useState('')
  const [qty, setQty] = useState('1')
  const [emotion, setEmotion] = useState('Calm')
  const [rationale, setRationale] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [chartFile, setChartFile] = useState<File | null>(null)
  const [chartPreview, setChartPreview] = useState<string | null>(null)
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'shared'>('idle')
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [goals, setGoals] = useState<Goals | null>(null)
  const [patternInsights, setPatternInsights] = useState<PatternInsight[]>([])
  const [patternSummary, setPatternSummary] = useState('')
  const [patternsLoading, setPatternsLoading] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const coachRef = useRef<HTMLDivElement>(null)
  const patternsRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan, ai_credits')
      .eq('id', uid)
      .single()

    if (error || !data) {
      await supabase.from('profiles').upsert({ id: uid, plan: 'free', ai_credits: 15 })
      return
    }

    setProfile(data as Profile)
  }, [])

  const checkShareStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const response = await fetch('/api/shares', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (!response.ok) return

    const data = await response.json()
    setShareStatus(data.shared ? 'shared' : 'idle')
  }, [])

  const loadTrades = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    setTrades(data || [])
  }, [])

  const loadGoals = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('goals')
      .select('monthly_target, max_daily_loss, max_consecutive_losses')
      .eq('user_id', uid)
      .single()

    setGoals(data as Goals | null)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || null
      const email = data.user?.email || null
      setUserId(uid)
      setUserEmail(email)
      if (uid) {
        void loadTrades(uid)
        void loadProfile(uid)
        void loadGoals(uid)
        void checkShareStatus()
      }
    })
  }, [checkShareStatus, loadGoals, loadProfile, loadTrades])

  const handleLogout = () => {
    supabase.auth.signOut().finally(() => {
      window.location.replace('/login')
    })
  }

  const scrollTo = (ref: RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setChartFile(file)
    const reader = new FileReader()
    reader.onload = (readerEvent) => setChartPreview(readerEvent.target?.result as string)
    reader.readAsDataURL(file)
  }

  const pnl = entry && exit
    ? Math.round((Number(exit) - Number(entry)) * (direction === 'L' ? 1 : -1) * Number(qty) * 100)
    : 0

  const resetForm = () => {
    setEditingTrade(null)
    setSymbol('XAUUSD')
    setDirection('L')
    setEntry('')
    setExit('')
    setQty('1')
    setEmotion('Calm')
    setRationale('')
    setNotes('')
    setChartFile(null)
    setChartPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleEditClick = (trade: Trade) => {
    setEditingTrade(trade)
    setSymbol(trade.symbol)
    setDirection(trade.direction)
    setEntry(String(trade.entry_price))
    setExit(String(trade.exit_price))
    setQty(String(trade.quantity))
    setEmotion(trade.emotion || 'Calm')
    setRationale(trade.rationale || '')
    setNotes(trade.notes || '')
    setChartPreview(trade.chart_image_url || null)
    setChartFile(null)
    scrollTo(formRef)
  }

  const saveTrade = async () => {
    if (!entry || !exit) return alert(t.alertPrices)
    if (!userId) return alert(t.alertLogin)

    setLoading(true)
    let chartUrl: string | null | undefined = editingTrade?.chart_image_url

    if (chartFile) {
      chartUrl = await uploadChart(chartFile, userId)
    }

    const payload = {
      symbol: symbol.trim().toUpperCase(),
      direction,
      entry_price: Number(entry),
      exit_price: Number(exit),
      quantity: Number(qty),
      pnl,
      emotion,
      rationale,
      notes,
      chart_image_url: chartUrl ?? null,
    }

    if (editingTrade) {
      const { error } = await supabase.from('trades').update(payload).eq('id', editingTrade.id)
      if (error) alert(`${t.updateFailed}: ${error.message}`)
      else {
        resetForm()
        await loadTrades(userId)
      }
    } else {
      const { error } = await supabase.from('trades').insert({
        ...payload,
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
      })
      if (error) alert(`${t.saveFailed}: ${error.message}`)
      else {
        resetForm()
        await loadTrades(userId)
      }
    }

    setLoading(false)
  }

  const handleDeleteClick = async (event: React.MouseEvent, trade: Trade) => {
    event.stopPropagation()
    if (!confirm(`${t.deleteConfirm} (${trade.symbol})`)) return

    const { error } = await supabase.from('trades').delete().eq('id', trade.id)
    if (error) alert(`${t.deleteFailed}: ${error.message}`)
    else {
      if (selectedTrade?.id === trade.id) setSelectedTrade(null)
      if (userId) await loadTrades(userId)
    }
  }

  const handleShare = async () => {
    if (!userId || !userEmail || shareStatus === 'loading') return
    setShareStatus('loading')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setShareStatus('idle')
      return
    }

    const nextAction = shareStatus === 'shared' ? 'unshare' : 'share'
    const response = await fetch('/api/shares', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: nextAction }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      alert(`${t.shareFailed}: ${data.error || response.statusText}`)
      setShareStatus(nextAction === 'share' ? 'idle' : 'shared')
      return
    }

    setShareStatus(data.shared ? 'shared' : 'idle')
  }

  const analyze = async (trade: Trade) => {
    if (profile.plan === 'free' && profile.ai_credits <= 0) {
      if (confirm(t.creditsUsed)) {
        window.location.href = '/pricing'
      }
      return
    }

    setSelectedTrade(trade)
    setAiResult('')
    setAiLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(trade),
    })
    const data = await response.json()
    setAiResult(data.text || data.error || t.analysisFailed)
    setAiLoading(false)

    if (userId) await loadProfile(userId)
  }

  const analyzePatterns = async () => {
    setPatternsLoading(true)
    setPatternInsights([])
    setPatternSummary('')
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/ai/patterns', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
    })
    const data = await response.json()
    if (!response.ok) alert(data.error || 'Pattern analysis failed.')
    setPatternInsights(data.insights || [])
    setPatternSummary(data.summary || '')
    setPatternsLoading(false)
  }

  const shareTrade = async (trade: Trade) => {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/shares/public', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ tradeId: trade.id }),
    })
    const data = await response.json()
    if (!response.ok) return alert(data.error || 'Share failed.')

    const url = `${window.location.origin}${data.url}`
    await navigator.clipboard.writeText(url)
    alert(`Public link copied:\n${url}`)
    if (userId) await loadTrades(userId)
  }

  const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0)
  const winRate = trades.length ? Math.round((trades.filter((trade) => trade.pnl > 0).length / trades.length) * 100) : 0
  const isFree = profile.plan === 'free'
  const todayKey = new Date().toISOString().slice(0, 10)
  const monthKey = todayKey.slice(0, 7)
  const todayPnl = trades.filter((trade) => trade.date === todayKey).reduce((sum, trade) => sum + trade.pnl, 0)
  const monthPnl = trades.filter((trade) => trade.date?.startsWith(monthKey)).reduce((sum, trade) => sum + trade.pnl, 0)
  const todayTrades = [...trades].filter((trade) => trade.date === todayKey).sort((a, b) => a.date.localeCompare(b.date))
  let consecutiveLosses = 0
  for (let index = todayTrades.length - 1; index >= 0; index -= 1) {
    if (todayTrades[index].pnl < 0) consecutiveLosses += 1
    else break
  }
  const warnings = [
    goals?.max_consecutive_losses && consecutiveLosses >= goals.max_consecutive_losses
      ? `⚠️ ${consecutiveLosses} consecutive losses today. Consider stopping.`
      : '',
    goals?.max_daily_loss && todayPnl <= -Math.abs(goals.max_daily_loss)
      ? `⚠️ Daily loss limit reached (${todayPnl.toLocaleString()})`
      : '',
    goals?.monthly_target && goals.monthly_target > 0
      ? `🎯 ${Math.max(0, Math.round((monthPnl / goals.monthly_target) * 100))}% of monthly goal achieved!`
      : '',
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-[#0f1117] text-white lg:flex">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#1a1f2e] lg:flex">
        <div className="border-b border-white/[0.06] px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-black shadow-lg shadow-amber-500/30">T</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight text-slate-100">TradeLog AI</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <button className="flex w-full items-center gap-3 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm font-medium text-amber-400">
            <span className="text-base">□</span>
            {t.dashboard}
          </button>
          <button onClick={() => scrollTo(formRef)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-lg">+</span>
            {t.newEntry}
          </button>
          <button onClick={() => scrollTo(listRef)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">≡</span>
            {t.history}
          </button>
          <Link href="/calendar" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">◫</span>
            {t.calendar}
          </Link>
          <Link href="/groups" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">G</span>
            Groups
          </Link>
          <Link href="/ranking" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">#</span>
            Rankings
          </Link>
          <Link href="/goals" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">!</span>
            목표
          </Link>
          <Link href="/import" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">↑</span>
            가져오기
          </Link>
          <Link href="/settings" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">S</span>
            설정
          </Link>
          <Link href="/help" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">?</span>
            도움말
          </Link>
          <button onClick={() => scrollTo(coachRef)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">◇</span>
            {t.coach}
          </button>
          <button onClick={() => scrollTo(patternsRef)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span className="text-base">P</span>
            패턴 분석
          </button>
        </nav>

        <div className="mx-3 mb-2 rounded-xl border border-white/[0.06] bg-[#0f1117] px-4 py-3">
          {isFree ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{t.aiCredits}</span>
                <span className={`text-xs font-bold ${profile.ai_credits <= 3 ? 'text-red-400' : 'text-amber-400'}`}>{profile.ai_credits} / 15</span>
              </div>
              <div className="mb-3 h-1 w-full rounded-full bg-white/[0.06]">
                <div className="h-1 rounded-full bg-amber-400 transition-all" style={{ width: `${(profile.ai_credits / 15) * 100}%` }} />
              </div>
              <Link href="/pricing" className="block min-h-11 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-center text-xs font-semibold text-black transition-all hover:from-amber-400 hover:to-amber-500">
                {t.upgradePro}
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">{t.proPlan}</span>
              <span className="ml-auto text-[11px] text-slate-500">{t.unlimited}</span>
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.06] px-3 py-4">
          {userEmail && (
            <div className="mb-1 flex items-center gap-2 px-3 py-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                {userEmail[0].toUpperCase()}
              </div>
              <div className="truncate text-xs text-slate-500">{userEmail}</div>
            </div>
          )}
          <button onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400">
            <span>↪</span>
            {t.logout}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden pb-24 lg:h-screen lg:overflow-y-auto lg:pb-0">
        <header className="border-b border-white/[0.04] px-4 pb-5 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 lg:hidden">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-black">T</div>
                <span className="text-sm font-semibold text-slate-100">TradeLog AI</span>
              </div>
              <h1 className="text-xl font-semibold text-slate-100">{t.dashboard}</h1>
              <p className="mt-0.5 text-sm text-slate-500">{t.dashboardSubtitle}</p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <LanguageToggle language={language} setLanguage={setLanguage} />
              <Link href="/calendar" className="flex min-h-11 items-center rounded-lg border border-amber-500/30 px-4 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10">
                {t.calendar}
              </Link>
            </div>
          </div>
          <div className="mt-4 sm:hidden">
            <LanguageToggle language={language} setLanguage={setLanguage} />
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 px-4 py-5 sm:px-6 lg:grid-cols-3 lg:gap-4 lg:px-8 lg:py-6">
          <StatCard label={t.totalTrades} value={trades.length.toLocaleString()} tone="amber" sublabel={t.records} />
          <StatCard label={t.winRate} value={`${winRate}%`} tone={winRate >= 50 ? 'green' : 'red'} sublabel={t.closedTrades} />
          <StatCard label={t.totalPnl} value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}`} tone={totalPnl >= 0 ? 'green' : 'red'} sublabel="USD" className="col-span-2 lg:col-span-1" />
        </section>

        {warnings.length > 0 && (
          <section className="px-4 pb-5 sm:px-6 lg:px-8">
            <div className="space-y-2">
              {warnings.map((warning) => (
                <div key={warning} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  {warning}
                </div>
              ))}
            </div>
          </section>
        )}

        <section ref={formRef} className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`h-4 w-1 rounded-full ${editingTrade ? 'bg-amber-300' : 'bg-amber-400'}`} />
                <h2 className="text-sm font-semibold text-slate-200">{editingTrade ? `${t.editing} ${editingTrade.symbol}` : t.newEntry}</h2>
              </div>
              {editingTrade && (
                <button onClick={resetForm} className="min-h-11 rounded-md px-3 text-xs text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300">
                  {t.cancel}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.symbol}>
                <input value={symbol} onChange={(event) => setSymbol(event.target.value)} className="field-input" />
              </Field>
              <Field label={t.direction}>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setDirection('L')} className={`min-h-11 rounded-lg text-sm font-medium transition-all ${direction === 'L' ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400' : 'border border-white/[0.08] bg-[#0f1117] text-slate-400 hover:border-white/[0.15]'}`}>
                    {t.long}
                  </button>
                  <button onClick={() => setDirection('S')} className={`min-h-11 rounded-lg text-sm font-medium transition-all ${direction === 'S' ? 'border border-red-500/30 bg-red-500/20 text-red-400' : 'border border-white/[0.08] bg-[#0f1117] text-slate-400 hover:border-white/[0.15]'}`}>
                    {t.short}
                  </button>
                </div>
              </Field>
              <Field label={t.entryPrice}>
                <input value={entry} onChange={(event) => setEntry(event.target.value)} type="number" placeholder="3300.00" className="field-input" />
              </Field>
              <Field label={t.exitPrice}>
                <input value={exit} onChange={(event) => setExit(event.target.value)} type="number" placeholder="3320.00" className="field-input" />
              </Field>
              <Field label={t.quantity}>
                <input value={qty} onChange={(event) => setQty(event.target.value)} type="number" step="0.01" min="0.01" className="field-input" />
              </Field>
              <Field label={t.emotion}>
                <select value={emotion} onChange={(event) => setEmotion(event.target.value)} className="field-input">
                  {emotionOptions.map((item) => (
                    <option key={item.value} value={item.value} className="bg-[#1a1f2e]">
                      {item[language]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.tradeRationale} className="sm:col-span-2">
                <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder={t.rationalePlaceholder} className="field-input min-h-24 resize-none" />
              </Field>
              <Field label={t.notesReview} className="sm:col-span-2">
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t.notesPlaceholder} className="field-input min-h-24 resize-none" />
              </Field>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-slate-500">{t.chartImage}</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              {chartPreview ? (
                <div className="relative">
                  <img src={chartPreview} alt={t.chartImage} className="h-44 w-full rounded-lg border border-white/[0.08] object-cover sm:h-52" />
                  <button onClick={() => { setChartFile(null); setChartPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-sm text-white hover:bg-black/90">
                    X
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="flex min-h-20 w-full items-center justify-center rounded-lg border border-dashed border-white/[0.12] px-4 text-sm text-slate-500 transition-colors hover:border-amber-500/40 hover:text-amber-400/70">
                  {t.uploadChart}
                </button>
              )}
            </div>

            <div className="my-4 flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#0f1117] px-4 py-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{t.estimatedPnl}</span>
              <span className={`break-all text-right font-mono text-lg font-bold ${pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                {pnl !== 0 ? `${pnl > 0 ? '+' : ''}${pnl.toLocaleString()} USD` : '-'}
              </span>
            </div>

            <button onClick={saveTrade} disabled={loading} className="min-h-11 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-semibold text-black shadow-lg shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? t.saving : editingTrade ? t.updateTrade : t.saveTrade}
            </button>
          </div>
        </section>

        <section ref={coachRef} className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-200">{t.coachAccess}</h2>
                <p className="mt-1 text-sm text-slate-500">{t.coachSubtitle}</p>
              </div>
              <button onClick={handleShare} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-medium transition-colors ${shareStatus === 'shared' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}>
                {shareStatus === 'loading' ? t.processing : shareStatus === 'shared' ? t.sharingOn : t.shareWithCoach}
              </button>
            </div>
          </div>
        </section>

        <section ref={patternsRef} className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">패턴 분석</h2>
                <p className="mt-1 text-sm text-slate-500">시간대, 요일, 감정, 종목별 거래 패턴을 AI가 분석합니다.</p>
              </div>
              <button onClick={analyzePatterns} disabled={patternsLoading} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black disabled:opacity-40">
                {patternsLoading ? 'Analyzing...' : 'Run pattern analysis'}
              </button>
            </div>

            {patternSummary && <p className="mb-4 rounded-lg bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-400">{patternSummary}</p>}

            <div className="grid gap-3 md:grid-cols-3">
              {(patternInsights.length ? patternInsights : [
                { title: 'Best trading time', value: 'London session (08:00-12:00)', detail: 'Run analysis to calculate from your trades.' },
                { title: 'Worst emotion', value: '급함', detail: 'Win rate will appear after analysis.' },
                { title: 'Strongest day', value: 'Tuesday', detail: 'Win rate will appear after analysis.' },
              ]).map((insight) => (
                <div key={insight.title} className="rounded-lg border border-white/[0.06] bg-[#0f1117] p-4">
                  <div className="text-xs uppercase tracking-wider text-slate-600">{insight.title}</div>
                  <div className="mt-2 break-words text-lg font-bold text-slate-100">{insight.value}</div>
                  <div className="mt-1 break-words text-sm text-slate-500">{insight.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section ref={listRef} className="px-4 pb-10 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="h-4 w-1 rounded-full bg-amber-400" />
            <h2 className="text-sm font-semibold text-slate-200">{t.history}</h2>
            <span className="ml-0.5 text-xs text-slate-600">{trades.length} {t.trades}</span>
          </div>

          <div className="space-y-2">
            {trades.length === 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] px-4 py-8 text-center text-sm text-slate-500">{t.noTradesYet}</div>
            ) : trades.map((trade) => (
              <div key={trade.id} className="group overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1f2e] transition-all duration-200 hover:border-white/[0.12]">
                <button type="button" className="flex w-full min-w-0 cursor-pointer items-center gap-3 p-3 text-left transition-colors hover:bg-white/[0.02] sm:gap-4 sm:p-4" onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${trade.direction === 'L' ? 'border border-emerald-500/20 bg-emerald-500/20 text-emerald-400' : 'border border-red-500/20 bg-red-500/20 text-red-400'}`}>
                    {trade.direction}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium text-slate-200">{trade.symbol}</div>
                    <div className="mt-0.5 break-words text-xs text-slate-600">
                      {trade.date} · {trade.direction === 'L' ? t.long : t.short} · {trade.quantity} lot · {getEmotionLabel(trade.emotion, language)}
                    </div>
                  </div>
                  <div className={`shrink-0 break-all text-right font-mono text-sm font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()}
                  </div>
                </button>

                {selectedTrade?.id === trade.id && (
                  <div className="border-t border-white/[0.06] bg-[#0f1117]/60 px-4 py-4">
                    {trade.chart_image_url && <img src={trade.chart_image_url} alt={t.chartImage} className="mb-4 w-full rounded-lg border border-white/[0.08]" />}
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      <button onClick={() => handleEditClick(trade)} className="min-h-11 rounded-lg bg-amber-500/10 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20">{t.edit}</button>
                      <button onClick={(event) => void handleDeleteClick(event, trade)} className="min-h-11 rounded-lg bg-red-500/10 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20">{t.delete}</button>
                      <button onClick={() => void shareTrade(trade)} className="min-h-11 rounded-lg bg-sky-500/10 text-sm font-medium text-sky-400 transition-colors hover:bg-sky-500/20">Share</button>
                    </div>
                    <button onClick={() => analyze(trade)} disabled={aiLoading || (isFree && profile.ai_credits <= 0)} className="mb-4 flex min-h-11 w-full items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 text-sm font-medium text-amber-400 transition-all hover:bg-amber-500/10 hover:border-amber-500/50 disabled:cursor-not-allowed disabled:opacity-40">
                      {aiLoading ? t.analyzing : isFree ? `${t.aiAnalyze} (${profile.ai_credits} ${t.left})` : t.aiAnalyze}
                    </button>
                    {(trade.rationale || trade.notes) && (
                      <div className="mb-4 space-y-3 rounded-lg border border-white/[0.06] bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-400">
                        {trade.rationale && <p className="break-words"><span className="font-medium text-slate-300">{t.rationale}</span> {trade.rationale}</p>}
                        {trade.notes && <p className="break-words"><span className="font-medium text-slate-300">{t.notes}</span> {trade.notes}</p>}
                      </div>
                    )}
                    {aiResult && <div className="whitespace-pre-line break-words rounded-lg border border-white/[0.06] bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-400">{aiResult}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#111522]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-1">
          <MobileTab label={t.dashboard} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <MobileTab label={t.newEntry} onClick={() => scrollTo(formRef)} />
          <MobileTab label={t.history} onClick={() => scrollTo(listRef)} />
          <MobileTab label={t.coach} onClick={() => scrollTo(coachRef)} />
        </div>
      </nav>
    </div>
  )
}

function StatCard({ label, value, sublabel, tone, className = '' }: { label: string; value: string; sublabel: string; tone: 'amber' | 'green' | 'red'; className?: string }) {
  const color = tone === 'green' ? 'text-emerald-400 from-emerald-500/10' : tone === 'red' ? 'text-red-400 from-red-500/10' : 'text-slate-100 from-amber-500/10'

  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 sm:p-5 ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${color.split(' ')[1]} via-transparent to-transparent`} />
      <div className="relative min-w-0">
        <div className="mb-3 break-words text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`break-words text-2xl font-bold sm:text-3xl ${color.split(' ')[0]}`}>{value}</div>
        <div className="mt-1 break-words text-xs text-slate-600">{sublabel}</div>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function MobileTab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="min-h-11 rounded-lg px-1 py-2 text-center text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-amber-400">
      {label}
    </button>
  )
}
