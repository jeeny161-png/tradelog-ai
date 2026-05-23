import { NextResponse } from 'next/server'

export async function GET() {
  const response = NextResponse.redirect(new URL('http://localhost:3000/login'))
  response.cookies.delete('sb-access-token')
  response.cookies.delete('sb-refresh-token')
  response.cookies.delete('sb-uyppiecjqmatzmfggype-auth-token')
  return response
}