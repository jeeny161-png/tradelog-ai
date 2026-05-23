'use client'
import { useState, useEffect } from 'react'
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
    <div className="max-w-2xl mx-auto p-6">

      {/* 헤더 */}
      <a href="/api/logout" 
        className="text-sm text-red-500 hover:text-red-700 font-medium">
        로그아웃 →
      </a>

      {/* 통계 */}
      {trades.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">총 거래</div>
            <div className="text-xl font-bold">{trades.length}건</div>
          </div>
          <div className="bg-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">승률</div>
            <div className={`text-xl font-bold ${winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>{winRate}%</div>
          </div>
          <div className="bg-gray-100 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">총 손익</div>
            <div className={`text-xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* 폼 */}
      <div className="border rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-4">새 일지 작성</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">종목</label>
            <input value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">방향</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setDirection('L')}
                className={`py-2 rounded-lg text-sm font-medium transition-colors
                  ${direction === 'L' ? 'bg-green-100 text-green-700' : 'border hover:bg-gray-50'}`}>
                ↑ 롱
              </button>
              <button onClick={() => setDirection('S')}
                className={`py-2 rounded-lg text-sm font-medium transition-colors
                  ${direction === 'S' ? 'bg-red-100 text-red-700' : 'border hover:bg-gray-50'}`}>
                ↓ 숏
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">진입가</label>
            <input value={entry} onChange={e => setEntry(e.target.value)}
              type="number" placeholder="3300.00"
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">청산가</label>
            <input value={exit} onChange={e => setExit(e.target.value)}
              type="number" placeholder="3320.00"
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">수량</label>
            <input value={qty} onChange={e => setQty(e.target.value)}
              type="number" step="0.01" min="0.01"
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">감정</label>
            <select value={emotion} onChange={e => setEmotion(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {['차분','자신감','집중','급함','당황','두려움','냉정','흥분'].map(e => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">매매 근거</label>
            <textarea value={rationale} onChange={e => setRationale(e.target.value)}
              placeholder="진입 근거, 기술적 시그널 등"
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-16" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">메모 / 복기</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="느낀 점, 아쉬운 점"
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-16" />
          </div>
        </div>

        <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3 mb-3">
          <span className="text-sm text-gray-500">예상 손익</span>
          <span className={`text-lg font-bold font-mono
            ${pnl > 0 ? 'text-green-600' : pnl < 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {pnl !== 0 ? `${pnl > 0 ? '+' : ''}${pnl.toLocaleString()} USD` : '—'}
          </span>
        </div>

        <button onClick={addTrade} disabled={loading}
          className="w-full bg-black text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
          {loading ? '저장 중...' : '일지 저장'}
        </button>
      </div>

      {/* 거래 목록 */}
      {trades.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">거래 기록</h2>
          {trades.map(t => (
            <div key={t.id} className="border rounded-xl mb-2 overflow-hidden">
              <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedTrade(selectedTrade?.id === t.id ? null : t)}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${t.direction === 'L' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {t.direction}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t.symbol}</div>
                  <div className="text-xs text-gray-400">
                    {t.date} · {t.direction === 'L' ? '롱' : '숏'} · {t.quantity}계약 · {t.emotion}
                  </div>
                </div>
                <div className={`font-bold text-sm font-mono flex-shrink-0
                  ${t.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {t.pnl >= 0 ? '+' : ''}{t.pnl.toLocaleString()}
                </div>
              </div>

              {selectedTrade?.id === t.id && (
                <div className="border-t px-4 py-3 bg-blue-50">
                  <button onClick={() => analyze(t)} disabled={aiLoading}
                    className="w-full border border-blue-200 text-blue-600 rounded-lg py-2 text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 mb-3">
                    {aiLoading ? '분석 중...' : '✦ AI 분석받기'}
                  </button>
                  {aiResult && (
                    <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                      {aiResult}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}