'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { emotionOptions, getEmotionLabel, useLanguage } from '@/lib/i18n'
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
  mt5_ticket?: string | null
  gross_pnl?: number | null
  swap?: number | null
  commission?: number | null
}

type DayBucket = {
  date: string
  pnl: number
  trades: Trade[]
}

export default function HistoryPage() {
  const { language } = useLanguage()
  const [tab, setTab] = useState<'list' | 'calendar'>('list')
  const [userId, setUserId] = useState('')
  const [trades, setTrades] = useState<Trade[]>([])
  const [month, setMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<DayBucket | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [editEmotion, setEditEmotion] = useState('Calm')
  const [editRationale, setEditRationale] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editChartFile, setEditChartFile] = useState<File | null>(null)
  const [editChartPreview, setEditChartPreview] = useState('')
  const [aiResult, setAiResult] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

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

  const openEdit = (trade: Trade) => {
    setEditingTrade(trade)
    setEditEmotion(trade.emotion || 'Calm')
    setEditRationale(trade.rationale || '')
    setEditNotes(trade.notes || '')
    setEditChartFile(null)
    setEditChartPreview(trade.chart_image_url || '')
  }

  const saveEdit = async () => {
    if (!editingTrade || !userId) return
    setSavingEdit(true)
    const chartUrl = editChartFile ? await uploadChart(editChartFile, userId) : editChartPreview || null
    const { error } = await supabase
      .from('trades')
      .update({
        emotion: editEmotion,
        rationale: editRationale,
        notes: editNotes,
        chart_image_url: chartUrl,
      })
      .eq('id', editingTrade.id)
      .eq('user_id', userId)
    setSavingEdit(false)
    if (error) return alert(error.message)
    setEditingTrade(null)
    await loadTrades(userId)
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
                    <div className="break-words font-semibold text-slate-100">{trade.symbol} {trade.mt5_ticket && <span className="text-xs text-slate-500">MT5</span>}</div>
                    <div className="mt-1 break-words text-sm text-slate-500">{trade.date} · {getEmotionLabel(trade.emotion, language)} · {trade.quantity} lot</div>
                    {(trade.rationale || trade.notes) && <p className="mt-2 line-clamp-2 break-words text-sm text-slate-400">{trade.rationale || trade.notes}</p>}
                  </div>
                  <div className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatSigned(trade.pnl)}</div>
                </div>
                <PnlBreakdown trade={trade} />
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <button className="min-h-11 rounded-xl bg-white/[0.06] text-sm font-semibold text-slate-300" onClick={() => openEdit(trade)}>편집</button>
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
          <section className="rounded-xl border border-[#1a1f2e] bg-[#0f1117] p-3 sm:p-5">
            <div className="mb-5 flex items-center justify-center gap-5">
              <button onClick={() => changeMonth(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#1a1f2e] text-xl text-slate-300 hover:bg-[#1a1f2e]" aria-label="Previous month">‹</button>
              <h2 className="min-w-36 text-center font-mono text-2xl font-bold text-slate-100 sm:text-3xl">
                {month.getFullYear()}/{String(month.getMonth() + 1).padStart(2, '0')}
              </h2>
              <button onClick={() => changeMonth(1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#1a1f2e] text-xl text-slate-300 hover:bg-[#1a1f2e]" aria-label="Next month">›</button>
            </div>

            <MonthSummary buckets={[...dayMap.values()]} />

            <div className="mt-5 overflow-x-auto rounded-xl border border-[#1a1f2e]">
              <div className="min-w-[720px]">
              <div className="grid grid-cols-[repeat(7,minmax(86px,1fr))_86px] bg-[#0f1117] text-center text-[11px] font-semibold text-slate-500 sm:grid-cols-[repeat(7,minmax(96px,1fr))_96px] sm:text-xs lg:grid-cols-[repeat(7,minmax(0,1fr))_112px]">
                {['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map((day) => <div key={day} className="border-r border-[#1a1f2e] px-1 py-3 last:border-r-0">{day}</div>)}
                <div className="px-1 py-3 text-amber-400">주간 합계</div>
              </div>
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-[repeat(7,minmax(86px,1fr))_86px] border-t border-[#1a1f2e] sm:grid-cols-[repeat(7,minmax(96px,1fr))_96px] lg:grid-cols-[repeat(7,minmax(0,1fr))_112px]">
                  {week.days.map((day) => {
                    const bucket = day.date ? dayMap.get(day.date) : undefined
                    const isToday = day.date === new Date().toISOString().slice(0, 10)
                    return (
                      <button key={day.key} disabled={!day.date} onClick={() => bucket && setSelectedDay(bucket)} className={`relative min-h-[70px] min-w-0 border-r border-[#1a1f2e] bg-[#0f1117] p-2 text-left transition-colors hover:bg-[#151926] sm:min-h-24 sm:p-3 ${isToday ? 'ring-1 ring-inset ring-amber-500/30' : ''}`}>
                        <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold text-slate-500 sm:text-xs">
                          <span>{day.label}</span>
                          {bucket?.trades.some((trade) => trade.mt5_ticket) && <span className="text-amber-400">⇌</span>}
                        </div>
                        {bucket && (
                          <div className={`absolute inset-x-2 top-1/2 -translate-y-1/2 truncate whitespace-nowrap break-normal text-center font-mono text-base font-bold leading-none sm:text-xl lg:text-2xl ${bucket.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                            {formatSigned(bucket.pnl)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                  <div className="flex min-h-[70px] min-w-0 flex-col items-center justify-center border-r border-[#1a1f2e] bg-[#0f1117] p-2 text-center sm:min-h-24">
                    <div className="text-xs font-semibold text-slate-500">W{weekIndex + 1}</div>
                    <span className={`mt-2 max-w-full truncate whitespace-nowrap break-normal font-mono text-xs font-bold sm:text-sm ${week.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{formatSigned(week.pnl)}</span>
                  </div>
                </div>
              ))}
              </div>
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
                    <div className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatSigned(trade.pnl)}</div>
                  </div>
                  <PnlBreakdown trade={trade} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingTrade && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 lg:p-8" onClick={() => setEditingTrade(null)}>
          <div className="mx-auto max-h-full max-w-2xl overflow-y-auto rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">거래 편집</h3>
                <p className="mt-1 text-sm text-slate-500">MT5 거래의 가격, 종목, 손익은 잠겨 있고 복기 정보만 수정할 수 있습니다.</p>
              </div>
              <button onClick={() => setEditingTrade(null)} className="min-h-11 rounded-xl px-3 text-slate-400">닫기</button>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="종목" value={editingTrade.symbol} />
              <ReadOnlyField label="방향" value={editingTrade.direction} />
              <ReadOnlyField label="진입가" value={String(editingTrade.entry_price)} />
              <ReadOnlyField label="청산가" value={String(editingTrade.exit_price)} />
              <ReadOnlyField label="순손익" value={formatMoney(editingTrade.pnl)} />
              <ReadOnlyField label="MT5 Ticket" value={editingTrade.mt5_ticket || '-'} />
            </div>

            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">감정</span>
                <select className="field-input" value={editEmotion} onChange={(event) => setEditEmotion(event.target.value)}>
                  {emotionOptions.map((item) => <option key={item.value} value={item.value}>{item[language]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">매매 근거</span>
                <textarea className="field-input min-h-28" value={editRationale} onChange={(event) => setEditRationale(event.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">메모</span>
                <textarea className="field-input min-h-28" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
              </label>
              <label className="flex min-h-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-[#0f1117] px-4 text-sm text-slate-400">
                <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setEditChartFile(file)
                  const reader = new FileReader()
                  reader.onload = (readerEvent) => setEditChartPreview(String(readerEvent.target?.result || ''))
                  reader.readAsDataURL(file)
                }} />
                차트 이미지 업로드
              </label>
              {editChartPreview && <img src={editChartPreview} alt="Chart preview" className="max-h-72 w-full rounded-xl object-cover" />}
            </div>

            <button onClick={saveEdit} disabled={savingEdit} className="mt-5 min-h-11 w-full rounded-xl bg-amber-500 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50">
              {savingEdit ? '저장 중...' : '저장'}
            </button>
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
      <SummaryCard label="이번 달 PnL" value={formatSigned(total)} tone={total >= 0 ? 'good' : 'bad'} />
      <SummaryCard label="승률" value={`${winRate}%`} />
      <SummaryCard label="거래일" value={`${buckets.length}일`} />
      <SummaryCard label="최고 / 최악" value={`${best ? formatSigned(best.pnl) : '$0.00'} / ${worst ? formatSigned(worst.pnl) : '$0.00'}`} />
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

function PnlBreakdown({ trade, compact = false }: { trade: Trade; compact?: boolean }) {
  const gross = Number(trade.gross_pnl ?? trade.pnl ?? 0)
  const swap = Number(trade.swap ?? 0)
  const commission = Number(trade.commission ?? 0)
  const net = Number(trade.pnl ?? gross + swap + commission)
  const fees = swap + commission
  return (
    <div className={`${compact ? 'mt-3' : 'mt-4'} rounded-xl bg-[#0f1117] px-3 py-2 text-sm text-slate-400`}>
      <div className={`font-semibold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        순손익 {formatMoney(net)} (수수료 {formatMoney(fees)} 포함)
      </div>
      <div className="mt-1 text-xs text-slate-500">총손익 {formatMoney(gross)} · 스왑 {formatMoney(swap)} · 수수료 {formatMoney(commission)}</div>
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0f1117] p-3">
      <div className="mb-1 text-xs text-slate-500">🔒 {label}</div>
      <div className="break-words font-semibold text-slate-200">{value}</div>
    </div>
  )
}

async function uploadChart(file: File, uid: string) {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${uid}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('charts').upload(path, file, { upsert: false })
  if (error) return null
  const { data } = supabase.storage.from('charts').getPublicUrl(path)
  return data.publicUrl
}

function formatSigned(value: number) {
  return formatMoney(value)
}

function formatMoney(value: number) {
  const numeric = Number(value) || 0
  const sign = numeric > 0 ? '+' : numeric < 0 ? '-' : ''
  return `${sign}$${Math.abs(numeric).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
