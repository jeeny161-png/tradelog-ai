import { NextResponse } from 'next/server'
import { getAuthedUser, getSupabaseAdmin } from '@/lib/server'

export async function GET(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })

  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin.from('profiles').select('mt5_api_key').eq('id', user.id).maybeSingle()

  if (data?.mt5_api_key) return NextResponse.json({ apiKey: data.mt5_api_key })

  const apiKey = crypto.randomUUID()
  const updateError = await saveMt5ApiKey(user.id, apiKey)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ apiKey })
}

export async function POST(req: Request) {
  const { user, error } = await getAuthedUser(req)
  if (error || !user) return NextResponse.json({ error }, { status: 401 })

  const apiKey = crypto.randomUUID()
  const updateError = await saveMt5ApiKey(user.id, apiKey)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ apiKey })
}

async function saveMt5ApiKey(userId: string, apiKey: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (lookupError) return lookupError

  if (existing) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ mt5_api_key: apiKey })
      .eq('id', userId)
    return error
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .insert({ id: userId, mt5_api_key: apiKey, plan: 'free', ai_credits: 15 })
  return error
}
