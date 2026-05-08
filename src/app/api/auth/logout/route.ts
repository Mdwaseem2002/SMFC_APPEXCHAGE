import { NextResponse } from 'next/server';

// Logout endpoint disabled — SFMC integration handles authentication.
// Returns success no-op to avoid 404s.

export async function POST() {
  return NextResponse.json({ success: true });
}
