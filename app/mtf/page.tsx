'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { supabase } from '@/lib/supabase'

type Bias = 'buy' | 'neutral' | 'sell'
type Cloud = 'negative' | 'positive'
type Position = 'below' | 'inside' | 'above'
type Thickness = 'thin' | 'medium' | 'thick'
type LeadChange = 'steady' | 'thickening' | 'thinning' | 'pos2neg' | 'neg2pos'
type Cross = 'none' | 'gc' | 'gcSoon' | 'dcSoon' | 'dc'

type TimeframeForm = {
  cloud_type: Cloud
  price_position: Position
  lead_type: Cloud
  lead_thickness: Thickness
  lead_change: LeadChange
  hma50: Bias
  hma168: Bias
  cross_state: Cross
  memo: string
  chartFile: File | null
}

type Analysis = {
  id: string
  analysis_date: string
  analysis_time: string
  symbol: string
  overall_bias: Bias
  overall_memo: string | null
  special_memo: string | null
  created_at: string
}

type TimeframeRow = Omit<TimeframeForm, 'chartFile'> & {
  id: string
  analysis_id: string
  timeframe_minutes: number
  chart_path: string | null
}

const TF_ORDER = [15, 9, 6, 3, 1] as const

const defaultTf = (): TimeframeForm => ({
  cloud_type: 'negative',
  price_position: 'below',
  lead_type: 'negative',
  lead_thickness: 'medium',
  lead_change: 'steady',
  hma50: 'neutral',
  hma168: 'neutral',
  cross_state: 'none',
  memo: '',
  chartFile: null,
})

const freshTimeframes = () => Object.fromEntries(TF_ORDER.map((tf) => [tf, defaultTf()])) as Record<number, TimeframeForm>

const biasLabel: Record<Bias, string> = { buy: '매수', neutral: '중립', sell: '매도' }
const biasClass: Record<Bias, string> = {
  buy: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  neutral: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  sell: 'border-red-500/40 bg-red-500/10 text-red-300',
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#0f1117] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-10 rounded-lg px-2 text-xs font-semibold transition-colors ${value === option.value ? 'bg-amber-500 text-black' : 'text-slate-400 hover:bg-white/[0.05]'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default function MtfJournalPage() {
  const [userId, setUserId] = useState('')
  const [tab, setTab] = useState<'new' | 'history'>('new')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5))
  const [symbol, setSymbol] = useState('NQ')
  const [overallBias, setOverallBias] = useState<Bias>('neutral')
  const [overallMemo, setOverallMemo] = useState('')
  const [specialMemo, setSpecialMemo] = useState('')
  const [timeframes, setTimeframes] = useState<Record<number, TimeframeForm>>(freshTimeframes)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [tfRows, setTfRows] = useState<TimeframeRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadHistory = useCallback(async (uid: string) => {
    setLoadingHistory(true)
    const [{ data: aData }, { data: tData }] = await Promise.all([
      supabase.from('mtf_analyses').select('*').eq('user_id', uid).order('analysis_date', { ascending: false }).order('analysis_time', { ascending: false }),
      supabase.from('mtf_timeframes').select('*').eq('user_id', uid).order('timeframe_minutes', { ascending: false }),
    ])
    setAnalyses((aData || []) as Analysis[])
    setTfRows((tData || []) as TimeframeRow[])
    setLoadingHistory(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || ''
      setUserId(uid)
      if (uid) void loadHistory(uid)
    })
  }, [loadHistory])

  const updateTf = <K extends keyof TimeframeForm>(tf: number, key: K, value: TimeframeForm[K]) => {
    setTimeframes((prev) => ({ ...prev, [tf]: { ...prev[tf], [key]: value } }))
  }

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10))
    setTime(new Date().toTimeString().slice(0, 5))
    setSymbol('NQ')
    setOverallBias('neutral')
    setOverallMemo('')
    setSpecialMemo('')
    setTimeframes(freshTimeframes())
  }

  const save = async () => {
    if (!userId || saving) return
    setSaving(true)
    setMessage('')

    const { data: analysis, error: analysisError } = await supabase
      .from('mtf_analyses')
      .insert({
        user_id: userId,
        analysis_date: date,
        analysis_time: `${time}:00`,
        symbol: symbol.trim() || 'NQ',
        overall_bias: overallBias,
        overall_memo: overallMemo.trim() || null,
        special_memo: specialMemo.trim() || null,
      })
      .select('id')
      .single()

    if (analysisError || !analysis) {
      setMessage(`저장 실패: ${analysisError?.message || '알 수 없는 오류'}`)
      setSaving(false)
      return
    }

    const rows = []
    for (const tf of TF_ORDER) {
      const item = timeframes[tf]
      let chartPath: string | null = null
      if (item.chartFile) {
        const ext = item.chartFile.name.split('.').pop() || 'png'
        const path = `${userId}/${analysis.id}/${tf}m-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('mtf-charts').upload(path, item.chartFile, { upsert: false })
        if (!uploadError) chartPath = path
      }
      rows.push({
        analysis_id: analysis.id,
        user_id: userId,
        timeframe_minutes: tf,
        cloud_type: item.cloud_type,
        price_position: item.price_position,
        lead_type: item.lead_type,
        lead_thickness: item.lead_thickness,
        lead_change: item.lead_change,
        hma50: item.hma50,
        hma168: item.hma168,
        cross_state: item.cross_state,
        memo: item.memo.trim() || null,
        chart_path: chartPath,
      })
    }

    const { error: tfError } = await supabase.from('mtf_timeframes').insert(rows)
    if (tfError) {
      await supabase.from('mtf_analyses').delete().eq('id', analysis.id)
      setMessage(`저장 실패: ${tfError.message}`)
      setSaving(false)
      return
    }

    setMessage('분석을 저장했어요.')
    resetForm()
    await loadHistory(userId)
    setSaving(false)
  }

  const remove = async (analysis: Analysis) => {
    if (!userId || !window.confirm(`${analysis.analysis_date} ${analysis.analysis_time.slice(0, 5)} 분석을 삭제할까요?`)) return
    const related = tfRows.filter((row) => row.analysis_id === analysis.id && row.chart_path)
    if (related.length) await supabase.storage.from('mtf-charts').remove(related.map((row) => row.chart_path!).filter(Boolean))
    await supabase.from('mtf_analyses').delete().eq('id', analysis.id).eq('user_id', userId)
    await loadHistory(userId)
  }

  const stats = useMemo(() => ({
    total: analyses.length,
    sell: analyses.filter((a) => a.overall_bias === 'sell').length,
    neutral: analyses.filter((a) => a.overall_bias === 'neutral').length,
    buy: analyses.filter((a) => a.overall_bias === 'buy').length,
  }), [analyses])

  const cloudOptions = [{ value: 'negative' as Cloud, label: '음운' }, { value: 'positive' as Cloud, label: '양운' }]
  const biasOptions = [{ value: 'buy' as Bias, label: '매수 ↗' }, { value: 'neutral' as Bias, label: '횡보 →' }, { value: 'sell' as Bias, label: '매도 ↘' }]

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Multi-timeframe journal</p>
            <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">MTF 분석</h1>
            <p className="mt-2 text-sm text-slate-500">15 → 9 → 6 → 3 → 1분 순서로 시장 구조를 빠르게 기록합니다.</p>
          </div>
          <div className="grid grid-cols-2 rounded-xl bg-[#1a1f2e] p-1 sm:w-72">
            <button onClick={() => setTab('new')} className={`min-h-11 rounded-lg text-sm font-semibold ${tab === 'new' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>새 분석</button>
            <button onClick={() => setTab('history')} className={`min-h-11 rounded-lg text-sm font-semibold ${tab === 'history' ? 'bg-amber-500 text-black' : 'text-slate-400'}`}>과거 기록</button>
          </div>
        </div>

        {tab === 'new' ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-white/[0.07] bg-[#1a1f2e] p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-slate-500">날짜<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#0f1117] px-3 text-sm text-slate-200 outline-none focus:border-amber-500/50" /></label>
                <label className="text-xs font-semibold text-slate-500">분석 시각<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#0f1117] px-3 text-sm text-slate-200 outline-none focus:border-amber-500/50" /></label>
                <label className="text-xs font-semibold text-slate-500">종목<input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="NQ" className="mt-1.5 min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#0f1117] px-3 text-sm text-slate-200 outline-none focus:border-amber-500/50" /></label>
              </div>
            </section>

            {TF_ORDER.map((tf) => {
              const item = timeframes[tf]
              return (
                <section key={tf} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1a1f2e]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3"><span className="flex h-9 min-w-12 items-center justify-center rounded-xl bg-amber-500 text-sm font-black text-black">{tf}m</span><span className="text-sm font-semibold text-slate-300">시간프레임 분석</span></div>
                  </div>
                  <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div><div className="mb-1.5 text-xs font-semibold text-slate-500">현재 구름</div><Segmented value={item.cloud_type} options={cloudOptions} onChange={(v) => updateTf(tf, 'cloud_type', v)} /></div>
                      <div><div className="mb-1.5 text-xs font-semibold text-slate-500">현재 가격 위치</div><Segmented value={item.price_position} options={[{ value: 'below' as Position, label: '구름 아래' }, { value: 'inside' as Position, label: '구름 내부' }, { value: 'above' as Position, label: '구름 위' }]} onChange={(v) => updateTf(tf, 'price_position', v)} /></div>
                      <div><div className="mb-1.5 text-xs font-semibold text-slate-500">선행운</div><Segmented value={item.lead_type} options={cloudOptions} onChange={(v) => updateTf(tf, 'lead_type', v)} /></div>
                      <div><div className="mb-1.5 text-xs font-semibold text-slate-500">선행운 두께</div><Segmented value={item.lead_thickness} options={[{ value: 'thin' as Thickness, label: '얇음' }, { value: 'medium' as Thickness, label: '중간' }, { value: 'thick' as Thickness, label: '두꺼움' }]} onChange={(v) => updateTf(tf, 'lead_thickness', v)} /></div>
                    </div>
                    <div className="space-y-4">
                      <label className="block text-xs font-semibold text-slate-500">선행운 변화<select value={item.lead_change} onChange={(e) => updateTf(tf, 'lead_change', e.target.value as LeadChange)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#0f1117] px-3 text-sm text-slate-200"><option value="steady">유지</option><option value="thickening">두꺼워지는 중</option><option value="thinning">얇아지는 중</option><option value="pos2neg">양운 → 음운</option><option value="neg2pos">음운 → 양운</option></select></label>
                      <div><div className="mb-1.5 text-xs font-semibold text-slate-500">HMA 50</div><Segmented value={item.hma50} options={biasOptions} onChange={(v) => updateTf(tf, 'hma50', v)} /></div>
                      <div><div className="mb-1.5 text-xs font-semibold text-slate-500">HMA 168</div><Segmented value={item.hma168} options={biasOptions} onChange={(v) => updateTf(tf, 'hma168', v)} /></div>
                      <label className="block text-xs font-semibold text-slate-500">HMA 50 / 168<select value={item.cross_state} onChange={(e) => updateTf(tf, 'cross_state', e.target.value as Cross)} className="mt-1.5 min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#0f1117] px-3 text-sm text-slate-200"><option value="none">해당 없음</option><option value="gc">골크</option><option value="gcSoon">골크 직전</option><option value="dcSoon">데크 직전</option><option value="dc">데크</option></select></label>
                    </div>
                    <label className="block text-xs font-semibold text-slate-500 lg:col-span-2">메모<textarea value={item.memo} onChange={(e) => updateTf(tf, 'memo', e.target.value)} rows={2} placeholder="예: 단기 횡보 중, 큰 추세는 하방" className="mt-1.5 w-full resize-y rounded-xl border border-white/[0.08] bg-[#0f1117] px-3 py-3 text-sm text-slate-200 outline-none focus:border-amber-500/50" /></label>
                    <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-dashed border-white/[0.12] bg-[#0f1117] px-4 text-xs text-slate-400 lg:col-span-2"><span>{item.chartFile ? item.chartFile.name : '차트 스크린샷 첨부 (선택)'}</span><span className="font-semibold text-amber-400">파일 선택</span><input type="file" accept="image/*" className="hidden" onChange={(e) => updateTf(tf, 'chartFile', e.target.files?.[0] || null)} /></label>
                  </div>
                </section>
              )
            })}

            <section className="rounded-2xl border border-amber-500/20 bg-[#1a1f2e] p-4 sm:p-5">
              <div className="mb-4 text-sm font-bold text-slate-200">종합 판단</div>
              <Segmented value={overallBias} options={biasOptions} onChange={setOverallBias} />
              <label className="mt-4 block text-xs font-semibold text-slate-500">종합 메모<textarea value={overallMemo} onChange={(e) => setOverallMemo(e.target.value)} rows={3} placeholder="예: 상위 시간봉 하락 우세, 6분만 혼조" className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#0f1117] px-3 py-3 text-sm text-slate-200 outline-none focus:border-amber-500/50" /></label>
              <label className="mt-4 block text-xs font-semibold text-slate-500">특이사항 (선택)<textarea value={specialMemo} onChange={(e) => setSpecialMemo(e.target.value)} rows={2} placeholder="평소와 다른 상황만 필요할 때 기록" className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#0f1117] px-3 py-3 text-sm text-slate-200 outline-none focus:border-amber-500/50" /></label>
              {message && <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${message.startsWith('저장 실패') ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{message}</div>}
              <button disabled={saving || !userId} onClick={save} className="mt-5 min-h-12 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-sm font-bold text-black shadow-lg shadow-amber-500/10 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40">{saving ? '저장 중...' : '분석 저장'}</button>
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['전체', stats.total], ['매도', stats.sell], ['중립', stats.neutral], ['매수', stats.buy]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/[0.07] bg-[#1a1f2e] p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold text-slate-100">{value}</div></div>)}
            </div>
            {loadingHistory ? <div className="py-16 text-center text-sm text-slate-500">기록 불러오는 중...</div> : analyses.length === 0 ? <div className="rounded-2xl border border-white/[0.07] bg-[#1a1f2e] py-16 text-center text-sm text-slate-500">아직 저장된 MTF 분석이 없어요.</div> : analyses.map((analysis) => {
              const rows = tfRows.filter((row) => row.analysis_id === analysis.id).sort((a, b) => b.timeframe_minutes - a.timeframe_minutes)
              const expanded = expandedId === analysis.id
              return <section key={analysis.id} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1a1f2e]">
                <button onClick={() => setExpandedId(expanded ? null : analysis.id)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left sm:px-5">
                  <div className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${biasClass[analysis.overall_bias]}`}>{biasLabel[analysis.overall_bias]}</div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-200">{analysis.analysis_date} · {analysis.analysis_time.slice(0, 5)} · {analysis.symbol}</div><div className="mt-1 truncate text-xs text-slate-500">{analysis.overall_memo || '종합 메모 없음'}</div></div>
                  <span className="text-slate-500">{expanded ? '▲' : '▼'}</span>
                </button>
                {expanded && <div className="border-t border-white/[0.06] p-4 sm:p-5">
                  <div className="grid gap-2 sm:grid-cols-5">{TF_ORDER.map((tf) => {
                    const row = rows.find((item) => item.timeframe_minutes === tf)
                    if (!row) return null
                    return <div key={tf} className="rounded-xl bg-[#0f1117] p-3"><div className="mb-2 text-xs font-black text-amber-400">{tf}m</div><div className="space-y-1 text-[11px] text-slate-400"><div>구름: {row.cloud_type === 'negative' ? '음운' : '양운'} / {row.price_position === 'below' ? '아래' : row.price_position === 'above' ? '위' : '내부'}</div><div>선행운: {row.lead_type === 'negative' ? '음운' : '양운'}</div><div>HMA50: {biasLabel[row.hma50]}</div><div>HMA168: {biasLabel[row.hma168]}</div><div>크로스: {{ none: '-', gc: '골크', gcSoon: '골크 직전', dcSoon: '데크 직전', dc: '데크' }[row.cross_state]}</div>{row.memo && <div className="pt-1 text-slate-300">{row.memo}</div>}</div></div>
                  })}</div>
                  {analysis.special_memo && <div className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-slate-400">특이사항: {analysis.special_memo}</div>}
                  <button onClick={() => void remove(analysis)} className="mt-4 min-h-11 rounded-xl px-4 text-xs font-semibold text-red-400 hover:bg-red-500/10">기록 삭제</button>
                </div>}
              </section>
            })}
          </div>
        )}
      </main>
    </AppShell>
  )
}
