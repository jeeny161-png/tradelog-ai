'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Row = {
  user_id: string
  pnl: number
  basis: number
  trades: number
}

export default function RankingPage() {
  const [tab, setTab] = useState<'global' | 'group'>('global')
  const [rows, setRows] = useState<Row[]>([])
  const [optIn, setOptIn] = useState(false)
  const [userId, setUserId] = useState('')

  const ranking = useMemo(() => {
    return rows
      .map((row) => ({ ...row, profitPct: row.basis ? (row.pnl / row.basis) * 100 : row.pnl }))
      .sort((a, b) => b.profitPct - a.profitPct)
      .slice(0, 10)
  }, [rows])

  const loadRanking = useCallback(async (mode: 'global' | 'group', uid = userId) => {
    setTab(mode)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    const optedIn = await supabase.from('profiles').select('id').eq('ranking_opt_in', true)
    let ids = (optedIn.data || []).map((profile) => profile.id)

    if (mode === 'group' && uid) {
      const memberships = await supabase.from('group_members').select('group_id').eq('user_id', uid)
      const groupIds = (memberships.data || []).map((member) => member.group_id)
      if (groupIds.length) {
        const groupMembers = await supabase.from('group_members').select('user_id').in('group_id', groupIds)
        const memberIds = new Set((groupMembers.data || []).map((member) => member.user_id))
        ids = ids.filter((id) => memberIds.has(id))
      } else {
        ids = []
      }
    }

    if (!ids.length) {
      setRows([])
      return
    }

    const { data } = await supabase
      .from('trades')
      .select('user_id, pnl, entry_price, quantity')
      .in('user_id', ids)
      .gte('date', monthStart)

    const grouped = new Map<string, Row>()
    for (const trade of data || []) {
      const current = grouped.get(trade.user_id) || { user_id: trade.user_id, pnl: 0, basis: 0, trades: 0 }
      current.pnl += Number(trade.pnl) || 0
      current.basis += Math.abs(Number(trade.entry_price || 0) * Number(trade.quantity || 1))
      current.trades += 1
      grouped.set(trade.user_id, current)
    }
    setRows([...grouped.values()])
  }, [userId])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || ''
      setUserId(uid)
      if (!uid) return
      const { data: profile } = await supabase.from('profiles').select('ranking_opt_in').eq('id', uid).single()
      setOptIn(Boolean(profile?.ranking_opt_in))
      await loadRanking('global', uid)
    })
  }, [loadRanking])

  const updateOptIn = async (checked: boolean) => {
    if (!userId) return
    setOptIn(checked)
    await supabase.from('profiles').upsert({ id: userId, ranking_opt_in: checked })
    await loadRanking(tab, userId)
  }

  return (
    <main className="min-h-screen bg-[#0f1117] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-3 inline-flex text-sm text-amber-400">← Dashboard</Link>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Anonymous Rankings</h1>
            <p className="mt-1 text-sm text-slate-500">This month&apos;s TOP 10 by profit percentage.</p>
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 text-sm">
            <input type="checkbox" checked={optIn} onChange={(event) => void updateOptIn(event.target.checked)} />
            Opt in to ranking
          </label>
        </div>

        <div className="mb-5 flex rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-1">
          <button onClick={() => void loadRanking('global')} className={`min-h-11 flex-1 rounded-lg text-sm font-semibold ${tab === 'global' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>Global ranking</button>
          <button onClick={() => void loadRanking('group')} className={`min-h-11 flex-1 rounded-lg text-sm font-semibold ${tab === 'group' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>Group ranking</button>
        </div>

        <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1f2e]">
          {ranking.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No opted-in ranked users this month.</div>
          ) : ranking.map((row, index) => (
            <div key={row.user_id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-white/[0.04] p-4 last:border-b-0">
              <div className="text-xl font-bold text-amber-400">#{index + 1}</div>
              <div>
                <div className="font-semibold text-slate-200">Trader {row.user_id.slice(0, 4).toUpperCase()}</div>
                <div className="text-xs text-slate-500">{row.trades} trades · PnL {row.pnl >= 0 ? '+' : ''}{row.pnl.toLocaleString()}</div>
              </div>
              <div className="font-mono text-lg font-bold text-emerald-400">{row.profitPct.toFixed(2)}%</div>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
