'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type {
  Workspace,
  UserProfile,
  WorkspaceContact,
  FastReplyTemplate,
  AppScreen,
  ThemeMode,
  AppState,
} from '@/types/workspace';

interface WorkspaceContextValue {
  state: AppState;
  isReady: boolean;
  setProfile: (profile: UserProfile) => Promise<void>;
  completeOnboarding: () => void;
  addWorkspace: (ws: Omit<Workspace, 'id' | 'createdAt'>) => Promise<Workspace>;
  updateWorkspace: (id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  activeWorkspace: Workspace | null;
  addContact: (contact: Omit<WorkspaceContact, 'id' | 'createdAt'>) => Promise<WorkspaceContact>;
  updateContact: (id: string, updates: Partial<Omit<WorkspaceContact, 'id' | 'createdAt'>>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  activeContacts: WorkspaceContact[];
  allContacts: WorkspaceContact[];
  getWorkspaceForPhone: (phone: string) => string | null;
  isPhoneVisibleInActiveWorkspace: (phone: string) => boolean;
  addFastReply: (reply: Omit<FastReplyTemplate, 'id' | 'createdAt'>) => Promise<void>;
  updateFastReply: (id: string, updates: Partial<Omit<FastReplyTemplate, 'id' | 'createdAt'>>) => Promise<void>;
  deleteFastReply: (id: string) => Promise<void>;
  activeFastReplies: FastReplyTemplate[];
  setActiveScreen: (screen: AppScreen) => void;
  setTheme: (theme: ThemeMode) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  return String(phone).replace(/^\+/, '');
}

const DEFAULT_WORKSPACE: Workspace = {
  id: 'default-ws',
  name: 'Default Workspace',
  color: '#3b82f6',
  icon: 'Building2',
  createdAt: new Date().toISOString(),
};

const DEFAULT_STATE: AppState = {
  onboardingComplete: true,
  profile: null,
  workspaces: [DEFAULT_WORKSPACE],
  contacts: [],
  fastReplies: [],
  activeWorkspaceId: 'default-ws',
  activeScreen: 'dashboard',
  theme: 'light',
};

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [isReady, setIsReady] = useState(false);

  // Sync data from backend on mount
  // Auth/onboarding bypassed — SFMC integration handles identity
  useEffect(() => {
    const fetchSync = async () => {
      try {
        const res = await fetch('/api/user/sync');
        if (res.ok) {
          const { data } = await res.json();
          const workspaces = data.workspaces?.length > 0 ? data.workspaces : [DEFAULT_WORKSPACE];
          setState(prev => ({
            ...prev,
            profile: data.profile || null,
            workspaces,
            contacts: data.contacts || [],
            fastReplies: data.fastReplies || [],
            onboardingComplete: true,
            activeWorkspaceId: workspaces[0]?.id || 'default-ws',
            activeScreen: 'dashboard',
          }));
        }
      } catch (e) {
        console.error('Failed to sync workspace data', e);
        // Even on failure, ensure dashboard is accessible with defaults
      } finally {
        setIsReady(true);
      }
    };
    fetchSync();
  }, []);

  // Sync theme
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', state.theme);
    }
  }, [state.theme]);

  // Mutations (Async)
  const setProfile = useCallback(async (profile: UserProfile) => {
    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update profile');
    setState(prev => ({ ...prev, profile: json.data }));
  }, []);

  const completeOnboarding = useCallback(() => {
    setState(prev => {
      const firstWs = prev.workspaces[0];
      return {
        ...prev,
        onboardingComplete: true,
        activeWorkspaceId: firstWs?.id || null,
        activeScreen: 'dashboard',
      };
    });
  }, []);

  const addWorkspace = useCallback(async (ws: Omit<Workspace, 'id' | 'createdAt'>): Promise<Workspace> => {
    const res = await fetch('/api/user/workspaces', { method: 'POST', body: JSON.stringify(ws) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add workspace');
    setState(prev => ({ ...prev, workspaces: [...prev.workspaces, json.data] }));
    return json.data;
  }, []);

  const updateWorkspace = useCallback(async (id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) => {
    // Implement API route logic if needed; for now we skip partial patching backend since no setup needs it currently,
    // but we can optimistic update local UI
    setState(prev => ({
      ...prev,
      workspaces: prev.workspaces.map(ws => ws.id === id ? { ...ws, ...updates } : ws),
    }));
  }, []);

  const deleteWorkspace = useCallback(async (id: string) => {
    try {
      await fetch(`/api/user/workspaces?id=${id}`, { method: 'DELETE' });
      setState(prev => {
        const filtered = prev.workspaces.filter(ws => ws.id !== id);
        const newActiveId = prev.activeWorkspaceId === id ? (filtered[0]?.id || null) : prev.activeWorkspaceId;
        return {
          ...prev,
          workspaces: filtered,
          activeWorkspaceId: newActiveId,
          contacts: prev.contacts.filter(c => c.workspaceId !== id),
        };
      });
    } catch (e) { console.error(e); }
  }, []);

  const setActiveWorkspace = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeWorkspaceId: id }));
  }, []);

  const activeWorkspace = useMemo(() => {
    return state.workspaces.find(ws => ws.id === state.activeWorkspaceId) || null;
  }, [state.workspaces, state.activeWorkspaceId]);

  // Contacts
  const addContact = useCallback(async (contact: Omit<WorkspaceContact, 'id' | 'createdAt'>): Promise<WorkspaceContact> => {
    const res = await fetch('/api/user/contacts', { method: 'POST', body: JSON.stringify(contact) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add contact');
    setState(prev => ({ ...prev, contacts: [json.data, ...prev.contacts] }));
    return json.data;
  }, []);

  const updateContact = useCallback(async (id: string, updates: Partial<Omit<WorkspaceContact, 'id' | 'createdAt'>>) => {
    try {
      const res = await fetch('/api/user/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update contact');
      
      setState(prev => ({
        ...prev,
        contacts: prev.contacts.map(c => c.id === id ? { ...c, ...updates } : c),
      }));
    } catch (e) {
      console.error('Failed to update contact:', e);
      throw e;
    }
  }, []);

  const deleteContact = useCallback(async (id: string) => {
    try {
      await fetch(`/api/user/contacts?id=${id}`, { method: 'DELETE' });
      setState(prev => ({ ...prev, contacts: prev.contacts.filter(c => c.id !== id) }));
    } catch (e) { console.error(e); }
  }, []);

  const activeContacts = useMemo(() => {
    if (!state.activeWorkspaceId) return [];
    return state.contacts.filter(c => c.workspaceId === state.activeWorkspaceId);
  }, [state.contacts, state.activeWorkspaceId]);

  const allContacts = state.contacts;

  const getWorkspaceForPhone = useCallback((phone: string): string | null => {
    const normalized = normalizePhone(phone);
    const contact = state.contacts.find(c => normalizePhone(c.phoneNumber) === normalized);
    return contact?.workspaceId || null;
  }, [state.contacts]);

  const isPhoneVisibleInActiveWorkspace = useCallback((phone: string): boolean => {
    const normalized = normalizePhone(phone);
    const contact = state.contacts.find(c => normalizePhone(c.phoneNumber) === normalized);
    // STRICT WORKSPACE ISOLATION: if no matching contact, hide it (no cross-workspace leakage)
    if (!contact) return false;
    return contact.workspaceId === state.activeWorkspaceId;
  }, [state.contacts, state.activeWorkspaceId]);

  // Fast Replies
  const addFastReply = useCallback(async (reply: Omit<FastReplyTemplate, 'id' | 'createdAt'>) => {
    const res = await fetch('/api/user/fast-replies', { method: 'POST', body: JSON.stringify(reply) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to add fast reply');
    setState(prev => ({ ...prev, fastReplies: [...prev.fastReplies, json.data] }));
    return json.data;
  }, []);

  const updateFastReply = useCallback(async (id: string, updates: Partial<Omit<FastReplyTemplate, 'id' | 'createdAt'>>) => {
    setState(prev => ({
      ...prev,
      fastReplies: prev.fastReplies.map(r => r.id === id ? { ...r, ...updates } : r),
    }));
  }, []);

  const deleteFastReply = useCallback(async (id: string) => {
    try {
      await fetch(`/api/user/fast-replies?id=${id}`, { method: 'DELETE' });
      setState(prev => ({ ...prev, fastReplies: prev.fastReplies.filter(r => r.id !== id) }));
    } catch(e) { console.error(e); }
  }, []);

  const activeFastReplies = useMemo(() => {
    return state.fastReplies; // Fast replies are user-scoped now, all available
  }, [state.fastReplies]);

  const setActiveScreen = useCallback((screen: AppScreen) => {
    setState(prev => ({ ...prev, activeScreen: screen }));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    setState(prev => ({ ...prev, theme }));
  }, []);

  const value: WorkspaceContextValue = useMemo(() => ({
    state, isReady, setProfile, completeOnboarding, addWorkspace, updateWorkspace, deleteWorkspace, setActiveWorkspace, activeWorkspace,
    addContact, updateContact, deleteContact, activeContacts, allContacts, getWorkspaceForPhone, isPhoneVisibleInActiveWorkspace,
    addFastReply, updateFastReply, deleteFastReply, activeFastReplies, setActiveScreen, setTheme,
  }), [
    state, isReady, setProfile, completeOnboarding, addWorkspace, updateWorkspace, deleteWorkspace, setActiveWorkspace, activeWorkspace,
    addContact, updateContact, deleteContact, activeContacts, allContacts, getWorkspaceForPhone, isPhoneVisibleInActiveWorkspace,
    addFastReply, updateFastReply, deleteFastReply, activeFastReplies, setActiveScreen, setTheme,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
