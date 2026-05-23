'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'jeeny161@gmail.com'

type Share = {
  id: string
  user_id: string
  user_email: string
  created_at: string
}

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

export default function AdminPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [shares, setShares] = useState<Share[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [tradesLoading, setTradesLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email || null
      setUserEmail(email)
      if (email === ADMIN_EMAIL) loadShares()
      setLoading(false)
    })
  }, [])

  const loadShares = async () => {
    const { data } = await supabase
      .from('shares')
      .select('id, user_id, user_email, created_at')
      .eq('coach_email', ADMIN_EMAIL)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setShares(data || [])
  }

  const loadTrades = async (userId: string, email: string) => {
    setSelectedUserId(userId)
    setSelectedUserEmail(email)
    setTradesLoading(true)
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setTrades(data || [])
    setTradesLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-slate-500 text-sm">로딩 중...</div>
      </div>
    )
  }

  if (userEmail !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">🚫</div>
          <div className="text-slate-400 text-sm">접근 권한이 없습니다.</div>
          <a href="/" className="text-amber-400 text-xs mt-3 block hover:underline">홈으로 돌아가기</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <div className="flex h-screen">

        {/* Sidebar — 공유 유저 목록 */}
        <aside className="w-72 flex-shrink-0 bg-[#1a1f2e] border-r border-white/[0.06] flex flex-col">
          <div className="px-5 py-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-black text-sm">A</div>
              <div>
                <div className="text-sm font-semibold text-slate-100">관리자 대시보드</div>
                <div className="text-[10px] text-amber-400/70">TradeLog AI Coach</div>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">공유 중인 유저</div>
            <div className="text-xs text-slate-400">{shares.length}명</div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {shares.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-600 text-xs">공유 중인 유저가 없습니다</div>
            ) : (
              shares.map(share => (
                <button key={share.id}
                  onClick={() => void loadTrades(share.user_id, share.user_email)}
                  className={`w-full text-left px-5 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.03] ${
                    selectedUserId === share.user_id ? 'bg-amber-500/10' : ''
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold flex-shrink-0">
                      {share.user_email?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-200 truncate">{share.user_email}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {new Date(share.created_at).toLocaleDateString('ko-KR')} 공유
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-4 border-t border-white/[0.06]">
            <a href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← 대시보드로</a>
          </div>
        </aside>

        {/* Main — 선택 유저 일지 */}
        <main className="flex-1 overflow-y-auto">
          {!selectedUserId ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-slate-600">
                <div className="text-4xl mb-3">👈</div>
                <div className="text-sm">좌측에서 유저를 선택하세요</div>
              </div>
            </div>
          ) : (
            <>
              <div className="px-8 pt-8 pb-6 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-sm text-amber-400 font-bold">
                    {selectedUserEmail?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-slate-100">{selectedUserEmail}</h1>
                    <p className="text-slate-500 text-xs mt-0.5">{trades.length}개의 거래 기록</p>
                  </div>
                </div>
              </div>

              {tradesLoading ? (
                <div className="px-8 py-12 text-center text-slate-600 text-sm">불러오는 중...</div>
              ) : trades.length === 0 ? (
                <div className="px-8 py-12 text-center text-slate-600 text-sm">거래 기록이 없습니다</div>
              ) : (
                <div className="px-8 py-6">
                  {/* 통계 */}
                  {(() => {
                    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
                    const winRate = Math.round(trades.filter(t => t.pnl > 0).length / trades.length * 100)
                    return (
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        {[
                          { label: '총 거래', value: `${trades.length}건`, accent: 'amber' },
                          { label: '승률', value: `${winRate}%`, accent: winRate >= 50 ? 'emerald' : 'red' },
                          { label: '총 손익', value: `${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()} USD`, accent: totalPnl >= 0 ? 'emerald' : 'red' },
                        ].map(item => (
                          <div key={item.label} className="bg-[#1a1f2e] rounded-xl p-4 border border-white/[0.06]">
                            <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">{item.label}</div>
                            <div className={`text-xl font-bold ${
                              item.accent === 'amber' ? 'text-slate-100' :
                              item.accent === 'emerald' ? 'text-emerald-400' : 'text-red-400'
                            }`}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {/* 일지 목록 */}
                  <div className="space-y-2">
                    {trades.map(t => (
                      <div key={t.id} className="bg-[#1a1f2e] rounded-xl border border-white/[0.06] p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            t.direction === 'L' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {t.direction}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm text-slate-200">{t.symbol}</span>
                              <span className={`font-bold text-sm font-mono ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {t.pnl >= 0 ? '+' : ''}{t.pnl.toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mb-2">
                              {t.date} · 진입 {t.entry_price} → 청산 {t.exit_price} · {t.quantity}계약 · {t.emotion}
                            </div>
                            {t.rationale && (
                              <div className="text-xs text-slate-400 bg-[#0f1117] rounded-lg px-3 py-2 mb-1">
                                <span className="text-slate-500">근거 </span>{t.rationale}
                              </div>
                            )}
                            {t.notes && (
                              <div className="text-xs text-slate-400 bg-[#0f1117] rounded-lg px-3 py-2">
                                <span className="text-slate-500">메모 </span>{t.notes}
                              </div>
                            )}
                            {t.chart_image_url && (
                              <img src={t.chart_image_url} alt="차트" className="mt-2 rounded-lg w-full max-h-48 object-cover border border-white/[0.06]" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
