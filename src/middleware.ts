import { NextRequest, NextResponse } from 'next/server';

// Authentication disabled — app is now integrated directly with SFMC.
// All routes are publicly accessible.

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect legacy auth routes to dashboard
  if (pathname === '/login' || pathname === '/signup') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
