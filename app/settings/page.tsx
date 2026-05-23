'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { supabase } from '@/lib/supabase'

type SectionKey = 'goals' | 'mt5' | 'import' | 'help' | 'profile'

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
  const [open, setOpen] = useState<SectionKey>('goals')
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

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5">
          <h1 className="text-2xl font-bold text-slate-100">설정</h1>
          <p className="mt-1 text-sm text-slate-500">목표, MT5, 가져오기, 도움말, 프로필을 관리합니다.</p>
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
              <button onClick={() => void navigator.clipboard.writeText(apiKey)} className="min-h-11 rounded-xl bg-amber-500 px-4 text-sm font-bold text-black">API 키 복사</button>
              <button onClick={() => void regenerate()} className="min-h-11 rounded-xl bg-white/[0.08] px-4 text-sm font-bold text-slate-200">재발급</button>
              <button onClick={() => void testConnection()} className="min-h-11 rounded-xl bg-white/[0.08] px-4 text-sm font-bold text-slate-200">연결 테스트</button>
            </div>
            {mt5Status && <p className="mt-3 text-sm text-emerald-400">{mt5Status}</p>}
            <div className="mt-5 space-y-3 rounded-xl bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-400">
              <p>1. <Link href="/TradeLogAI_Bridge.mq5" className="text-amber-400 underline">TradeLogAI_Bridge.mq5</Link> 파일을 다운로드해 MT5 Experts 폴더에 넣습니다.</p>
              <p>2. MT5 옵션 → Expert Advisors → WebRequest 허용 URL에 https://tradelog-ai-one.vercel.app 를 추가합니다.</p>
              <p>3. EA 파라미터의 ApiKey에 개인 API 키를 입력합니다.</p>
              <p>4. 거래가 종료되면 EA가 /api/mt5로 자동 전송합니다.</p>
            </div>
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
                  <table className="min-w-[760px] w-full text-sm">
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
        <span className="text-amber-400">{isOpen ? '−' : '+'}</span>
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

function HelpContent() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <GuideCard title="시작하기" lines={['회원가입 후 홈에서 첫 일지를 작성합니다.', '종목, 방향, 진입가, 청산가, 수량을 입력합니다.', '기록에서 AI 분석 버튼을 눌러 피드백을 받습니다.']} />
        <GuideCard title="일지 작성 가이드" lines={['매매 근거는 셋업, 추세, 리스크, 진입 이유를 구체적으로 씁니다.', '감정은 진입 당시 상태를 선택합니다.', '차트 이미지는 진입/청산 위치가 보이게 업로드합니다.']} />
        <GuideCard title="AI 분석 활용법" lines={['강점과 약점을 분리해서 읽습니다.', '패턴 분석은 시간대, 요일, 감정, 종목별 반복 실수를 찾는 데 씁니다.', '주간 리포트는 다음 주 실행 항목 중심으로 확인합니다.']} />
        <GuideCard title="스터디 그룹" lines={['Pro 사용자는 그룹을 만들 수 있습니다.', '초대 코드로 참가하고 멤버 목록을 확인합니다.', 'AI 그룹 패턴 분석으로 공통 실수를 확인합니다.']} />
      </div>

      <section>
        <h3 className="mb-3 text-lg font-bold text-slate-100">모바일 앱 설치 방법</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <InstallCard title="iPhone (Safari)" icon="📱" steps={['Safari로 https://tradelog-ai-one.vercel.app 접속', '하단 공유 버튼 탭', '"홈 화면에 추가" 탭', '이름 확인 후 "추가" 탭', '홈 화면에 TradeLog AI 아이콘 생성']} />
          <InstallCard title="Android (Chrome)" icon="🤖" steps={['Chrome으로 https://tradelog-ai-one.vercel.app 접속', '주소창 우측 점 3개 메뉴 탭', '"앱 설치" 또는 "홈 화면에 추가" 탭', '"설치" 탭', '홈 화면에 TradeLog AI 아이콘 생성']} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-slate-100">FAQ</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['무료 플랜에서도 AI 분석이 되나요?', '기본 크레딧 안에서 사용할 수 있습니다.'],
            ['MT5 CSV는 어떤 파일이어야 하나요?', '계좌 내역에서 저장한 CSV 또는 상세 보고서 형식이면 됩니다.'],
            ['랭킹은 실명으로 표시되나요?', '아니요. 참여한 사용자만 익명 닉네임으로 표시됩니다.'],
            ['목표 경고는 어디에 나오나요?', '홈 대시보드에서 일 손실과 연속 손실 상태를 기준으로 표시됩니다.'],
            ['EA 자동 연동은 안전한가요?', '개인 API 키로 인증하며 키는 설정에서 재발급할 수 있습니다.'],
            ['그룹 생성은 누구나 가능한가요?', '그룹 생성은 Pro 플랜 전용입니다.'],
            ['공유 링크는 로그인 없이 보이나요?', '공개 링크를 가진 사람은 해당 거래 상세를 볼 수 있습니다.'],
            ['차트 이미지는 필수인가요?', '필수는 아니지만 AI 분석 품질을 높이는 데 도움이 됩니다.'],
            ['주간 리포트는 언제 발송되나요?', '자동 리포트는 매주 월요일 오전 8시 KST 기준입니다.'],
            ['데이터 삭제는 어디서 하나요?', '기록 화면에서 개별 거래를 삭제할 수 있습니다.'],
          ].map(([question, answer]) => (
            <div key={question} className="rounded-xl bg-[#0f1117] p-4">
              <div className="font-semibold text-slate-100">{question}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
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
