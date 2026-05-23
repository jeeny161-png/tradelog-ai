import { NextResponse } from 'next/server'
import { getAuthedUser, getSupabaseAdmin } from '@/lib/server'

export async function GET(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })

  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin.from('profiles').select('mt5_api_key').eq('id', user.id).single()

  if (data?.mt5_api_key) return NextResponse.json({ apiKey: data.mt5_api_key })

  const apiKey = crypto.randomUUID()
  const { error: updateError } = await supabaseAdmin.from('profiles').upsert({ id: user.id, mt5_api_key: apiKey })
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ apiKey })
}

export async function POST(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })

  const apiKey = crypto.randomUUID()
  const supabaseAdmin = getSupabaseAdmin()
  const { error: updateError } = await supabaseAdmin.from('profiles').upsert({ id: user.id, mt5_api_key: apiKey })
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ apiKey })
}
