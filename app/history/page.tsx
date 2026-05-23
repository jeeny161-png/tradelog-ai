'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { getEmotionLabel, useLanguage } from '@/lib/i18n'
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

type DayBucket = {
  date: string
  pnl: number
  trades: Trade[]
}

const weekdays = ['월', '화', '수', '목', '금', '토', '일']

export default function HistoryPage() {
  const { language } = useLanguage()
  const [tab, setTab] = useState<'list' | 'calendar'>('list')
  const [userId, setUserId] = useState('')
  const [trades, setTrades] = useState<Trade[]>([])
  const [month, setMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<DayBucket | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [aiResult, setAiResult] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)

  const loadTrades = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setTrades((data || []) as Trade[])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || ''
      setUserId(uid)
      if (uid) void loadTrades(uid)
    })
  }, [loadTrades])

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
  const dayMap = useMemo(() => {
    const map = new Map<string, DayBucket>()
    for (const trade of trades.filter((item) => item.date?.startsWith(monthKey))) {
      const bucket = map.get(trade.date) || { date: trade.date, pnl: 0, trades: [] }
      bucket.pnl += Number(trade.pnl) || 0
      bucket.trades.push(trade)
      map.set(trade.date, bucket)
    }
    return map
  }, [monthKey, trades])

  const weeks = useMemo(() => buildCalendarWeeks(month, dayMap), [month, dayMap])

  const deleteTrade = async (trade: Trade) => {
    if (!confirm(`${trade.symbol} 거래를 삭제할까요?`)) return
    const { error } = await supabase.from('trades').delete().eq('id', trade.id)
    if (error) return alert(error.message)
    if (userId) await loadTrades(userId)
  }

  const shareTrade = async (trade: Trade) => {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/shares/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ tradeId: trade.id }),
    })
    const data = await response.json()
    if (!response.ok) return alert(data.error || '공유 링크 생성에 실패했습니다.')
    const url = `${window.location.origin}${data.url}`
    await navigator.clipboard.writeText(url)
    alert(`공유 링크를 복사했습니다.\n${url}`)
  }

  const analyzeTrade = async (trade: Trade) => {
    setSelectedTrade(trade)
    setAiResult('')
    setLoadingAi(true)
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(trade),
    })
    const data = await response.json()
    setAiResult(data.text || data.error || '분석에 실패했습니다.')
    setLoadingAi(false)
  }

  const changeMonth = (offset: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1))
    setSelectedDay(null)
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5">
          <h1 className="text-2xl font-bold text-slate-100">기록</h1>
          <p className="mt-1 text-sm text-slate-500">거래 목록과 PnL 캘린더를 한 곳에서 확인하세요.</p>
        </header>

        <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-1">
          <button onClick={() => setTab('list')} className={`min-h-11 rounded-lg text-sm font-bold ${tab === 'list' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>목록</button>
          <button onClick={() => setTab('calendar')} className={`min-h-11 rounded-lg text-sm font-bold ${tab === 'calendar' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>캘린더</button>
        </div>

        {tab === 'list' ? (
          <section className="space-y-3">
            {trades.map((trade) => (
              <article key={trade.id} className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className={`rounded-lg px-3 py-2 text-sm font-bold ${trade.direction === 'L' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{trade.direction}</span>
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-semibold text-slate-100">{trade.symbol}</div>
                    <div className="mt-1 break-words text-sm text-slate-500">{trade.date} · {getEmotionLabel(trade.emotion, language)} · {trade.quantity} lot</div>
                    {(trade.rationale || trade.notes) && <p className="mt-2 line-clamp-2 break-words text-sm text-slate-400">{trade.rationale || trade.notes}</p>}
                  </div>
                  <div className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()}</div>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <button className="min-h-11 rounded-xl bg-white/[0.06] text-sm font-semibold text-slate-300" onClick={() => alert('편집은 홈의 빠른 일지 작성에서 곧 지원됩니다.')}>편집</button>
                  <button className="min-h-11 rounded-xl bg-red-500/10 text-sm font-semibold text-red-400" onClick={() => void deleteTrade(trade)}>삭제</button>
                  <button className="min-h-11 rounded-xl bg-sky-500/10 text-sm font-semibold text-sky-400" onClick={() => void shareTrade(trade)}>공유</button>
                  <button className="min-h-11 rounded-xl bg-amber-500/10 text-sm font-semibold text-amber-400" onClick={() => void analyzeTrade(trade)}>{loadingAi && selectedTrade?.id === trade.id ? '분석 중' : 'AI'}</button>
                </div>
                {selectedTrade?.id === trade.id && aiResult && <div className="mt-4 whitespace-pre-line break-words rounded-xl bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-300">{aiResult}</div>}
              </article>
            ))}
            {!trades.length && <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-8 text-center text-sm text-slate-500">아직 기록된 거래가 없습니다.</div>}
          </section>
        ) : (
          <section className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 sm:p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-100">{month.getFullYear()}년 {month.getMonth() + 1}월</h2>
              <div className="flex gap-2">
                <button onClick={() => changeMonth(-1)} className="min-h-11 rounded-xl bg-white/[0.06] px-4 text-sm font-semibold text-slate-200">이전</button>
                <button onClick={() => changeMonth(1)} className="min-h-11 rounded-xl bg-white/[0.06] px-4 text-sm font-semibold text-slate-200">다음</button>
              </div>
            </div>

            <MonthSummary buckets={[...dayMap.values()]} />

            <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.06]">
              <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_80px] bg-[#0f1117] text-center text-xs font-semibold text-slate-500">
                {weekdays.map((day) => <div key={day} className="px-1 py-3">{day}</div>)}
                <div className="px-1 py-3 text-amber-400">주간</div>
              </div>
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-[repeat(7,minmax(0,1fr))_80px] border-t border-white/[0.06]">
                  {week.days.map((day) => {
                    const bucket = day.date ? dayMap.get(day.date) : undefined
                    const tone = !bucket ? 'bg-[#151926] text-slate-600' : bucket.pnl >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                    return (
                      <button key={day.key} disabled={!day.date} onClick={() => bucket && setSelectedDay(bucket)} className={`min-h-24 border-r border-white/[0.04] p-2 text-left ${tone}`}>
                        <div className="text-xs font-semibold">{day.label}</div>
                        {bucket && <div className="mt-3 break-words font-mono text-sm font-bold">{bucket.pnl >= 0 ? '+' : ''}{bucket.pnl.toLocaleString()}</div>}
                      </button>
                    )
                  })}
                  <div className={`flex min-h-24 items-center justify-center p-2 text-center font-mono text-sm font-bold ${week.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {week.pnl >= 0 ? '+' : ''}{week.pnl.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {selectedDay && (
        <div className="fixed inset-0 z-40 bg-black/60 p-4 lg:p-8" onClick={() => setSelectedDay(null)}>
          <div className="ml-auto flex h-full max-w-md flex-col rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-100">{selectedDay.date}</h3>
              <button onClick={() => setSelectedDay(null)} className="min-h-11 rounded-xl px-3 text-slate-400">닫기</button>
            </div>
            <div className="space-y-3 overflow-y-auto">
              {selectedDay.trades.map((trade) => (
                <div key={trade.id} className="rounded-xl bg-[#0f1117] p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{trade.symbol}</div>
                      <div className="mt-1 text-sm text-slate-500">{trade.direction} · {getEmotionLabel(trade.emotion, language)}</div>
                    </div>
                    <div className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function MonthSummary({ buckets }: { buckets: DayBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.pnl, 0)
  const winRate = buckets.length ? Math.round((buckets.filter((bucket) => bucket.pnl > 0).length / buckets.length) * 100) : 0
  const best = [...buckets].sort((a, b) => b.pnl - a.pnl)[0]
  const worst = [...buckets].sort((a, b) => a.pnl - b.pnl)[0]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard label="이번 달 PnL" value={`${total >= 0 ? '+' : ''}${total.toLocaleString()}`} tone={total >= 0 ? 'good' : 'bad'} />
      <SummaryCard label="승률" value={`${winRate}%`} />
      <SummaryCard label="거래일" value={`${buckets.length}일`} />
      <SummaryCard label="최고 / 최악" value={`${best ? best.pnl.toLocaleString() : 0} / ${worst ? worst.pnl.toLocaleString() : 0}`} />
    </div>
  )
}

function SummaryCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : 'text-slate-100'
  return (
    <div className="rounded-xl bg-[#0f1117] p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-2 break-words font-bold ${color}`}>{value}</div>
    </div>
  )
}

function buildCalendarWeeks(month: Date, dayMap: Map<string, DayBucket>) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const offset = (first.getDay() + 6) % 7
  const cells: { key: string; date: string | null; label: string }[] = []
  for (let i = 0; i < offset; i += 1) cells.push({ key: `blank-start-${i}`, date: null, label: '' })
  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ key: date, date, label: String(day) })
  }
  while (cells.length % 7 !== 0) cells.push({ key: `blank-end-${cells.length}`, date: null, label: '' })
  const weeks = []
  for (let index = 0; index < cells.length; index += 7) {
    const days = cells.slice(index, index + 7)
    const pnl = days.reduce((sum, day) => sum + (day.date ? dayMap.get(day.date)?.pnl || 0 : 0), 0)
    weeks.push({ days, pnl })
  }
  return weeks
}
