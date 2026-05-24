'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

const CATEGORIES = ['버그 신고', '기능 제안', '칭찬', '기타'] as const
type Category = (typeof CATEGORIES)[number]

const CATEGORY_ICONS: Record<Category, string> = {
  '버그 신고': '🐛',
  '기능 제안': '💡',
  '칭찬': '🎉',
  '기타': '📝',
}

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<Category>('기능 제안')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when modal opens
  useEffect(() => {
    if (open && !done) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open, done])

  // Reset state when closed
  const handleClose = () => {
    setOpen(false)
    setTimeout(() => {
      setDone(false)
      setMessage('')
      setRating(null)
      setHoverRating(null)
      setCategory('기능 제안')
    }, 300)
  }

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return
    setSubmitting(true)

    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ category, message, rating }),
    })

    setSubmitting(false)
    if (response.ok) {
      setDone(true)
    } else {
      const data = await response.json().catch(() => ({}))
      alert(data.error || '제출에 실패했습니다. 다시 시도해주세요.')
    }
  }

  const displayRating = hoverRating ?? rating

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="피드백 보내기"
        className="fixed right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-xl shadow-lg shadow-amber-500/30 transition-transform hover:scale-110 hover:bg-amber-400 active:scale-95 bottom-[calc(76px+env(safe-area-inset-bottom)+12px)] lg:bottom-6 lg:right-6 lg:h-14 lg:w-14"
      >
        💬
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 p-4 flex items-end justify-end sm:items-center sm:justify-center"
          onClick={handleClose}
        >
          {/* Modal */}
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1a1f2e] p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              /* Success state */
              <div className="py-6 text-center">
                <div className="mb-3 text-5xl">🎉</div>
                <h2 className="mb-2 text-lg font-bold text-slate-100">감사합니다!</h2>
                <p className="mb-6 text-sm text-slate-400">소중한 피드백을 보내주셔서 감사해요. 더 나은 서비스로 보답하겠습니다.</p>
                <button
                  onClick={handleClose}
                  className="min-h-11 rounded-xl bg-amber-500 px-8 text-sm font-bold text-black hover:bg-amber-400"
                >
                  닫기
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-100">피드백 보내기</h2>
                  <button
                    onClick={handleClose}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>

                {/* Category selector */}
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium text-slate-500">카테고리</label>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                          category === cat
                            ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                            : 'border-white/[0.06] bg-[#0f1117] text-slate-400 hover:border-white/[0.12] hover:text-slate-200'
                        }`}
                      >
                        <span className="text-base leading-none">{CATEGORY_ICONS[cat]}</span>
                        <span className="leading-tight">{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium text-slate-500">내용</label>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="어떤 점이 불편하셨나요? 또는 원하시는 기능이 있나요?"
                    rows={4}
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#0f1117] px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                  />
                </div>

                {/* Star rating */}
                <div className="mb-5">
                  <label className="mb-2 block text-xs font-medium text-slate-500">별점 (선택)</label>
                  <div className="flex gap-2" onMouseLeave={() => setHoverRating(null)}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star === rating ? null : star)}
                        onMouseEnter={() => setHoverRating(star)}
                        className={`text-2xl transition-transform hover:scale-110 ${
                          displayRating !== null && star <= displayRating
                            ? 'text-amber-400'
                            : 'text-slate-700'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                    {rating && (
                      <span className="ml-1 self-center text-xs text-slate-500">{rating}점</span>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!message.trim() || submitting}
                  className="min-h-11 w-full rounded-xl bg-amber-500 text-sm font-bold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? '제출 중...' : '보내기'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
