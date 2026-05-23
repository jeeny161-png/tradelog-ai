import { createClient } from '@supabase/supabase-js'

export type AuthedUser = {
  id: string
  email?: string
}

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getAuthedUser(req: Request): Promise<{ user: AuthedUser | null; error: string | null }> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { user: null, error: 'Authentication is required.' }

  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return { user: null, error: 'Invalid session.' }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
    error: null,
  }
}

export function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatPnl(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString()}`
}
