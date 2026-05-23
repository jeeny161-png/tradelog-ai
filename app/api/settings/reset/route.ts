import { NextResponse } from 'next/server'
import { getAuthedUser, getSupabaseAdmin } from '@/lib/server'

type ResetAction = 'mt5-trades' | 'all-trades' | 'goals' | 'all-data'

export async function POST(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const action = body.action as ResetAction
  const confirm = body.confirm as string

  if (confirm !== 'RESET') {
    return NextResponse.json({ error: 'Type RESET to confirm reset.' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  if (action === 'mt5-trades') {
    const { error: deleteError, count } = await supabaseAdmin
      .from('trades')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .not('mt5_ticket', 'is', null)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    return NextResponse.json({ ok: true, deletedTrades: count || 0 })
  }

  if (action === 'all-trades') {
    const { error: deleteError, count } = await supabaseAdmin
      .from('trades')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    return NextResponse.json({ ok: true, deletedTrades: count || 0 })
  }

  if (action === 'goals') {
    const { error: deleteError, count } = await supabaseAdmin
      .from('goals')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
    return NextResponse.json({ ok: true, deletedGoals: count || 0 })
  }

  if (action === 'all-data') {
    const trades = await supabaseAdmin
      .from('trades')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)

    if (trades.error) return NextResponse.json({ error: trades.error.message }, { status: 500 })

    const goals = await supabaseAdmin
      .from('goals')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)

    if (goals.error) return NextResponse.json({ error: goals.error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      deletedTrades: trades.count || 0,
      deletedGoals: goals.count || 0,
    })
  }

  return NextResponse.json({ error: 'Invalid reset action.' }, { status: 400 })
}
