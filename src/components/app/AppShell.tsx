'use client';

// src/components/app/AppShell.tsx
// Main app layout: top bar (logo + workspace switcher + user), sidebar (desktop) / bottom nav (mobile), content area
// Authentication removed — app is integrated directly with SFMC

import React, { useEffect, useState } from 'react';
import { LayoutDashboard, MessageSquare, Users2, BarChart3, Zap, Settings, Cloud, LayoutTemplate, Megaphone, Workflow, RefreshCw } from 'lucide-react';
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import DashboardView from '@/components/app/DashboardView';
import ChatsView from '@/components/app/ChatsView';
import ContactsView from '@/components/app/ContactsView';
import TemplatesView from '@/components/app/TemplatesView';
import BroadcastsView from '@/components/app/BroadcastsView';
import AutomationView from '@/components/app/AutomationView';
import AnalyticsView from '@/components/app/AnalyticsView';
import SettingsView from '@/components/app/SettingsView';
import FastReplyView from '@/components/app/FastReplyView';
import SFMCView from '@/components/app/SFMCView';
import type { AppScreen } from '@/types/workspace';

const NAV_ITEMS: { key: AppScreen; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { key: 'chats', label: 'Chats', icon: <MessageSquare size={20} /> },
  { key: 'contacts', label: 'Contacts', icon: <Users2 size={20} /> },
  { key: 'templates', label: 'Templates', icon: <LayoutTemplate size={20} /> },
  { key: 'broadcasts', label: 'Broadcasts', icon: <Megaphone size={20} /> },
  { key: 'automation', label: 'Automation', icon: <Workflow size={20} /> },
  { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
  { key: 'sfmc', label: 'SFMC', icon: <Cloud size={20} /> },
  { key: 'fast-reply', label: 'Fast Reply', icon: <Zap size={20} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={20} /> },
];

export default function AppShell() {
  const { state, setActiveScreen, activeWorkspace } = useWorkspace();
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Derive display name from active workspace
  const displayName = activeWorkspace?.name || 'SFMC User';
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const activeScreen = state.activeScreen;

  const renderContent = () => {
    switch (activeScreen) {
      case 'dashboard': return <DashboardView />;
      case 'chats': return <ChatsView />;
      case 'contacts': return <ContactsView />;
      case 'templates': return <TemplatesView />;
      case 'broadcasts': return <BroadcastsView />;
      case 'automation': return <AutomationView />;
      case 'analytics': return <AnalyticsView />;
      case 'settings': return <SettingsView />;
      case 'sfmc': return <SFMCView />;
      case 'fast-reply': return <FastReplyView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      
      {/* ─── Top Bar ─── */}
      <header className="flex items-center justify-between px-5 h-[56px] bg-white border-b border-gray-200 shrink-0 z-50">
        
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-sm shadow-green-600/15">
             <MessageSquare size={16} strokeWidth={2.5} className="text-white" />
          </div>
          <span className="font-[Syne] font-bold text-lg tracking-tight text-gray-900">
            WhatZupp
          </span>
        </div>

        {/* Center: Workspace Switcher & Refresh */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => window.location.reload()} 
            className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-[#25D366]/30 hover:bg-[#25D366]/5 text-gray-500 hover:text-[#25D366] transition-all focus:outline-none focus:ring-2 focus:ring-[#25D366]/20"
            title="Refresh App"
          >
            <RefreshCw size={18} />
          </button>
          <WorkspaceSwitcher />
        </div>

        {/* Right: User Display */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-sm"
            >
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden md:inline-block">
              {displayName}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Body: Sidebar + Content ─── */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Desktop Sidebar */}
        {!isMobile && (
          <nav className="w-[72px] bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 shrink-0">
            {NAV_ITEMS.map(item => {
              const isActive = activeScreen === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveScreen(item.key)}
                  title={item.label}
                  className={`w-[52px] h-[52px] rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative group
                    ${isActive
                      ? 'bg-[#25D366]/[0.08] text-[#25D366]'
                      : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}
                  `}
                >
                  {isActive && (
                    <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[#25D366]" />
                  )}
                  <span>{item.icon}</span>
                  <span className={`text-[9px] ${isActive ? 'font-bold text-[#25D366]' : 'font-medium text-gray-400'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-hidden flex">
          {renderContent()}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="flex bg-white border-t border-gray-200 py-1.5 shrink-0 px-2 pb-safe">
          {NAV_ITEMS.slice(0, 5).map(item => {
            const isActive = activeScreen === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveScreen(item.key)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-1
                  ${isActive ? 'text-[#25D366]' : 'text-gray-400'}
                `}
              >
                <span>{item.icon}</span>
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
