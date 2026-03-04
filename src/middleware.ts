import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Public paths that don't require authentication
  const publicPaths = ['/login', '/register', '/']
  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }
  
  // Check for auth token (just check existence, don't verify in middleware)
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    // Redirect to login if no token
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // For API routes, just check token existence
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // For page routes, let the client-side handle role checking
  // Token verification will happen in API routes or client-side
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/tickets/:path*',
    '/api/tickets/:path*',
    '/api/messages/:path*',
    '/api/users/:path*',
    '/api/audit-logs/:path*',
  ]
}
