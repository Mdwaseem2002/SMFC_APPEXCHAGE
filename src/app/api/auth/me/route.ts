import { NextResponse } from 'next/server';

// Auth check bypassed — SFMC integration handles authentication.
// Always returns authenticated with a default SFMC user.

export async function GET() {
  return NextResponse.json({
    authenticated: true,
    user: {
      id: 'sfmc-user',
      name: 'SFMC User',
      email: 'sfmc@whatzupp.com',
    },
  });
}
