'use client';

// src/app/dashboard/page.tsx
// Dashboard route — renders AppShell directly (SFMC integration, no auth/onboarding required)

import React from 'react';
import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider';
import AppShell from '@/components/app/AppShell';

export default function DashboardPage() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}
