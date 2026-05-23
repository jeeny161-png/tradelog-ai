'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
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

export default function GroupsPage() {
  const [userId, setUserId] = useState('')
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [insights, setInsights] = useState('')
  const [loading, setLoading] = useState(false)

  const loadGroups = useCallback(async (uid: string) => {
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', uid)
    const ids = (memberships || []).map((item) => item.group_id)
    if (!ids.length) {
      setGroups([])
      return
    }

    const { data } = await supabase.from('groups').select('*').in('id', ids).order('created_at', { ascending: false })
    setGroups(data || [])
    setSelectedGroup((data || [])[0] || null)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      setUserId(uid)
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', uid).single()
      setPlan((profile?.plan as 'free' | 'pro') || 'free')
      await loadGroups(uid)
    })
  }, [loadGroups])

  useEffect(() => {
    if (!selectedGroup) return
    supabase.from('group_members').select('*').eq('group_id', selectedGroup.id).then(({ data }) => setMembers(data || []))
  }, [selectedGroup])

  const createGroup = async () => {
    if (plan !== 'pro') return alert('Create group is available for Pro plan only.')
    if (!name.trim() || !userId) return

    const code = crypto.randomUUID().slice(0, 8).toUpperCase()
    const { data, error } = await supabase
      .from('groups')
      .insert({ name: name.trim(), owner_id: userId, invite_code: code })
      .select('*')
      .single()

    if (error) return alert(error.message)

    await supabase.from('group_members').insert({ group_id: data.id, user_id: userId, role: 'owner' })
    setName('')
    await loadGroups(userId)
  }

  const joinGroup = async () => {
    if (!inviteCode.trim() || !userId) return
    const { data: group, error } = await supabase.from('groups').select('*').eq('invite_code', inviteCode.trim().toUpperCase()).single()
    if (error || !group) return alert('Group not found.')

    const { error: joinError } = await supabase.from('group_members').upsert({ group_id: group.id, user_id: userId, role: 'member' })
    if (joinError) return alert(joinError.message)

    setInviteCode('')
    await loadGroups(userId)
  }

  const analyzeGroup = async () => {
    if (!selectedGroup) return
    setLoading(true)
    setInsights('')
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/ai/group-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ groupId: selectedGroup.id }),
    })
    const data = await response.json()
    setInsights(data.insights || data.error || 'Analysis failed.')
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#0f1117] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="mb-3 inline-flex text-sm text-amber-400">← Dashboard</Link>
            <h1 className="text-2xl font-bold">Study Groups</h1>
            <p className="mt-1 text-sm text-slate-500">Create a Pro group, join by invite code, and analyze group patterns.</p>
          </div>
        </div>

        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
            <h2 className="mb-3 text-sm font-semibold">Create group</h2>
            <div className="flex gap-2">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Group name" className="field-input" />
              <button onClick={createGroup} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black">Create</button>
            </div>
            {plan !== 'pro' && <p className="mt-2 text-xs text-red-400">Pro plan only.</p>}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
            <h2 className="mb-3 text-sm font-semibold">Join group</h2>
            <div className="flex gap-2">
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Invite code" className="field-input uppercase" />
              <button onClick={joinGroup} className="min-h-11 rounded-lg bg-white/[0.08] px-4 text-sm font-semibold text-slate-200">Join</button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-3">
            {groups.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No groups yet.</div>
            ) : groups.map((group) => (
              <button key={group.id} onClick={() => setSelectedGroup(group)} className={`mb-2 w-full rounded-lg p-3 text-left text-sm ${selectedGroup?.id === group.id ? 'bg-amber-500/10 text-amber-400' : 'text-slate-300 hover:bg-white/[0.04]'}`}>
                <div className="font-semibold">{group.name}</div>
                <div className="mt-1 text-xs text-slate-500">Code: {group.invite_code}</div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selectedGroup?.name || 'Select a group'}</h2>
                {selectedGroup && <p className="text-sm text-slate-500">Invite code: {selectedGroup.invite_code}</p>}
              </div>
              <button onClick={analyzeGroup} disabled={!selectedGroup || loading} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black disabled:opacity-40">
                {loading ? 'Analyzing...' : 'AI group pattern analysis'}
              </button>
            </div>

            <h3 className="mb-2 text-sm font-semibold text-slate-300">Members</h3>
            <div className="mb-5 space-y-2">
              {members.map((member) => (
                <div key={member.user_id} className="rounded-lg bg-[#0f1117] p-3 text-sm text-slate-400">
                  {member.user_id.slice(0, 8)} · {member.role}
                </div>
              ))}
            </div>

            {insights && <div className="whitespace-pre-line rounded-lg border border-white/[0.06] bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-300">{insights}</div>}
          </div>
        </section>
      </div>
    </main>
  )
}
