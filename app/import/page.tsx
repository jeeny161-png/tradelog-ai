'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function ImportPage() {
  const [trades, setTrades] = useState<ParsedTrade[]>([])
  const [message, setMessage] = useState('')

  const handleFile = async (file?: File) => {
    if (!file) return
    const text = await file.text()
    const parsed = parseMt5Csv(text)
    setTrades(parsed)
    setMessage(`${parsed.length} trades parsed.`)
  }

  const confirmImport = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return alert('Please log in first.')
    if (!trades.length) return

    const { error } = await supabase.from('trades').insert(trades.map((trade) => ({
      ...trade,
      user_id: user.id,
      emotion: 'Calm',
      notes: 'Imported from MT5 CSV',
    })))
    if (error) return alert(error.message)
    setMessage(`${trades.length} trades imported.`)
    setTrades([])
  }

  return (
    <main className="min-h-screen bg-[#0f1117] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="mb-3 inline-flex text-sm text-amber-400">← Dashboard</Link>
        <h1 className="text-2xl font-bold">MT5 CSV Import</h1>
        <p className="mt-1 text-sm text-slate-500">Drag and drop an MT5 history export. Columns are auto-detected.</p>

        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            void handleFile(event.dataTransfer.files[0])
          }}
          className="mt-6 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.16] bg-[#1a1f2e] p-6 text-center hover:border-amber-500/50"
        >
          <input type="file" accept=".csv,.txt" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
          <div className="text-lg font-semibold">Drop CSV here</div>
          <div className="mt-1 text-sm text-slate-500">or click to choose a file</div>
        </label>

        {message && <p className="mt-4 text-sm text-amber-400">{message}</p>}

        {trades.length > 0 && (
          <>
            <div className="mt-6 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#1a1f2e]">
              <table className="min-w-full text-sm">
                <thead className="bg-[#111522] text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Symbol</th>
                    <th className="px-4 py-3 text-left">Dir</th>
                    <th className="px-4 py-3 text-right">Entry</th>
                    <th className="px-4 py-3 text-right">Exit</th>
                    <th className="px-4 py-3 text-right">Volume</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, index) => (
                    <tr key={`${trade.symbol}-${trade.date}-${index}`} className="border-t border-white/[0.04]">
                      <td className="px-4 py-3">{trade.date}</td>
                      <td className="px-4 py-3">{trade.symbol}</td>
                      <td className="px-4 py-3">{trade.direction}</td>
                      <td className="px-4 py-3 text-right font-mono">{trade.entry_price}</td>
                      <td className="px-4 py-3 text-right font-mono">{trade.exit_price}</td>
                      <td className="px-4 py-3 text-right font-mono">{trade.quantity}</td>
                      <td className={`px-4 py-3 text-right font-mono ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trade.pnl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={confirmImport} className="mt-5 min-h-11 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-black">Confirm import</button>
          </>
        )}
      </div>
    </main>
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

  const raw = rows.slice(1).map((row) => {
    const type = (row[typeIdx] || '').toLowerCase()
    const direction: 'L' | 'S' = type.includes('sell') || type === 's' || type.includes('short') ? 'S' : 'L'
    const time = row[timeIdx] || new Date().toISOString()
    return {
      symbol: row[symbolIdx] || 'UNKNOWN',
      direction,
      entry_price: Number(row[priceIdx]) || 0,
      exit_price: Number(row[priceIdx]) || 0,
      quantity: Number(row[volumeIdx]) || 1,
      pnl: Number(row[profitIdx]) || 0,
      date: toDate(time),
      rationale: `MT5 import${row[slIdx] ? ` SL ${row[slIdx]}` : ''}${row[tpIdx] ? ` TP ${row[tpIdx]}` : ''}`,
      groupKey: `${toDate(time)}-${row[symbolIdx]}-${direction}-${row[slIdx] || ''}-${row[tpIdx] || ''}`,
    }
  }).filter((trade) => trade.symbol !== 'UNKNOWN')

  const grouped = new Map<string, ParsedTrade>()
  for (const trade of raw) {
    const current = grouped.get(trade.groupKey)
    if (!current) {
      grouped.set(trade.groupKey, trade)
    } else {
      current.pnl += trade.pnl
      current.quantity += trade.quantity
      current.exit_price = trade.exit_price || current.exit_price
    }
  }

  return [...grouped.values()].map((trade) => ({
    symbol: trade.symbol,
    direction: trade.direction,
    entry_price: trade.entry_price,
    exit_price: trade.exit_price,
    quantity: trade.quantity,
    pnl: trade.pnl,
    date: trade.date,
    rationale: trade.rationale,
  }))
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
