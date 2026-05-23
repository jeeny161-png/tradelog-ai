'use client'
import { useState, useEffect, useRef } from 'react'
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

export default function Home() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [symbol, setSymbol] = useState('XAUUSD')
  const [direction, setDirection] = useState<'L' | 'S'>('L')
  const [entry, setEntry] = useState('')
  const [exit, setExit] = useState('')
  const [qty, setQty] = useState('1')
  const [emotion, setEmotion] = useState('차분')
  const [rationale, setRationale] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    console.log('로그아웃 클릭')
    supabase.auth.signOut().then(() => {
      console.log('signOut 완료')
      window.location.replace('/login')
    }).catch((err) => {
      console.error('signOut 에러:', err)
      window.location.replace('/login')
    })
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
      setUserEmail(data.user?.email || null)
      loadTrades(data.user?.id || null)
    })
  }, [])

  const loadTrades = async (uid?: string | null) => {
    const id = uid ?? userId
    if (!id) return
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
    setTrades(data || [])
  }

  const pnl = entry && exit
    ? Math.round((parseFloat(exit) - parseFloat(entry)) * (direction === 'L' ? 1 : -1) * parseFloat(qty) * 100)
    : 0

  const addTrade = async () => {
    if (!entry || !exit) return alert('진입가와 청산가를 입력하세요')
    if (!userId) return alert('로그인이 필요합니다')
    setLoading(true)
    const { error } = await supabase.from('trades').insert({
      symbol, direction,
      entry_price: parseFloat(entry),
      exit_price: parseFloat(exit),
      quantity: parseFloat(qty),
      pnl, emotion, rationale, notes,
      user_id: userId,
      date: new Date().toISOString().split('T')[0]
    })
    if (error) alert('저장 실패: ' + error.message)
    else {
      setEntry(''); setExit(''); setRationale(''); setNotes('')
      loadTrades()
    }
    setLoading(false)
  }

  const analyze = async (trade: Trade) => {
    setSelectedTrade(trade)
    setAiResult('')
    setAiLoading(true)
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade)
    })
    const data = await res.json()
    setAiResult(data.text || data.error || '분석 실패')
    setAiLoading(false)
  }

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const winRate = trades.length
    ? Math.round(trades.filter(t => t.pnl > 0).length / trades.length * 100)
    : 0

  return (
    <div className="flex h-screen bg-[#0f1117] text-white overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 bg-[#1a1f2e] border-r border-white/[0.06] flex flex-col">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-black text-sm shadow-lg shadow-amber-500/30">
              T
            </div>
            <div className="text-sm font-semibold leading-tight text-slate-100">TradeLog AI</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium cursor-default">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
            </svg>
            대시보드
          </div>

          <button
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 text-sm hover:bg-white/[0.04] hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            새 일지 작성
          </button>

          <button
            onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 text-sm hover:bg-white/[0.04] hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            거래 기록
          </button>
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          {userEmail && (
            <div className="px-3 py-2 mb-1 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] text-amber-400 font-bold flex-shrink-0">
                {userEmail[0].toUpperCase()}
              </div>
              <div className="text-xs text-slate-500 truncate">{userEmail}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 text-sm hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto">

        {/* Page Header */}
        <div className="px-8 pt-8 pb-6 border-b border-white/[0.04]">
          <h1 className="text-xl font-semibold text-slate-100">대시보드</h1>
          <p className="text-slate-500 text-sm mt-0.5">금 선물 트레이딩 기록 및 AI 분석</p>
        </div>

        {/* Stats Cards */}
        <div className="px-8 py-6 grid grid-cols-3 gap-4">
          <div className="relative bg-[#1a1f2e] rounded-xl p-5 border border-white/[0.06] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent" />
            <div className="relative">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-3">총 거래</div>
              <div className="text-3xl font-bold text-slate-100">{trades.length}</div>
              <div className="text-xs text-slate-600 mt-1">건</div>
            </div>
          </div>

          <div className="relative bg-[#1a1f2e] rounded-xl p-5 border border-white/[0.06] overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${winRate >= 50 ? 'from-emerald-500/10' : 'from-red-500/10'} via-transparent to-transparent`} />
            <div className="relative">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-3">승률</div>
              <div className={`text-3xl font-bold ${winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{winRate}</div>
              <div className="text-xs text-slate-600 mt-1">%</div>
            </div>
          </div>

          <div className="relative bg-[#1a1f2e] rounded-xl p-5 border border-white/[0.06] overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${totalPnl >= 0 ? 'from-emerald-500/10' : 'from-red-500/10'} via-transparent to-transparent`} />
            <div className="relative">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-3">총 손익</div>
              <div className={`text-3xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()}
              </div>
              <div className="text-xs text-slate-600 mt-1">USD</div>
            </div>
          </div>
        </div>

        {/* Trade Form */}
        <div className="px-8 pb-6" ref={formRef}>
          <div className="bg-[#1a1f2e] rounded-xl border border-white/[0.06] p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-1 h-4 rounded-full bg-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">새 일지 작성</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">종목</label>
                <input
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">방향</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDirection('L')}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                      direction === 'L'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#0f1117] border border-white/[0.08] text-slate-400 hover:border-white/[0.15]'
                    }`}
                  >
                    ↑ 롱
                  </button>
                  <button
                    onClick={() => setDirection('S')}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                      direction === 'S'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-[#0f1117] border border-white/[0.08] text-slate-400 hover:border-white/[0.15]'
                    }`}
                  >
                    ↓ 숏
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">진입가</label>
                <input
                  value={entry}
                  onChange={e => setEntry(e.target.value)}
                  type="number" placeholder="3300.00"
                  className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">청산가</label>
                <input
                  value={exit}
                  onChange={e => setExit(e.target.value)}
                  type="number" placeholder="3320.00"
                  className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">수량</label>
                <input
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  type="number" step="0.01" min="0.01"
                  className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">감정</label>
                <select
                  value={emotion}
                  onChange={e => setEmotion(e.target.value)}
                  className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                >
                  {['차분','자신감','집중','급함','당황','두려움','냉정','흥분'].map(e => (
                    <option key={e} className="bg-[#1a1f2e]">{e}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">매매 근거</label>
                <textarea
                  value={rationale}
                  onChange={e => setRationale(e.target.value)}
                  placeholder="진입 근거, 기술적 시그널 등"
                  className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors resize-none h-16"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">메모 / 복기</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="느낀 점, 아쉬운 점"
                  className="w-full bg-[#0f1117] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors resize-none h-16"
                />
              </div>
            </div>

            {/* PnL Preview */}
            <div className="flex justify-between items-center bg-[#0f1117] rounded-lg px-4 py-3 mb-4 border border-white/[0.06]">
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">예상 손익</span>
              <span className={`text-lg font-bold font-mono ${pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                {pnl !== 0 ? `${pnl > 0 ? '+' : ''}${pnl.toLocaleString()} USD` : '—'}
              </span>
            </div>

            <button
              onClick={addTrade}
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold rounded-xl py-2.5 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
            >
              {loading ? '저장 중...' : '일지 저장'}
            </button>
          </div>
        </div>

        {/* Trade List */}
        {trades.length > 0 && (
          <div className="px-8 pb-10" ref={listRef}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-1 h-4 rounded-full bg-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">거래 기록</h2>
              <span className="text-xs text-slate-600 ml-0.5">{trades.length}건</span>
            </div>

            <div className="space-y-2">
              {trades.map(t => (
                <div
                  key={t.id}
                  className="bg-[#1a1f2e] rounded-xl border border-white/[0.06] overflow-hidden hover:border-white/[0.12] transition-all duration-200"
                >
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setSelectedTrade(selectedTrade?.id === t.id ? null : t)}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      t.direction === 'L'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/20 text-red-400 border border-red-500/20'
                    }`}>
                      {t.direction}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-200">{t.symbol}</div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {t.date} · {t.direction === 'L' ? '롱' : '숏'} · {t.quantity}계약 · {t.emotion}
                      </div>
                    </div>
                    <div className={`font-bold text-sm font-mono flex-shrink-0 ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toLocaleString()}
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-600 flex-shrink-0 transition-transform duration-200 ${selectedTrade?.id === t.id ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {selectedTrade?.id === t.id && (
                    <div className="border-t border-white/[0.06] px-4 py-4 bg-[#0f1117]/60">
                      <button
                        onClick={() => analyze(t)}
                        disabled={aiLoading}
                        className="w-full flex items-center justify-center gap-2 border border-amber-500/30 text-amber-400 bg-amber-500/5 rounded-lg py-2.5 text-sm font-medium hover:bg-amber-500/10 hover:border-amber-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed mb-4"
                      >
                        <span>✦</span>
                        {aiLoading ? 'AI 분석 중...' : 'AI 분석받기'}
                      </button>
                      {aiResult && (
                        <div className="text-sm text-slate-400 whitespace-pre-line leading-relaxed bg-[#0f1117] rounded-lg p-4 border border-white/[0.06]">
                          {aiResult}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
