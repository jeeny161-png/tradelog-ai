'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function GoalsPage() {
  const [userId, setUserId] = useState('')
  const [monthlyTarget, setMonthlyTarget] = useState('0')
  const [maxDailyLoss, setMaxDailyLoss] = useState('0')
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState('0')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || ''
      setUserId(uid)
      if (!uid) return
      const { data: goals } = await supabase.from('goals').select('*').eq('user_id', uid).single()
      if (goals) {
        setMonthlyTarget(String(goals.monthly_target ?? 0))
        setMaxDailyLoss(String(goals.max_daily_loss ?? 0))
        setMaxConsecutiveLosses(String(goals.max_consecutive_losses ?? 0))
      }
    })
  }, [])

  const saveGoals = async () => {
    if (!userId) return
    const { error } = await supabase.from('goals').upsert({
      user_id: userId,
      monthly_target: Number(monthlyTarget),
      max_daily_loss: Number(maxDailyLoss),
      max_consecutive_losses: Number(maxConsecutiveLosses),
    })
    if (error) return alert(error.message)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <main className="min-h-screen bg-[#0f1117] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-3 inline-flex text-sm text-amber-400">← Dashboard</Link>
        <h1 className="text-2xl font-bold">목표 관리</h1>
        <p className="mt-1 text-sm text-slate-500">월 목표와 리스크 제한을 설정하면 대시보드에서 경고를 보여줍니다.</p>

        <section className="mt-6 space-y-4 rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
          <Field label="Monthly profit target">
            <input value={monthlyTarget} onChange={(event) => setMonthlyTarget(event.target.value)} type="number" className="field-input" />
          </Field>
          <Field label="Max daily loss limit">
            <input value={maxDailyLoss} onChange={(event) => setMaxDailyLoss(event.target.value)} type="number" className="field-input" />
          </Field>
          <Field label="Max consecutive loss warning">
            <input value={maxConsecutiveLosses} onChange={(event) => setMaxConsecutiveLosses(event.target.value)} type="number" className="field-input" />
          </Field>

          <button onClick={saveGoals} className="min-h-11 w-full rounded-xl bg-amber-500 text-sm font-semibold text-black">Save goals</button>
          {saved && <p className="text-center text-sm text-emerald-400">Saved.</p>}
        </section>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  )
}
