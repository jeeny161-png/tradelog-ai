import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const COACH_EMAIL = 'jeeny161@gmail.com'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getAuthedUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return { user: null, error: 'Authentication is required.' }
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) {
    return { user: null, error: 'Invalid session.' }
  }

  return { user: data.user, error: null }
}

export async function GET(req: Request) {
  const { user, error } = await getAuthedUser(req)

  if (error || !user) {
    return NextResponse.json({ error }, { status: 401 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data, error: shareError } = await supabaseAdmin
    .from('shares')
    .select('id')
    .eq('user_id', user.id)
    .eq('coach_email', COACH_EMAIL)
    .eq('status', 'active')
    .maybeSingle()

  if (shareError) {
    return NextResponse.json({ error: shareError.message }, { status: 500 })
  }

  return NextResponse.json({ shared: Boolean(data) })
}

export async function POST(req: Request) {
  const { user, error } = await getAuthedUser(req)

  if (error || !user) {
    return NextResponse.json({ error }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const action = body.action as 'share' | 'unshare' | undefined

  if (action !== 'share' && action !== 'unshare') {
    return NextResponse.json({ error: 'Invalid share action.' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  if (action === 'unshare') {
    const { error: deleteError } = await supabaseAdmin
      .from('shares')
      .delete()
      .eq('user_id', user.id)
      .eq('coach_email', COACH_EMAIL)
      .eq('status', 'active')

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ shared: false })
  }

  await supabaseAdmin
    .from('shares')
    .delete()
    .eq('user_id', user.id)
    .eq('coach_email', COACH_EMAIL)
    .eq('status', 'active')

  const { error: insertError } = await supabaseAdmin.from('shares').insert({
    user_id: user.id,
    user_email: user.email,
    coach_email: COACH_EMAIL,
    status: 'active',
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ shared: true })
}
