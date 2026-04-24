import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const publicDashboardPaths = ['/dashboard/login', '/dashboard/forgot-password', '/dashboard/reset-password']
  if (pathname.startsWith('/dashboard') && !publicDashboardPaths.some(p => pathname.startsWith(p))) {
    const driverId = request.cookies.get('driver_id')
    if (!driverId?.value) {
      return NextResponse.redirect(new URL('/dashboard/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/dashboard/:path*',
}
