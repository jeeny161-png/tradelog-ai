import Link from 'next/link'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type SharePageProps = {
  params: Promise<{ token: string }>
}

export default async function PublicSharePage({ params }: SharePageProps) {
  const { token } = await params
  const supabaseAdmin = getSupabaseAdmin()
  const { data: trade } = await supabaseAdmin
    .from('trades')
    .select('symbol, direction, entry_price, exit_price, quantity, pnl, emotion, rationale, notes, date, chart_image_url')
    .eq('share_token', token)
    .single()

  if (!trade) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 text-white">
        <div className="max-w-md rounded-xl border border-white/[0.08] bg-[#1a1f2e] p-6 text-center">
          <h1 className="text-xl font-semibold">Trade not found</h1>
          <p className="mt-2 text-sm text-slate-500">This public link is invalid or has expired.</p>
          <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black">
            Go to TradeLog AI
          </Link>
        </div>
      </main>
    )
  }

  const positive = Number(trade.pnl) >= 0
  const aiAnalysis = await createPublicAnalysis(trade).catch(() => 'AI analysis is temporarily unavailable.')

  return (
    <main className="min-h-screen bg-[#0f1117] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-black">T</div>
          <span className="text-sm font-semibold">TradeLog AI</span>
        </div>

        <section className="rounded-xl border border-white/[0.08] bg-[#1a1f2e] p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="break-words text-2xl font-bold text-slate-100">{trade.symbol}</h1>
              <p className="mt-1 text-sm text-slate-500">{trade.date} · {trade.direction === 'L' ? 'Long' : 'Short'} · {trade.quantity} lot</p>
            </div>
            <div className={`font-mono text-2xl font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {positive ? '+' : ''}{Number(trade.pnl).toLocaleString()}
            </div>
          </div>

          {trade.chart_image_url && (
            <img src={trade.chart_image_url} alt="Trade chart" className="mb-5 w-full rounded-lg border border-white/[0.08]" />
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Entry" value={trade.entry_price} />
            <Info label="Exit" value={trade.exit_price} />
            <Info label="Emotion" value={trade.emotion || '-'} />
            <Info label="Direction" value={trade.direction === 'L' ? 'Long' : 'Short'} />
          </div>

          <div className="mt-5 space-y-3 rounded-lg border border-white/[0.06] bg-[#0f1117] p-4 text-sm leading-relaxed text-slate-400">
            {trade.rationale && <p><span className="font-medium text-slate-200">Rationale:</span> {trade.rationale}</p>}
            {trade.notes && <p><span className="font-medium text-slate-200">Notes:</span> {trade.notes}</p>}
            <div>
              <div className="mb-2 font-medium text-amber-400">AI analysis</div>
              <p className="whitespace-pre-line">{aiAnalysis}</p>
            </div>
          </div>
        </section>

        <Link href="/login" className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 text-sm font-semibold text-black">
          Sign up to TradeLog AI
        </Link>
      </div>
    </main>
  )
}

async function createPublicAnalysis(trade: Record<string, unknown>) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Briefly analyze this shared trade for educational purposes. Avoid financial advice. Trade: ${JSON.stringify(trade)}`,
    }],
  })
  return message.content[0].type === 'text' ? message.content[0].text : 'No analysis generated.'
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-[#0f1117] p-3">
      <div className="text-xs uppercase tracking-wider text-slate-600">{label}</div>
      <div className="mt-1 break-all font-mono text-slate-200">{value}</div>
    </div>
  )
}
