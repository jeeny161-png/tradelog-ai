'use client'

import { useEffect, useSyncExternalStore } from 'react'

export type Language = 'en' | 'ko'

const STORAGE_KEY = 'tradelog-language'

export const copy = {
  en: {
    language: 'Language',
    dashboard: 'Dashboard',
    newEntry: 'New Entry',
    history: 'History',
    calendar: 'Calendar',
    coach: 'Coach',
    logout: 'Logout',
    aiCredits: 'AI credits',
    upgradePro: 'Upgrade Pro',
    proPlan: 'Pro plan',
    unlimited: 'Unlimited',
    dashboardSubtitle: 'Track trades, review behavior, and ask AI for feedback.',
    totalTrades: 'Total Trades',
    records: 'records',
    winRate: 'Win Rate',
    closedTrades: 'closed trades',
    totalPnl: 'Total PnL',
    editing: 'Editing',
    cancel: 'Cancel',
    symbol: 'Symbol',
    direction: 'Direction',
    long: 'Long',
    short: 'Short',
    entryPrice: 'Entry Price',
    exitPrice: 'Exit Price',
    quantity: 'Quantity',
    emotion: 'Emotion',
    tradeRationale: 'Trade Rationale',
    rationalePlaceholder: 'Why did you take this trade?',
    notesReview: 'Notes / Review',
    notesPlaceholder: 'What happened? What should you repeat or avoid?',
    chartImage: 'Chart Image',
    uploadChart: 'Upload chart image',
    estimatedPnl: 'Estimated PnL',
    saving: 'Saving...',
    updateTrade: 'Update Trade',
    saveTrade: 'Save Trade',
    coachAccess: 'Coach Access',
    coachSubtitle: 'Share your trading journal with your coach for review.',
    processing: 'Processing...',
    sharingOn: 'Sharing On',
    shareWithCoach: 'Share With Coach',
    trades: 'trades',
    noTradesYet: 'No trades yet.',
    edit: 'Edit',
    delete: 'Delete',
    analyzing: 'Analyzing...',
    aiAnalyze: 'AI Analyze',
    left: 'left',
    rationale: 'Rationale:',
    notes: 'Notes:',
    alertPrices: 'Enter both entry and exit prices.',
    alertLogin: 'Please log in first.',
    updateFailed: 'Update failed',
    saveFailed: 'Save failed',
    deleteConfirm: 'Delete this trade?',
    deleteFailed: 'Delete failed',
    shareFailed: 'Share failed',
    creditsUsed: 'Free AI analysis credits are used up. Upgrade to Pro?',
    analysisFailed: 'Analysis failed.',
    pnlCalendar: 'PnL Calendar',
    calendarSubtitle: 'Daily and weekly trading performance by month.',
    previous: 'Previous',
    today: 'Today',
    next: 'Next',
    loadingTrades: 'Loading trades...',
    tradesThisMonth: 'trades this month',
    tradingDays: 'Trading Days',
    bestDay: 'Best Day',
    worstDay: 'Worst Day',
    week: 'Week',
    noTradesOnDate: 'No trades on this date.',
    entry: 'Entry',
    exit: 'Exit',
    dayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  ko: {
    language: '언어',
    dashboard: '대시보드',
    newEntry: '새 일지',
    history: '기록',
    calendar: '캘린더',
    coach: '코치',
    logout: '로그아웃',
    aiCredits: 'AI 크레딧',
    upgradePro: 'Pro 업그레이드',
    proPlan: 'Pro 플랜',
    unlimited: '무제한',
    dashboardSubtitle: '거래를 기록하고, 복기하고, AI 피드백을 받아보세요.',
    totalTrades: '총 거래',
    records: '건',
    winRate: '승률',
    closedTrades: '완료 거래',
    totalPnl: '총 손익',
    editing: '수정 중',
    cancel: '취소',
    symbol: '종목',
    direction: '방향',
    long: '롱',
    short: '숏',
    entryPrice: '진입가',
    exitPrice: '청산가',
    quantity: '수량',
    emotion: '감정',
    tradeRationale: '매매 근거',
    rationalePlaceholder: '왜 이 거래에 진입했나요?',
    notesReview: '메모 / 복기',
    notesPlaceholder: '무슨 일이 있었고, 무엇을 반복하거나 피해야 하나요?',
    chartImage: '차트 이미지',
    uploadChart: '차트 이미지 업로드',
    estimatedPnl: '예상 손익',
    saving: '저장 중...',
    updateTrade: '거래 수정',
    saveTrade: '거래 저장',
    coachAccess: '코치 공유',
    coachSubtitle: '코치가 거래 일지를 검토할 수 있도록 공유합니다.',
    processing: '처리 중...',
    sharingOn: '공유 중',
    shareWithCoach: '코치에게 공유',
    trades: '거래',
    noTradesYet: '아직 거래 기록이 없습니다.',
    edit: '수정',
    delete: '삭제',
    analyzing: '분석 중...',
    aiAnalyze: 'AI 분석',
    left: '남음',
    rationale: '근거:',
    notes: '메모:',
    alertPrices: '진입가와 청산가를 모두 입력하세요.',
    alertLogin: '먼저 로그인해 주세요.',
    updateFailed: '수정 실패',
    saveFailed: '저장 실패',
    deleteConfirm: '이 거래를 삭제할까요?',
    deleteFailed: '삭제 실패',
    shareFailed: '공유 실패',
    creditsUsed: '무료 AI 분석 크레딧을 모두 사용했습니다. Pro로 업그레이드할까요?',
    analysisFailed: '분석에 실패했습니다.',
    pnlCalendar: '손익 캘린더',
    calendarSubtitle: '월별 일간 및 주간 거래 성과를 확인하세요.',
    previous: '이전',
    today: '오늘',
    next: '다음',
    loadingTrades: '거래를 불러오는 중...',
    tradesThisMonth: '이번 달 거래',
    tradingDays: '거래일',
    bestDay: '최고 수익일',
    worstDay: '최대 손실일',
    week: '주간',
    noTradesOnDate: '이 날짜에는 거래가 없습니다.',
    entry: '진입',
    exit: '청산',
    dayLabels: ['일', '월', '화', '수', '목', '금', '토'],
  },
} as const

export const emotionOptions = [
  { value: 'Calm', en: 'Calm', ko: '차분' },
  { value: 'Confident', en: 'Confident', ko: '자신감' },
  { value: 'Focused', en: 'Focused', ko: '집중' },
  { value: 'Rushed', en: 'Rushed', ko: '조급함' },
  { value: 'Anxious', en: 'Anxious', ko: '불안' },
  { value: 'Revenge', en: 'Revenge', ko: '복수심' },
  { value: 'Patient', en: 'Patient', ko: '인내' },
  { value: 'Excited', en: 'Excited', ko: '흥분' },
] as const

export function getEmotionLabel(value: string, language: Language) {
  const option = emotionOptions.find((item) => item.value === value || item.ko === value || item.en === value)
  return option ? option[language] : value
}

function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en'

  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'ko' || saved === 'en' ? saved : 'en'
}

function subscribeToLanguageChange(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener('tradelog-language-change', callback)

  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('tradelog-language-change', callback)
  }
}

export function useLanguage() {
  const language = useSyncExternalStore<Language>(subscribeToLanguageChange, getStoredLanguage, () => 'en')

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = (nextLanguage: Language) => {
    window.localStorage.setItem(STORAGE_KEY, nextLanguage)
    document.documentElement.lang = nextLanguage
    window.dispatchEvent(new Event('tradelog-language-change'))
  }

  return {
    language,
    setLanguage,
    t: copy[language],
  }
}

export function LanguageToggle({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  return (
    <div className="flex min-h-11 items-center rounded-lg border border-white/[0.08] bg-[#111522] p-1">
      <button
        type="button"
        onClick={() => setLanguage('ko')}
        className={`min-h-9 rounded-md px-3 text-xs font-medium transition-colors ${language === 'ko' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-slate-200'}`}
      >
        한국어
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`min-h-9 rounded-md px-3 text-xs font-medium transition-colors ${language === 'en' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-slate-200'}`}
      >
        English
      </button>
    </div>
  )
}
