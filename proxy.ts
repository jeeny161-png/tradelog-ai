import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  console.log('[proxy] path:', request.nextUrl.pathname)
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  const cookies = request.cookies.getAll()
  console.log('[proxy] cookies:', cookies.map(c => c.name))

  const { data: { user }, error } = await supabase.auth.getUser()
  console.log('[proxy] user:', user?.id ?? null, '| error:', error?.message ?? null)

  const publicPaths = ['/login', '/logout', '/api/logout', '/api/mt5', '/pricing', '/api/payment/billing', '/api/payment/confirm']
  if (!user && !publicPaths.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
