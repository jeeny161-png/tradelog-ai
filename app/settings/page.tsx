'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { supabase } from '@/lib/supabase'

type SectionKey = 'goals' | 'mt5' | 'import' | 'reset' | 'help' | 'profile'
type ResetAction = 'mt5-trades' | 'all-trades' | 'goals' | 'all-data'

type ParsedTrade = {
  symbol: string
  direction: 'L' | 'S'
  entry_price: number
  exit_price: number
  quantity: number
  pnl: number
  date: string
  rationale: string
}

export default function SettingsPage() {
  const [open, setOpen] = useState<SectionKey>('mt5')
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [monthlyTarget, setMonthlyTarget] = useState('0')
  const [maxDailyLoss, setMaxDailyLoss] = useState('0')
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState('0')
  const [saved, setSaved] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [mt5Status, setMt5Status] = useState('')
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[]>([])
  const [importMessage, setImportMessage] = useState('')
  const [resetAction, setResetAction] = useState<ResetAction>('mt5-trades')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetStatus, setResetStatus] = useState('')
  const [resetting, setResetting] = useState(false)

  const authedFetch = async (method: 'GET' | 'POST') => {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/settings/mt5-key', {
      method,
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    })
    return response.json()
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) return

      setUserId(user.id)
      setEmail(user.email || '')

      const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).single()
      if (goals) {
        setMonthlyTarget(String(goals.monthly_target || 0))
        setMaxDailyLoss(String(goals.max_daily_loss || 0))
        setMaxConsecutiveLosses(String(goals.max_consecutive_losses || 0))
      }

      const mt5 = await authedFetch('GET')
      if (mt5.apiKey) setApiKey(mt5.apiKey)
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
    setTimeout(() => setSaved(false), 2200)
  }

  const regenerate = async () => {
    const data = await authedFetch('POST')
    if (data.apiKey) setApiKey(data.apiKey)
  }

  const testConnection = async () => {
    const response = await fetch('/api/mt5')
    const data = await response.json()
    setMt5Status(data.ok ? '연결 상태가 정상입니다.' : '연결 테스트에 실패했습니다.')
  }

  const handleImportFile = async (file?: File) => {
    if (!file) return
    const text = await file.text()
    const parsed = parseMt5Csv(text)
    setParsedTrades(parsed)
    setImportMessage(`${parsed.length}개 거래를 파싱했습니다.`)
  }

  const confirmImport = async () => {
    if (!userId) return alert('로그인이 필요합니다.')
    if (!parsedTrades.length) return
    const { error } = await supabase.from('trades').insert(parsedTrades.map((trade) => ({
      ...trade,
      user_id: userId,
      emotion: 'Calm',
      notes: 'Imported from MT5 CSV',
    })))
    if (error) return alert(error.message)
    setImportMessage(`${parsedTrades.length}개 거래를 가져왔습니다.`)
    setParsedTrades([])
  }

  const resetData = async () => {
    if (resetConfirm !== 'RESET') {
      setResetStatus('초기화하려면 RESET을 정확히 입력해 주세요.')
      return
    }

    const labels: Record<ResetAction, string> = {
      'mt5-trades': 'MT5 연동 거래 기록',
      'all-trades': '전체 거래 기록',
      goals: '목표 설정',
      'all-data': '전체 거래 기록과 목표 설정',
    }

    if (!confirm(`${labels[resetAction]}을 초기화할까요? 이 작업은 되돌릴 수 없습니다.`)) return

    setResetting(true)
    setResetStatus('')
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/settings/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({ action: resetAction, confirm: resetConfirm }),
    })
    const data = await response.json()
    setResetting(false)

    if (!response.ok) {
      setResetStatus(data.error || '초기화에 실패했습니다.')
      return
    }

    setResetStatus(`초기화 완료: 거래 ${data.deletedTrades || 0}개, 목표 ${data.deletedGoals || 0}개`)
    setResetConfirm('')
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5">
          <h1 className="text-2xl font-bold text-slate-100">설정</h1>
          <p className="mt-1 text-sm text-slate-500">목표, MT5 연동, 가져오기, 초기화, 도움말, 프로필을 관리합니다.</p>
        </header>

        <div className="space-y-3">
          <Panel id="goals" open={open} setOpen={setOpen} title="목표 관리">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="월 수익 목표"><input className="field-input" type="number" value={monthlyTarget} onChange={(event) => setMonthlyTarget(event.target.value)} /></Field>
              <Field label="일 손실 한도"><input className="field-input" type="number" value={maxDailyLoss} onChange={(event) => setMaxDailyLoss(event.target.value)} /></Field>
              <Field label="연속 손실 경고"><input className="field-input" type="number" value={maxConsecutiveLosses} onChange={(event) => setMaxConsecutiveLosses(event.target.value)} /></Field>
            </div>
            <button onClick={saveGoals} className="mt-4 min-h-11 rounded-xl bg-amber-500 px-5 text-sm font-bold text-black">저장</button>
            {saved && <span className="ml-3 text-sm text-emerald-400">저장되었습니다.</span>}
          </Panel>

          <Panel id="mt5" open={open} setOpen={setOpen} title="MT5 연동">
            <div className="rounded-xl bg-[#0f1117] p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Personal API Key</div>
              <div className="break-all font-mono text-sm text-amber-300">{apiKey || 'Loading...'}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => void regenerate()} className="min-h-11 rounded-xl bg-amber-500 px-4 text-sm font-bold text-black">API 키 발급</button>
              <button onClick={() => void navigator.clipboard.writeText(apiKey)} className="min-h-11 rounded-xl bg-white/[0.08] px-4 text-sm font-bold text-slate-200">API 키 복사</button>
              <Link href="/TradeLogAI_Bridge.mq5" className="flex min-h-11 items-center rounded-xl bg-white/[0.08] px-4 text-sm font-bold text-slate-200">EA 파일 다운로드</Link>
              <button onClick={() => void testConnection()} className="min-h-11 rounded-xl bg-white/[0.08] px-4 text-sm font-bold text-slate-200">연결 테스트</button>
            </div>
            {mt5Status && <p className="mt-3 text-sm text-emerald-400">{mt5Status}</p>}
            <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
              API 키는 계정의 거래 기록을 생성할 수 있는 개인 인증키입니다. 절대 타인과 공유하지 마세요.
            </div>
            <Mt5SetupGuide apiKey={apiKey} />
          </Panel>

          <Panel id="import" open={open} setOpen={setOpen} title="가져오기">
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                void handleImportFile(event.dataTransfer.files[0])
              }}
              className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.16] bg-[#0f1117] p-6 text-center hover:border-amber-500/50"
            >
              <input type="file" accept=".csv,.txt" className="hidden" onChange={(event) => void handleImportFile(event.target.files?.[0])} />
              <div className="text-lg font-bold text-slate-100">MT5 CSV 파일 업로드</div>
              <div className="mt-1 text-sm text-slate-500">드래그하거나 탭해서 파일을 선택하세요.</div>
            </label>
            {importMessage && <p className="mt-4 text-sm text-amber-400">{importMessage}</p>}
            {parsedTrades.length > 0 && (
              <>
                <div className="mt-5 max-h-80 overflow-auto rounded-xl border border-white/[0.06]">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-[#0f1117] text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Symbol</th>
                        <th className="px-4 py-3 text-left">Dir</th>
                        <th className="px-4 py-3 text-right">Entry</th>
                        <th className="px-4 py-3 text-right">Exit</th>
                        <th className="px-4 py-3 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedTrades.map((trade, index) => (
                        <tr key={`${trade.symbol}-${trade.date}-${index}`} className="border-t border-white/[0.04]">
                          <td className="px-4 py-3">{trade.date}</td>
                          <td className="px-4 py-3">{trade.symbol}</td>
                          <td className="px-4 py-3">{trade.direction}</td>
                          <td className="px-4 py-3 text-right font-mono">{trade.entry_price}</td>
                          <td className="px-4 py-3 text-right font-mono">{trade.exit_price}</td>
                          <td className={`px-4 py-3 text-right font-mono ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trade.pnl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={confirmImport} className="mt-4 min-h-11 rounded-xl bg-amber-500 px-5 text-sm font-bold text-black">가져오기 확정</button>
              </>
            )}
          </Panel>

          <Panel id="reset" open={open} setOpen={setOpen} title="데이터 초기화">
            <div className="space-y-4">
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-relaxed text-red-100">
                초기화는 선택한 데이터를 영구 삭제합니다. MT5 중복 기록을 정리하려면 먼저 MT5 연동 거래만 삭제를 사용하세요.
              </div>
              <Field label="초기화 범위">
                <select className="field-input" value={resetAction} onChange={(event) => setResetAction(event.target.value as ResetAction)}>
                  <option value="mt5-trades">MT5 연동 거래만 삭제</option>
                  <option value="all-trades">전체 거래 기록 삭제</option>
                  <option value="goals">목표 설정 초기화</option>
                  <option value="all-data">전체 거래 기록 + 목표 설정 초기화</option>
                </select>
              </Field>
              <Field label="확인 문구">
                <input className="field-input" value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} placeholder="RESET" />
              </Field>
              <button
                onClick={() => void resetData()}
                disabled={resetting || resetConfirm !== 'RESET'}
                className="min-h-11 rounded-xl bg-red-500 px-5 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {resetting ? '초기화 중...' : '선택한 데이터 초기화'}
              </button>
              {resetStatus && <p className="text-sm text-slate-300">{resetStatus}</p>}
            </div>
          </Panel>

          <Panel id="help" open={open} setOpen={setOpen} title="도움말">
            <HelpContent />
          </Panel>

          <Panel id="profile" open={open} setOpen={setOpen} title="프로필">
            <div className="rounded-xl bg-[#0f1117] p-4">
              <div className="text-xs text-slate-500">이메일</div>
              <div className="mt-2 break-all font-semibold text-slate-100">{email || '-'}</div>
            </div>
            <button onClick={() => supabase.auth.signOut().finally(() => window.location.replace('/login'))} className="mt-4 min-h-11 rounded-xl bg-red-500/10 px-5 text-sm font-bold text-red-400">로그아웃</button>
          </Panel>
        </div>
      </main>
    </AppShell>
  )
}

function Panel({ id, open, setOpen, title, children }: { id: SectionKey; open: SectionKey; setOpen: (id: SectionKey) => void; title: string; children: React.ReactNode }) {
  const isOpen = open === id
  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#1a1f2e]">
      <button onClick={() => setOpen(id)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left font-bold text-slate-100">
        <span>{title}</span>
        <span className="text-amber-400">{isOpen ? '-' : '+'}</span>
      </button>
      {isOpen && <div className="border-t border-white/[0.06] p-4">{children}</div>}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function Mt5SetupGuide({ apiKey }: { apiKey: string }) {
  return (
    <section className="mt-6 space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-100">MT5 EA Setup Guide</h3>
        <p className="mt-1 text-sm text-slate-500">자세한 설치 방법을 순서대로 따라 하면 MT5 거래가 TradeLog AI에 자동으로 기록됩니다.</p>
      </div>
      <SetupStep icon="🔑" title="Step 1: API 키 발급">
        <p>TradeLog AI → 설정 메뉴 → MT5 연동 섹션으로 이동합니다.</p>
        <p>&quot;API 키 발급&quot; 버튼을 클릭하고 생성된 키를 복사합니다.</p>
        <CodeBlock value={apiKey || '설정 페이지에서 API 키 발급 버튼을 클릭하세요'} />
        <WarningBox>API 키는 절대 타인과 공유하지 마세요. 유출이 의심되면 즉시 재발급하세요.</WarningBox>
      </SetupStep>
      <SetupStep icon="📥" title="Step 2: EA 파일 다운로드">
        <p>설정 페이지에서 &quot;EA 파일 다운로드&quot; 버튼을 클릭합니다.</p>
        <p><Link href="/TradeLogAI_Bridge.mq5" className="text-amber-400 underline">TradeLogAI_Bridge.mq5</Link> 파일을 저장합니다.</p>
      </SetupStep>
      <SetupStep icon="📁" title="Step 3: MT5에 EA 설치">
        <p>MT5를 열고 상단 메뉴 → 파일 → 데이터 폴더 열기를 클릭합니다.</p>
        <p>MQL5 → Experts 폴더에 TradeLogAI_Bridge.mq5 파일을 복사합니다.</p>
        <p>MT5로 돌아와 네비게이터 패널을 새로고침합니다. 단축키는 F5입니다.</p>
        <p>전문가 어드바이저 목록에 TradeLogAI_Bridge가 보이는지 확인합니다.</p>
      </SetupStep>
      <SetupStep icon="🌐" title="Step 4: WebRequest URL 허용 설정">
        <p>MT5 상단 메뉴 → 도구 → 옵션을 엽니다.</p>
        <p>&quot;전문가 어드바이저&quot; 탭에서 &quot;다음 URL의 WebRequest 허용&quot; 체크박스를 켭니다.</p>
        <CodeBlock value="https://tradelog-ai-one.vercel.app" />
        <WarningBox>여기에는 /api/mt5를 붙이지 않습니다. MT5 허용 URL에는 도메인만 입력하세요.</WarningBox>
      </SetupStep>
      <SetupStep icon="📈" title="Step 5: EA를 차트에 적용">
        <p>아무 차트나 엽니다. XAUUSD M1 차트를 권장합니다.</p>
        <p>네비게이터에서 TradeLogAI_Bridge를 더블클릭하거나 차트에 드래그합니다.</p>
        <p>InpApiKey에 API 키를 붙여넣고 InpApiUrl이 아래 주소인지 확인합니다.</p>
        <CodeBlock value="https://tradelog-ai-one.vercel.app/api/mt5" />
        <p>&quot;자동매매 허용&quot; 체크를 켜고 확인을 클릭합니다.</p>
      </SetupStep>
    </section>
  )
}

function HelpContent() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <GuideCard title="시작하기" lines={['회원가입 후 홈에서 첫 일지를 작성합니다.', '종목, 방향, 진입가, 청산가, 수량을 입력합니다.', '기록에서 AI 분석 버튼을 눌러 피드백을 받습니다.']} />
        <GuideCard title="일지 작성 가이드" lines={['매매 근거는 셋업, 추세, 리스크, 진입 이유를 구체적으로 씁니다.', '감정은 진입 당시 상태를 선택합니다.', '차트 이미지는 진입과 청산 위치가 보이게 업로드합니다.']} />
        <GuideCard title="AI 분석 활용법" lines={['강점과 약점을 분리해서 읽습니다.', '패턴 분석은 반복 실수를 찾는 데 씁니다.', '주간 리포트는 다음 주 실행 항목 중심으로 확인합니다.']} />
        <GuideCard title="스터디 그룹" lines={['Pro 사용자는 그룹을 만들 수 있습니다.', '초대 코드로 참가하고 멤버 목록을 확인합니다.', 'AI 그룹 패턴 분석으로 공통 실수를 확인합니다.']} />
      </div>
      <Mt5SetupGuide apiKey="설정 → MT5 연동 섹션에서 확인" />
      <section>
        <h3 className="mb-3 text-lg font-bold text-slate-100">모바일 앱 설치 방법</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <InstallCard title="iPhone (Safari)" icon="📱" steps={['Safari로 https://tradelog-ai-one.vercel.app 접속', '하단 공유 버튼 탭', '"홈 화면에 추가" 탭', '이름 확인 후 "추가" 탭', '홈 화면에 TradeLog AI 아이콘 생성']} />
          <InstallCard title="Android (Chrome)" icon="🤖" steps={['Chrome으로 https://tradelog-ai-one.vercel.app 접속', '주소창 우측 점 3개 메뉴 탭', '"앱 설치" 또는 "홈 화면에 추가" 탭', '"설치" 탭', '홈 화면에 TradeLog AI 아이콘 생성']} />
        </div>
      </section>
    </div>
  )
}

function SetupStep({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-white/[0.06] bg-[#0f1117] p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-xl">{icon}</span>
        <h4 className="font-bold text-slate-100">{title}</h4>
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-slate-400">{children}</div>
    </article>
  )
}

function CodeBlock({ value }: { value: string }) {
  return <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 text-xs text-amber-200"><code>{value}</code></pre>
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">{children}</div>
}

function GuideCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-xl bg-[#0f1117] p-4">
      <h3 className="font-bold text-slate-100">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
        {lines.map((line) => <li key={line}>- {line}</li>)}
      </ul>
    </div>
  )
}

function InstallCard({ title, icon, steps }: { title: string; icon: string; steps: string[] }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h4 className="font-bold text-amber-200">{title}</h4>
      </div>
      <ol className="space-y-2 text-sm leading-relaxed text-slate-300">
        {steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}
      </ol>
    </div>
  )
}

function parseMt5Csv(text: string): ParsedTrade[] {
  const rows = text.split(/\r?\n/).filter(Boolean).map(splitCsvLine)
  if (rows.length < 2) return []
  const headers = rows[0].map(normalize)
  const index = (candidates: string[]) => headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)))
  const timeIdx = index(['time', 'date'])
  const symbolIdx = index(['symbol'])
  const typeIdx = index(['type', 'direction'])
  const volumeIdx = index(['volume', 'size'])
  const priceIdx = index(['price'])
  const profitIdx = index(['profit', 'pnl'])
  const slIdx = index(['s/l', 'sl'])
  const tpIdx = index(['t/p', 'tp'])

  const grouped = new Map<string, ParsedTrade>()
  for (const row of rows.slice(1)) {
    const type = (row[typeIdx] || '').toLowerCase()
    const direction: 'L' | 'S' = type.includes('sell') || type.includes('short') || type === 's' ? 'S' : 'L'
    const date = toDate(row[timeIdx] || new Date().toISOString())
    const symbol = row[symbolIdx] || 'UNKNOWN'
    if (symbol === 'UNKNOWN') continue
    const key = `${date}-${symbol}-${direction}-${row[slIdx] || ''}-${row[tpIdx] || ''}`
    const current = grouped.get(key) || {
      symbol,
      direction,
      entry_price: Number(row[priceIdx]) || 0,
      exit_price: Number(row[priceIdx]) || 0,
      quantity: 0,
      pnl: 0,
      date,
      rationale: `MT5 import${row[slIdx] ? ` SL ${row[slIdx]}` : ''}${row[tpIdx] ? ` TP ${row[tpIdx]}` : ''}`,
    }
    current.quantity += Number(row[volumeIdx]) || 1
    current.pnl += Number(row[profitIdx]) || 0
    current.exit_price = Number(row[priceIdx]) || current.exit_price
    grouped.set(key, current)
  }
  return [...grouped.values()]
}

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function normalize(value: string) {
  return value.toLowerCase().replaceAll(' ', '').replaceAll('_', '')
}

function toDate(value: string) {
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return value.slice(0, 10)
}
