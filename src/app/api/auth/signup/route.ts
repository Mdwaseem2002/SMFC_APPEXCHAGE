import { NextRequest, NextResponse } from 'next/server';

// Signup endpoint disabled — SFMC integration handles authentication.
// Returns success no-op to avoid 404s.

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Authentication is handled by SFMC. No signup required.',
    user: { id: 'sfmc-user', name: 'SFMC User', email: 'sfmc@whatzupp.com' },
  });
}
