import Link from 'next/link'

const faqs = [
  ['AI 분석은 언제 쓰면 좋나요?', '진입 근거와 결과를 적은 뒤 복기 단계에서 사용하면 가장 좋습니다.'],
  ['무료 플랜에서도 사용할 수 있나요?', '네. 무료 플랜은 제한된 AI 크레딧으로 기본 일지와 분석을 사용할 수 있습니다.'],
  ['MT5 CSV는 어떤 파일이어야 하나요?', 'MT5 계좌 내역에서 저장한 CSV 또는 상세 보고서 형식이면 됩니다.'],
  ['차트 이미지는 필수인가요?', '필수는 아니지만 AI가 맥락을 더 잘 이해하는 데 도움이 됩니다.'],
  ['스터디 그룹은 누가 만들 수 있나요?', '그룹 생성은 Pro 플랜에서 사용할 수 있습니다. 초대 코드는 누구나 입력할 수 있습니다.'],
  ['코치 공유는 무엇인가요?', '코치가 내 일지를 볼 수 있도록 공유 상태를 켜는 기능입니다.'],
  ['랭킹은 실명으로 나오나요?', '아니요. opt-in한 사용자만 익명 닉네임으로 표시됩니다.'],
  ['목표 알림은 어떻게 동작하나요?', '월 목표, 일 손실 제한, 연속 손실 조건을 기준으로 대시보드에 경고를 표시합니다.'],
  ['EA 자동 연동은 안전한가요?', '개인 API 키로 인증하며, 키가 유출되면 설정 페이지에서 새 키를 발급하세요.'],
  ['데이터를 삭제할 수 있나요?', '개별 거래는 히스토리에서 삭제할 수 있고, 계정 관리는 관리자에게 문의하세요.'],
]

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#0f1117] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="mb-4 inline-flex text-sm text-amber-400">← Dashboard</Link>
        <header className="mb-8">
          <h1 className="text-3xl font-bold">도움말</h1>
          <p className="mt-2 text-slate-500">TradeLog AI를 처음 쓰는 분부터 MT5 자동 연동까지 한 번에 볼 수 있는 가이드입니다.</p>
        </header>

        <div className="space-y-6">
          <HelpSection icon="1" title="시작하기">
            <Step title="회원가입 방법" text="로그인 화면에서 이메일로 가입하거나 인증 링크를 통해 접속합니다." />
            <Step title="첫 일지 작성하는 법" text="대시보드의 새 일지에서 종목, 방향, 진입가, 청산가, 수량, 감정, 매매 근거를 입력하고 저장합니다." />
            <Step title="AI 분석 받는 법" text="히스토리에서 거래를 열고 AI Analyze 버튼을 누르면 강점, 약점, 개선점을 받을 수 있습니다." />
          </HelpSection>

          <HelpSection icon="2" title="일지 작성 가이드">
            <p className="text-sm leading-relaxed text-slate-400">종목은 거래 상품명, 방향은 롱/숏, 진입가와 청산가는 실제 체결 가격, 수량은 lot 또는 계약 수, 감정은 진입 당시 상태, 매매 근거는 셋업과 규칙, 메모는 복기 내용을 적습니다.</p>
            <div className="rounded-lg bg-[#0f1117] p-4 text-sm text-slate-300">
              좋은 예시: “런던 오픈 후 전고 돌파, M15 상승 추세 유지, 손절은 직전 저점 아래. 뉴스 전이라 포지션은 절반만 진입.”
            </div>
            <p className="text-sm text-slate-400">차트 이미지는 일지 작성 영역의 Chart Image에서 업로드합니다. 진입/청산 위치가 보이도록 캡처하면 좋습니다.</p>
          </HelpSection>

          <HelpSection icon="3" title="MT5 연동 가이드">
            <Step title="Step 1" text="MT5 열기 → 도구 메뉴 → 계좌 내역을 엽니다." />
            <Step title="Step 2" text="계좌 내역 영역에서 우클릭 → 기간 설정을 선택합니다." />
            <Step title="Step 3" text="우클릭 → 저장 또는 상세 보고서 저장 → CSV 형식을 선택합니다." />
            <Step title="Step 4" text="TradeLog AI → 가져오기 메뉴 → CSV 파일을 업로드하고 미리보기를 확인한 뒤 Confirm import를 누릅니다." />
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <h3 className="font-semibold text-amber-300">EA 자동 연동</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                <li>설정 페이지에서 개인 API 키를 복사합니다.</li>
                <li>public/TradeLogAI_Bridge.mq5 파일을 MT5 Experts 폴더에 설치합니다.</li>
                <li>MT5 옵션 → Expert Advisors → WebRequest 허용 URL에 https://tradelog-ai-one.vercel.app 을 추가합니다.</li>
                <li>EA 파라미터의 ApiKey에 개인 API 키를 입력하고 실행합니다.</li>
              </ul>
            </div>
          </HelpSection>

          <HelpSection icon="4" title="AI 분석 활용법">
            <p className="text-sm text-slate-400">AI 분석은 요약, 강점, 약점, 다음 행동으로 나눠 읽으면 좋습니다. 패턴 분석은 시간대, 요일, 감정, 종목별 성과를 비교해 반복되는 실수를 찾는 데 사용하세요. 주간 리포트는 Pro 사용자에게 지난 7일 거래 요약을 이메일로 보냅니다.</p>
          </HelpSection>

          <HelpSection icon="5" title="스터디 그룹">
            <p className="text-sm text-slate-400">Pro 사용자는 그룹을 만들고 초대 코드를 공유할 수 있습니다. 참가자는 초대 코드로 그룹에 들어오며, 그룹 AI 분석으로 멤버 전체의 공통 패턴을 확인할 수 있습니다. 코치 공유를 켜면 코치가 일지를 검토할 수 있습니다.</p>
          </HelpSection>

          <HelpSection icon="6" title="FAQ">
            <div className="grid gap-3 md:grid-cols-2">
              {faqs.map(([question, answer]) => (
                <div key={question} className="rounded-lg bg-[#0f1117] p-4">
                  <h3 className="font-semibold text-slate-100">{question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{answer}</p>
                </div>
              ))}
            </div>
          </HelpSection>
        </div>
      </div>
    </main>
  )
}

function HelpSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold text-black">{icon}</div>
        <h2 className="text-xl font-bold text-slate-100">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Step({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg bg-[#0f1117] p-4">
      <h3 className="font-semibold text-slate-200">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">{text}</p>
    </div>
  )
}
