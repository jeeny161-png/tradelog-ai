'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
}

type CalendarDay = {
  date: Date
  key: string
  inMonth: boolean
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarPage() {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadMonth = async () => {
      setLoading(true)
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      if (!userId) {
        if (mounted) {
          setTrades([])
          setLoading(false)
        }
        return
      }

      const monthStart = formatDate(startOfMonth(monthCursor))
      const monthEnd = formatDate(addMonths(startOfMonth(monthCursor), 1))
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .gte('date', monthStart)
        .lt('date', monthEnd)
        .order('date', { ascending: true })

      if (mounted) {
        setTrades(data || [])
        setLoading(false)
      }
    }

    void loadMonth()

    return () => {
      mounted = false
    }
  }, [monthCursor])

  const tradesByDate = useMemo(() => {
    return trades.reduce<Record<string, Trade[]>>((acc, trade) => {
      const key = trade.date.slice(0, 10)
      acc[key] = [...(acc[key] || []), trade]
      return acc
    }, {})
  }, [trades])

  const dailyPnl = useMemo(() => {
    return Object.fromEntries(
      Object.entries(tradesByDate).map(([date, items]) => [date, items.reduce((sum, trade) => sum + trade.pnl, 0)])
    ) as Record<string, number>
  }, [tradesByDate])

  const weeks = useMemo(() => buildCalendarWeeks(monthCursor), [monthCursor])
  const selectedTrades = selectedDate ? tradesByDate[selectedDate] || [] : []
  const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0)
  const winRate = trades.length ? Math.round((trades.filter((trade) => trade.pnl > 0).length / trades.length) * 100) : 0
  const tradingDays = Object.keys(tradesByDate).length
  const dailyValues = Object.entries(dailyPnl)
  const bestDay = dailyValues.length ? dailyValues.reduce((best, current) => current[1] > best[1] ? current : best) : null
  const worstDay = dailyValues.length ? dailyValues.reduce((worst, current) => current[1] < worst[1] ? current : worst) : null

  return (
    <div className="min-h-screen bg-[#0f1117] text-white lg:flex">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#1a1f2e] lg:flex">
        <div className="border-b border-white/[0.06] px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-black shadow-lg shadow-amber-500/30">T</div>
            <span className="text-sm font-semibold leading-tight text-slate-100">TradeLog AI</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
            <span>□</span>
            Dashboard
          </Link>
          <Link href="/calendar" className="flex min-h-11 items-center gap-3 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm font-medium text-amber-400">
            <span>◫</span>
            Calendar
          </Link>
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden pb-8 lg:h-screen lg:overflow-y-auto">
        <header className="border-b border-white/[0.04] px-4 pb-5 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mb-4 flex items-center gap-2 lg:hidden">
            <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#1a1f2e] text-slate-300">‹</Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-black">T</div>
              <span className="text-sm font-semibold text-slate-100">TradeLog AI</span>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">PnL Calendar</h1>
              <p className="mt-0.5 text-sm text-slate-500">Daily and weekly trading performance by month.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setMonthCursor(addMonths(monthCursor, -1))} className="min-h-11 rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 text-sm text-slate-300 transition-colors hover:bg-white/[0.04]">
                Previous
              </button>
              <button onClick={() => setMonthCursor(startOfMonth(new Date()))} className="min-h-11 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/20">
                Today
              </button>
              <button onClick={() => setMonthCursor(addMonths(monthCursor, 1))} className="min-h-11 rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 text-sm text-slate-300 transition-colors hover:bg-white/[0.04]">
                Next
              </button>
            </div>
          </div>
        </header>

        <section className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-100">{monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
            <span className="text-sm text-slate-500">{loading ? 'Loading trades...' : `${trades.length} trades this month`}</span>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <SummaryCard label="Total PnL" value={formatPnl(totalPnl)} positive={totalPnl >= 0} />
            <SummaryCard label="Win Rate" value={`${winRate}%`} positive={winRate >= 50} />
            <SummaryCard label="Trading Days" value={tradingDays.toLocaleString()} />
            <SummaryCard label="Best Day" value={bestDay ? `${shortDate(bestDay[0])} ${formatPnl(bestDay[1])}` : '-'} positive />
            <SummaryCard label="Worst Day" value={worstDay ? `${shortDate(worstDay[0])} ${formatPnl(worstDay[1])}` : '-'} positive={false} />
          </div>

          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1f2e]">
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_72px] border-b border-white/[0.06] bg-[#111522] sm:grid-cols-[repeat(7,minmax(0,1fr))_110px]">
              {dayLabels.map((day) => (
                <div key={day} className="px-1 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">{day}</div>
              ))}
              <div className="px-1 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">Week</div>
            </div>

            {weeks.map((week, weekIndex) => {
              const weeklyTotal = week.reduce((sum, day) => sum + (dailyPnl[day.key] || 0), 0)

              return (
                <div key={weekIndex} className="grid grid-cols-[repeat(7,minmax(0,1fr))_72px] border-b border-white/[0.04] last:border-b-0 sm:grid-cols-[repeat(7,minmax(0,1fr))_110px]">
                  {week.map((day) => {
                    const dayPnl = dailyPnl[day.key] || 0
                    const dayTrades = tradesByDate[day.key] || []
                    const tone = dayTrades.length === 0 ? 'bg-[#151a27] text-slate-500' : dayPnl >= 0 ? 'bg-emerald-500/12 text-emerald-300' : 'bg-red-500/12 text-red-300'

                    return (
                      <button key={day.key} onClick={() => setSelectedDate(day.key)} className={`min-h-20 border-r border-white/[0.04] p-2 text-left transition-colors hover:bg-white/[0.05] sm:min-h-28 sm:p-3 ${day.inMonth ? tone : 'bg-[#111522] text-slate-700'}`}>
                        <div className="flex min-w-0 items-center justify-between gap-1">
                          <span className={`text-xs font-semibold sm:text-sm ${day.key === formatDate(new Date()) ? 'rounded-full bg-amber-400 px-1.5 py-0.5 text-black' : ''}`}>{day.date.getDate()}</span>
                          {dayTrades.length > 0 && <span className="text-[10px] text-slate-500">{dayTrades.length}</span>}
                        </div>
                        <div className={`mt-3 break-words font-mono text-xs font-bold sm:text-sm ${dayPnl > 0 ? 'text-emerald-300' : dayPnl < 0 ? 'text-red-300' : 'text-slate-600'}`}>
                          {dayTrades.length ? formatPnl(dayPnl) : '-'}
                        </div>
                      </button>
                    )
                  })}
                  <div className={`flex min-h-20 items-center justify-center px-2 text-center font-mono text-xs font-bold sm:min-h-28 sm:text-sm ${weeklyTotal > 0 ? 'text-emerald-400' : weeklyTotal < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                    {weeklyTotal !== 0 ? formatPnl(weeklyTotal) : '-'}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {selectedDate && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDate(null)}>
          <aside className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-2xl border border-white/[0.08] bg-[#151a27] p-4 shadow-2xl sm:left-auto sm:top-0 sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{selectedDate}</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedTrades.length} trades · {formatPnl(selectedTrades.reduce((sum, trade) => sum + trade.pnl, 0))}</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]">X</button>
            </div>

            <div className="space-y-3">
              {selectedTrades.length === 0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-[#0f1117] p-6 text-center text-sm text-slate-500">No trades on this date.</div>
              ) : selectedTrades.map((trade) => (
                <div key={trade.id} className="rounded-xl border border-white/[0.06] bg-[#0f1117] p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words text-sm font-semibold text-slate-100">{trade.symbol}</div>
                      <div className="mt-1 break-words text-xs text-slate-500">{trade.direction === 'L' ? 'Long' : 'Short'} · {trade.quantity} lot · {trade.emotion}</div>
                    </div>
                    <div className={`shrink-0 break-all text-right font-mono text-sm font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPnl(trade.pnl)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div className="rounded-lg bg-white/[0.03] p-3">
                      <div>Entry</div>
                      <div className="mt-1 break-all font-mono text-slate-300">{trade.entry_price}</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] p-3">
                      <div>Exit</div>
                      <div className="mt-1 break-all font-mono text-slate-300">{trade.exit_price}</div>
                    </div>
                  </div>
                  {(trade.rationale || trade.notes) && (
                    <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
                      {trade.rationale && <p className="break-words">{trade.rationale}</p>}
                      {trade.notes && <p className="break-words text-slate-500">{trade.notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const valueClass = positive === undefined ? 'text-slate-100' : positive ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4">
      <div className="mb-2 break-words text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`break-words text-lg font-bold ${valueClass}`}>{value}</div>
    </div>
  )
}

function buildCalendarWeeks(month: Date): CalendarDay[][] {
  const firstDay = startOfMonth(month)
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 6 }, (_, weekIndex) => (
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex)
      return {
        date,
        key: formatDate(date),
        inMonth: date.getMonth() === month.getMonth(),
      }
    })
  ))
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shortDate(date: string) {
  return date.slice(5)
}

function formatPnl(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString()}`
}
