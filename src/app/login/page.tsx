'use client';

// src/app/login/page.tsx
// Login page disabled — SFMC integration handles authentication.
// Redirects to Dashboard.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-gray-400 text-sm">Redirecting to Dashboard...</p>
    </div>
  );
}
