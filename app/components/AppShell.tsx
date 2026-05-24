'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import FeedbackWidget from './FeedbackWidget'

type Profile = {
  plan: 'free' | 'pro'
  ai_credits: number
}

const navItems = [
  { href: '/', label: '홈', icon: '🏠' },
  { href: '/history', label: '기록', icon: '📋' },
  { href: '/analysis', label: 'AI 분석', icon: '🤖' },
  { href: '/community', label: '커뮤니티', icon: '👥' },
  { href: '/settings', label: '설정', icon: '⚙️' },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<Profile>({ plan: 'free', ai_credits: 15 })
  const [showPwaBanner, setShowPwaBanner] = useState(() => {
    if (typeof window === 'undefined') return false
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const dismissed = window.localStorage.getItem('pwa-install-banner-dismissed') === '1'
    return !standalone && !dismissed
  })

  const activeHref = useMemo(() => {
    if (pathname === '/') return '/'
    return navItems.find((item) => pathname.startsWith(item.href) && item.href !== '/')?.href || '/'
  }, [pathname])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!user) return
      setEmail(user.email || '')
      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan, ai_credits')
        .eq('id', user.id)
        .single()
      if (profileData) setProfile(profileData as Profile)
    })
  }, [])

  const logout = () => {
    supabase.auth.signOut().finally(() => window.location.replace('/login'))
  }

  const dismissPwaBanner = () => {
    window.localStorage.setItem('pwa-install-banner-dismissed', '1')
    setShowPwaBanner(false)
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0f1117] text-white lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#1a1f2e] lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
        <div className="border-b border-white/[0.06] px-5 py-5">
          <Link href="/" className="flex min-h-11 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-base font-black text-black">T</div>
            <span className="truncate text-base font-bold text-slate-100">TradeLog AI</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = activeHref === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                  active ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mx-3 mb-3 rounded-xl border border-white/[0.06] bg-[#0f1117] p-4">
          {profile.plan === 'free' ? (
            <>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">AI 크레딧</span>
                <span className={profile.ai_credits <= 3 ? 'font-bold text-red-400' : 'font-bold text-amber-400'}>{profile.ai_credits} / 15</span>
              </div>
              <div className="mb-3 h-1.5 rounded-full bg-white/[0.08]">
                <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(100, (profile.ai_credits / 15) * 100))}%` }} />
              </div>
              <Link href="/pricing" className="flex min-h-11 items-center justify-center rounded-xl bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400">
                Pro 업그레이드
              </Link>
            </>
          ) : (
            <div className="flex min-h-11 items-center justify-between text-sm">
              <span className="font-semibold text-emerald-400">Pro 플랜</span>
              <span className="text-xs text-slate-500">무제한</span>
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.06] px-3 py-4">
          {email && (
            <div className="mb-2 min-w-0 rounded-xl px-3 py-2">
              <div className="truncate text-xs text-slate-500">{email}</div>
            </div>
          )}
          <button onClick={logout} className="flex min-h-11 w-full items-center rounded-xl px-3 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400">
            로그아웃
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-[calc(76px+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-0">
        {showPwaBanner && (
          <div className="sticky top-0 z-20 border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl items-center gap-3 text-sm text-amber-100">
              <span className="shrink-0">📱</span>
              <span className="min-w-0 flex-1">홈 화면에 추가하면 앱처럼 사용할 수 있어요!</span>
              <button onClick={dismissPwaBanner} className="min-h-11 rounded-lg px-3 text-amber-200 hover:bg-white/[0.06]">닫기</button>
            </div>
          </div>
        )}
        {children}
      </div>

      <FeedbackWidget />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#111522]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden">
        <div className="grid h-[60px] grid-cols-5 gap-1">
          {navItems.map((item) => {
            const active = activeHref === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-1 text-[11px] font-semibold transition-colors ${
                  active ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="mt-1 truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
