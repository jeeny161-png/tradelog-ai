'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { supabase } from '@/lib/supabase'

type Group = {
  id: string
  name: string
  owner_id: string
  invite_code: string
  created_at: string
}

type Member = {
  group_id: string
  user_id: string
  role: string
  joined_at: string
}

type RankingRow = {
  user_id: string
  pnl: number
  basis: number
  trades: number
}

export default function CommunityPage() {
  const [tab, setTab] = useState<'groups' | 'ranking'>('groups')
  const [userId, setUserId] = useState('')
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [groupInsights, setGroupInsights] = useState('')
  const [groupLoading, setGroupLoading] = useState(false)
  const [rankingMode, setRankingMode] = useState<'global' | 'group'>('global')
  const [rankingRows, setRankingRows] = useState<RankingRow[]>([])
  const [optIn, setOptIn] = useState(false)

  const loadGroups = useCallback(async (uid: string) => {
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', uid)
    const ids = (memberships || []).map((item) => item.group_id)
    if (!ids.length) {
      setGroups([])
      setSelectedGroup(null)
      setMembers([])
      return
    }
    const { data } = await supabase.from('groups').select('*').in('id', ids).order('created_at', { ascending: false })
    const nextGroups = (data || []) as Group[]
    setGroups(nextGroups)
    setSelectedGroup((current) => current && nextGroups.some((group) => group.id === current.id) ? current : nextGroups[0] || null)
  }, [])

  const loadRanking = useCallback(async (mode: 'global' | 'group', uid = userId) => {
    setRankingMode(mode)
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
      setRankingRows([])
      return
    }

    const { data } = await supabase
      .from('trades')
      .select('user_id, pnl, entry_price, quantity')
      .in('user_id', ids)
      .gte('date', monthStart)

    const grouped = new Map<string, RankingRow>()
    for (const trade of data || []) {
      const current = grouped.get(trade.user_id) || { user_id: trade.user_id, pnl: 0, basis: 0, trades: 0 }
      current.pnl += Number(trade.pnl) || 0
      current.basis += Math.abs(Number(trade.entry_price || 0) * Number(trade.quantity || 1))
      current.trades += 1
      grouped.set(trade.user_id, current)
    }
    setRankingRows([...grouped.values()])
  }, [userId])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || ''
      setUserId(uid)
      if (!uid) return
      const { data: profile } = await supabase.from('profiles').select('plan, ranking_opt_in').eq('id', uid).single()
      setPlan((profile?.plan as 'free' | 'pro') || 'free')
      setOptIn(Boolean(profile?.ranking_opt_in))
      await loadGroups(uid)
      await loadRanking('global', uid)
    })
  }, [loadGroups, loadRanking])

  useEffect(() => {
    if (selectedGroup) {
      supabase.from('group_members').select('*').eq('group_id', selectedGroup.id).then(({ data }) => setMembers((data || []) as Member[]))
    }
  }, [selectedGroup])

  const createGroup = async () => {
    if (plan !== 'pro') return alert('그룹 생성은 Pro 플랜에서 사용할 수 있습니다.')
    if (!groupName.trim() || !userId) return
    const code = crypto.randomUUID().slice(0, 8).toUpperCase()
    const { data, error } = await supabase
      .from('groups')
      .insert({ name: groupName.trim(), owner_id: userId, invite_code: code })
      .select('*')
      .single()
    if (error) return alert(error.message)
    await supabase.from('group_members').insert({ group_id: data.id, user_id: userId, role: 'owner' })
    setGroupName('')
    await loadGroups(userId)
  }

  const joinGroup = async () => {
    if (!inviteCode.trim() || !userId) return
    const { data: group, error } = await supabase.from('groups').select('*').eq('invite_code', inviteCode.trim().toUpperCase()).single()
    if (error || !group) return alert('그룹을 찾을 수 없습니다.')
    const { error: joinError } = await supabase.from('group_members').upsert({ group_id: group.id, user_id: userId, role: 'member' })
    if (joinError) return alert(joinError.message)
    setInviteCode('')
    await loadGroups(userId)
  }

  const analyzeGroup = async () => {
    if (!selectedGroup) return
    setGroupLoading(true)
    setGroupInsights('')
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/ai/group-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ groupId: selectedGroup.id }),
    })
    const data = await response.json()
    setGroupInsights(data.insights || data.error || '분석에 실패했습니다.')
    setGroupLoading(false)
  }

  const updateOptIn = async (checked: boolean) => {
    if (!userId) return
    setOptIn(checked)
    await supabase.from('profiles').upsert({ id: userId, ranking_opt_in: checked })
    await loadRanking(rankingMode, userId)
  }

  const ranking = useMemo(() => {
    return rankingRows
      .map((row) => ({ ...row, profitPct: row.basis ? (row.pnl / row.basis) * 100 : row.pnl }))
      .sort((a, b) => b.profitPct - a.profitPct)
      .slice(0, 10)
  }, [rankingRows])

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5">
          <h1 className="text-2xl font-bold text-slate-100">커뮤니티</h1>
          <p className="mt-1 text-sm text-slate-500">스터디 그룹과 익명 월간 랭킹을 확인합니다.</p>
        </header>

        <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-1">
          <button onClick={() => setTab('groups')} className={`min-h-11 rounded-lg text-sm font-bold ${tab === 'groups' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>그룹</button>
          <button onClick={() => setTab('ranking')} className={`min-h-11 rounded-lg text-sm font-bold ${tab === 'ranking' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>랭킹</button>
        </div>

        {tab === 'groups' ? (
          <div className="space-y-5">
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4">
                <h2 className="mb-3 font-bold text-slate-100">그룹 만들기</h2>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="field-input" placeholder="그룹 이름" />
                  <button onClick={createGroup} className="min-h-11 rounded-xl bg-amber-500 px-5 text-sm font-bold text-black">생성</button>
                </div>
                {plan !== 'pro' && <p className="mt-2 text-sm text-red-400">Pro 플랜 전용 기능입니다.</p>}
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4">
                <h2 className="mb-3 font-bold text-slate-100">초대 코드로 참가</h2>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} className="field-input uppercase" placeholder="INVITE CODE" />
                  <button onClick={joinGroup} className="min-h-11 rounded-xl bg-white/[0.08] px-5 text-sm font-bold text-slate-200">참가</button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-3">
                {groups.map((group) => (
                  <button key={group.id} onClick={() => setSelectedGroup(group)} className={`mb-2 min-h-16 w-full rounded-xl p-3 text-left ${selectedGroup?.id === group.id ? 'bg-amber-500/15 text-amber-400' : 'bg-[#0f1117] text-slate-300'}`}>
                    <div className="break-words font-semibold">{group.name}</div>
                    <div className="mt-1 text-xs text-slate-500">코드 {group.invite_code}</div>
                  </button>
                ))}
                {!groups.length && <div className="p-5 text-sm text-slate-500">아직 참가한 그룹이 없습니다.</div>}
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">{selectedGroup?.name || '그룹 선택'}</h2>
                    {selectedGroup && <p className="text-sm text-slate-500">초대 코드 {selectedGroup.invite_code}</p>}
                  </div>
                  <button onClick={analyzeGroup} disabled={!selectedGroup || groupLoading} className="min-h-11 rounded-xl bg-amber-500 px-5 text-sm font-bold text-black disabled:opacity-50">
                    {groupLoading ? '분석 중...' : 'AI 그룹 패턴 분석'}
                  </button>
                </div>
                <div className="mb-5 grid gap-2 sm:grid-cols-2">
                  {members.map((member) => (
                    <div key={member.user_id} className="rounded-xl bg-[#0f1117] p-3 text-sm text-slate-400">
                      {member.user_id.slice(0, 8)} · {member.role}
                    </div>
                  ))}
                </div>
                {groupInsights && <div className="whitespace-pre-line break-words rounded-xl bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-300">{groupInsights}</div>}
              </div>
            </section>
          </div>
        ) : (
          <section className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 rounded-xl bg-[#0f1117] p-1 sm:w-80">
                <button onClick={() => void loadRanking('global')} className={`min-h-11 rounded-lg text-sm font-bold ${rankingMode === 'global' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>글로벌</button>
                <button onClick={() => void loadRanking('group')} className={`min-h-11 rounded-lg text-sm font-bold ${rankingMode === 'group' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>그룹</button>
              </div>
              <label className="flex min-h-11 items-center gap-3 rounded-xl bg-[#0f1117] px-4 text-sm text-slate-300">
                <input type="checkbox" checked={optIn} onChange={(event) => void updateOptIn(event.target.checked)} />
                랭킹 참여
              </label>
            </div>
            <div className="space-y-3">
              {ranking.map((row, index) => (
                <div key={row.user_id} className="grid grid-cols-[54px_1fr_auto] items-center gap-3 rounded-xl bg-[#0f1117] p-4">
                  <div className="text-xl font-black text-amber-400">#{index + 1}</div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-slate-100">Trader {row.user_id.slice(0, 4).toUpperCase()}</div>
                    <div className="mt-1 text-sm text-slate-500">{row.trades} trades · PnL {row.pnl >= 0 ? '+' : ''}{row.pnl.toLocaleString()}</div>
                  </div>
                  <div className="font-mono font-bold text-emerald-400">{row.profitPct.toFixed(2)}%</div>
                </div>
              ))}
              {!ranking.length && <div className="rounded-xl bg-[#0f1117] p-8 text-center text-sm text-slate-500">이번 달 랭킹 데이터가 없습니다.</div>}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  )
}
