import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { getAuthedUser, getSupabaseAdmin } from '@/lib/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })

  const { groupId } = await req.json().catch(() => ({ groupId: null }))
  if (!groupId) return NextResponse.json({ error: 'groupId is required.' }, { status: 400 })

  const supabaseAdmin = getSupabaseAdmin()
  const { data: membership } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'You are not a member of this group.' }, { status: 403 })

  const { data: members, error: membersError } = await supabaseAdmin
    .from('group_members')
    .select('user_id, role, joined_at')
    .eq('group_id', groupId)

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

  const memberIds = (members || []).map((member) => member.user_id)
  if (!memberIds.length) return NextResponse.json({ insights: 'No group members found.' })

  const { data: trades, error: tradesError } = await supabaseAdmin
    .from('trades')
    .select('user_id, symbol, direction, pnl, emotion, date')
    .in('user_id', memberIds)
    .order('date', { ascending: false })
    .limit(500)

  if (tradesError) return NextResponse.json({ error: tradesError.message }, { status: 500 })

  const prompt = `You are a trading study-group coach. Analyze shared behavior patterns across this group.
Do not reveal member identities. Focus on:
- common losing patterns
- strongest setups/symbols
- emotion patterns
- practical group study recommendations

Members: ${members?.length ?? 0}
Trades JSON:
${JSON.stringify(trades || []).slice(0, 18000)}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ insights: text })
}
