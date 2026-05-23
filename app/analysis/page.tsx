'use client'

import { useState } from 'react'
import AppShell from '../components/AppShell'
import { supabase } from '@/lib/supabase'

type PatternInsight = {
  title: string
  value: string
  detail: string
}

export default function AnalysisPage() {
  const [tab, setTab] = useState<'patterns' | 'weekly'>('patterns')
  const [insights, setInsights] = useState<PatternInsight[]>([])
  const [summary, setSummary] = useState('')
  const [patternsLoading, setPatternsLoading] = useState(false)
  const [weeklyReport, setWeeklyReport] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('last-weekly-report') || ''
  })
  const [weeklyLoading, setWeeklyLoading] = useState(false)

  const analyzePatterns = async () => {
    setPatternsLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/ai/patterns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    })
    const data = await response.json()
    if (!response.ok) alert(data.error || '패턴 분석에 실패했습니다.')
    setInsights(data.insights || [])
    setSummary(data.summary || '')
    setPatternsLoading(false)
  }

  const requestWeeklyReport = async () => {
    setWeeklyLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/ai/weekly-report', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    })
    const data = await response.json()
    const report = data.report || data.error || '리포트를 생성하지 못했습니다.'
    setWeeklyReport(report)
    window.localStorage.setItem('last-weekly-report', report)
    setWeeklyLoading(false)
  }

  const fallback = [
    { title: 'Best trading time', value: 'London session (08:00-12:00)', detail: '분석을 실행하면 실제 거래 기준으로 계산됩니다.' },
    { title: 'Worst emotion', value: '급함', detail: '감정별 승률과 손익을 비교합니다.' },
    { title: 'Strongest day', value: 'Tuesday', detail: '요일별 성과를 집계합니다.' },
  ]

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5">
          <h1 className="text-2xl font-bold text-slate-100">AI 분석</h1>
          <p className="mt-1 text-sm text-slate-500">패턴 분석과 주간 리포트를 한 곳에서 실행합니다.</p>
        </header>

        <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-1">
          <button onClick={() => setTab('patterns')} className={`min-h-11 rounded-lg text-sm font-bold ${tab === 'patterns' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>패턴 분석</button>
          <button onClick={() => setTab('weekly')} className={`min-h-11 rounded-lg text-sm font-bold ${tab === 'weekly' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>주간 리포트</button>
        </div>

        {tab === 'patterns' ? (
          <section className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 sm:p-5">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">거래 패턴 AI 분석</h2>
                <p className="mt-1 text-sm text-slate-500">시간대, 요일, 감정, 종목별 성과를 분석합니다.</p>
              </div>
              <button onClick={analyzePatterns} disabled={patternsLoading} className="min-h-11 rounded-xl bg-amber-500 px-5 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50">
                {patternsLoading ? '분석 중...' : '분석 실행'}
              </button>
            </div>

            {summary && <div className="mb-4 whitespace-pre-line break-words rounded-xl bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-300">{summary}</div>}
            <div className="grid gap-3 md:grid-cols-3">
              {(insights.length ? insights : fallback).map((insight) => (
                <article key={insight.title} className="rounded-xl border border-white/[0.06] bg-[#0f1117] p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">{insight.title}</div>
                  <div className="mt-3 break-words text-xl font-bold text-slate-100">{insight.value}</div>
                  <p className="mt-2 break-words text-sm leading-relaxed text-slate-500">{insight.detail}</p>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-4 sm:p-5">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">주간 리포트</h2>
                <p className="mt-1 text-sm text-slate-500">최근 7일 거래를 기반으로 새 리포트를 요청합니다.</p>
              </div>
              <button onClick={requestWeeklyReport} disabled={weeklyLoading} className="min-h-11 rounded-xl bg-amber-500 px-5 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50">
                {weeklyLoading ? '생성 중...' : '새 리포트 요청'}
              </button>
            </div>
            <div className="min-h-64 whitespace-pre-line break-words rounded-xl bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-300">
              {weeklyReport || '아직 저장된 주간 리포트가 없습니다.'}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  )
}
