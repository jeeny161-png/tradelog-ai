'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'jeeny161@gmail.com'

type AdminUser = {
  id: string
  email: string
  joinDate: string
  plan: 'free' | 'pro'
  totalTrades: number
  lastActive: string
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

type AdminStats = {
  totalUsers: number
  totalTrades: number
  aiToday: number
  aiWeek: number
  aiMonth: number
  signups: { date: string; count: number }[]
}

export default function AdminPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [emailSubject, setEmailSubject] = useState('TradeLog AI 안내')
  const [emailMessage, setEmailMessage] = useState('')

  const adminFetch = useCallback(async (body?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/admin/dashboard', {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return response.json()
  }, [])

  const loadDashboard = useCallback(async () => {
    const data = await adminFetch()
    setUsers(data.users || [])
    setStats(data.stats || null)
    setLoading(false)
  }, [adminFetch])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email || null
      setUserEmail(email)
      if (email === ADMIN_EMAIL) void loadDashboard()
      else setLoading(false)
    })
  }, [loadDashboard])

  const loadTrades = async (user: AdminUser) => {
    setSelectedUser(user)
    const data = await adminFetch({ action: 'user-trades', userId: user.id })
    setTrades(data.trades || [])
  }

  const upgrade = async (user: AdminUser) => {
    await adminFetch({ action: 'upgrade-pro', userId: user.id })
    await loadDashboard()
  }

  const deleteUser = async (user: AdminUser) => {
    if (!confirm(`${user.email} 계정을 삭제할까요?`)) return
    await adminFetch({ action: 'delete-user', userId: user.id })
    setSelectedUser(null)
    setTrades([])
    await loadDashboard()
  }

  const sendEmail = async () => {
    if (!selectedUser) return
    const data = await adminFetch({
      action: 'send-email',
      email: selectedUser.email,
      subject: emailSubject,
      message: emailMessage,
    })
    if (data.error) alert(data.error)
    else {
      alert('Email sent.')
      setEmailMessage('')
    }
  }

  const maxSignup = useMemo(() => Math.max(1, ...(stats?.signups || []).map((item) => item.count)), [stats])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0f1117] text-sm text-slate-500">Loading...</div>
  }

  if (userEmail !== ADMIN_EMAIL) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 text-white">
        <div className="rounded-xl border border-white/[0.08] bg-[#1a1f2e] p-6 text-center">
          <h1 className="text-xl font-semibold">접근 권한이 없습니다.</h1>
          <Link href="/" className="mt-4 inline-flex text-sm text-amber-400">홈으로 돌아가기</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f1117] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="mb-2 inline-flex text-sm text-amber-400">← Dashboard</Link>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Service-role powered user, trade, email, and site analytics.</p>
          </div>
          <button onClick={() => void loadDashboard()} className="min-h-11 rounded-lg border border-white/[0.08] px-4 text-sm text-slate-300">Refresh</button>
        </div>

        {stats && (
          <>
            <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="Total users" value={stats.totalUsers} />
              <Stat label="Total trades" value={stats.totalTrades} />
              <Stat label="AI today" value={stats.aiToday} />
              <Stat label="AI week" value={stats.aiWeek} />
              <Stat label="AI month" value={stats.aiMonth} />
            </section>

            <section className="mb-6 rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-200">New signups chart (last 30 days)</h2>
              <div className="flex h-32 items-end gap-1">
                {stats.signups.map((item) => (
                  <div key={item.date} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-amber-500/70" style={{ height: `${(item.count / maxSignup) * 100}%` }} title={`${item.date}: ${item.count}`} />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1f2e]">
            <div className="border-b border-white/[0.06] p-4 text-sm font-semibold">Registered users</div>
            <div className="max-h-[680px] overflow-y-auto">
              {users.map((user) => (
                <button key={user.id} onClick={() => void loadTrades(user)} className={`w-full border-b border-white/[0.04] p-4 text-left hover:bg-white/[0.04] ${selectedUser?.id === user.id ? 'bg-amber-500/10' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100">{user.email}</div>
                      <div className="mt-1 text-xs text-slate-500">Joined {new Date(user.joinDate).toLocaleDateString()} · Last {new Date(user.lastActive).toLocaleDateString()}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs ${user.plan === 'pro' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.06] text-slate-400'}`}>{user.plan}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{user.totalTrades} trades</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
            {!selectedUser ? (
              <div className="py-24 text-center text-sm text-slate-500">Select a user to inspect trades and manage account.</div>
            ) : (
              <>
                <div className="mb-5 flex flex-col gap-3 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">{selectedUser.email}</h2>
                    <p className="mt-1 text-sm text-slate-500">{trades.length} trades · plan {selectedUser.plan}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void upgrade(selectedUser)} className="min-h-11 rounded-lg bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-400">Upgrade Pro</button>
                    <button onClick={() => void deleteUser(selectedUser)} className="min-h-11 rounded-lg bg-red-500/10 px-4 text-sm font-semibold text-red-400">Delete</button>
                  </div>
                </div>

                <div className="mb-5 rounded-lg border border-white/[0.06] bg-[#0f1117] p-4">
                  <h3 className="mb-3 text-sm font-semibold">Send email</h3>
                  <input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} className="field-input mb-3" />
                  <textarea value={emailMessage} onChange={(event) => setEmailMessage(event.target.value)} placeholder="Message to user" className="field-input min-h-24 resize-none" />
                  <button onClick={() => void sendEmail()} className="mt-3 min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black">Send</button>
                </div>

                <div className="space-y-3">
                  {trades.map((trade) => (
                    <div key={trade.id} className="rounded-lg border border-white/[0.06] bg-[#0f1117] p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-100">{trade.symbol} · {trade.direction}</div>
                        <div className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()}</div>
                      </div>
                      <div className="text-xs text-slate-500">{trade.date} · Entry {trade.entry_price} · Exit {trade.exit_price} · {trade.quantity}</div>
                      {(trade.rationale || trade.notes) && (
                        <div className="mt-3 whitespace-pre-line rounded bg-white/[0.03] p-3 text-sm text-slate-400">
                          {trade.rationale && `Rationale: ${trade.rationale}\n`}
                          {trade.notes && `AI/Notes: ${trade.notes}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4">
      <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-100">{value.toLocaleString()}</div>
    </div>
  )
}
