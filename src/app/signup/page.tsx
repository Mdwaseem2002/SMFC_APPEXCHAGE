'use client';

// src/app/signup/page.tsx
// Signup page disabled — SFMC integration handles authentication.
// Redirects to Dashboard.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-gray-400 text-sm">Redirecting to Dashboard...</p>
    </div>
  );
}
