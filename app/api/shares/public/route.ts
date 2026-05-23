import { NextResponse } from 'next/server'
import { getAuthedUser, getSupabaseAdmin } from '@/lib/server'

export async function POST(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })

  const { tradeId } = await req.json().catch(() => ({ tradeId: null }))
  if (!tradeId) return NextResponse.json({ error: 'tradeId is required.' }, { status: 400 })

  const supabaseAdmin = getSupabaseAdmin()
  const token = crypto.randomUUID().replaceAll('-', '')

  const { data, error: updateError } = await supabaseAdmin
    .from('trades')
    .update({ share_token: token })
    .eq('id', tradeId)
    .eq('user_id', user.id)
    .select('share_token')
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ token: data.share_token, url: `/share/${data.share_token}` })
}
