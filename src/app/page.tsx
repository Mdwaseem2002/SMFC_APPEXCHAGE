'use client';

// src/app/page.tsx
// Root route — renders the Dashboard directly (SFMC integration, no auth required)

import React from 'react';
import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider';
import AppShell from '@/components/app/AppShell';

export default function RootPage() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}