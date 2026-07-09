// src/app/hooks/useGlobalNotifications.ts
// Global notification hook — listens to ALL incoming messages via SSE
// and manages unread counts, browser notifications, and sound alerts.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Message } from '@/types';

export interface NotificationEvent {
  phoneNumber: string;
  message: Message;
  contactName?: string;
}

interface UseGlobalNotificationsReturn {
  unreadCounts: Record<string, number>;
  clearUnread: (phoneNumber: string) => void;
  notificationPermission: NotificationPermission | 'default';
  requestPermission: () => Promise<void>;
  latestNotification: NotificationEvent | null;
  dismissNotification: () => void;
  incomingMessageEvent: NotificationEvent | null;
}

// Play a notification sound using Web Audio API
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    // Create a pleasant two-tone notification sound
    const now = audioCtx.currentTime;
    
    // First tone
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(830, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone (higher, slightly delayed)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1040, now + 0.08);
    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.25);
  } catch (e) {
    console.warn('[notifications] Could not play sound:', e);
  }
}

export function useGlobalNotifications(
  selectedPhoneNumber: string | null
): UseGlobalNotificationsReturn {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [latestNotification, setLatestNotification] = useState<NotificationEvent | null>(null);
  const [incomingMessageEvent, setIncomingMessageEvent] = useState<NotificationEvent | null>(null);
  const selectedPhoneRef = useRef(selectedPhoneNumber);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the selectedPhone ref in sync
  useEffect(() => {
    selectedPhoneRef.current = selectedPhoneNumber;
  }, [selectedPhoneNumber]);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  }, []);

  // Clear unread count for a phone number
  const clearUnread = useCallback((phoneNumber: string) => {
    const normalized = phoneNumber.replace(/^\+/, '');
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[normalized];
      return next;
    });
  }, []);

  // Dismiss the latest notification
  const dismissNotification = useCallback(() => {
    setLatestNotification(null);
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  // Connect to global SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    let reconnectAttempts = 0;

    const connect = () => {
      eventSource = new EventSource('/api/messages/stream/global');

      eventSource.onopen = () => {
        reconnectAttempts = 0; // Reset on successful connection
        console.log('[global-notifications] SSE connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data: NotificationEvent = JSON.parse(event.data);
          const normalizedPhone = data.phoneNumber.replace(/^\+/, '');

          // ALWAYS expose the event so the parent component can update its messages state secretly
          setIncomingMessageEvent(data);

          // Only notify for incoming messages (from contact, not from user)
          if (data.message.sender !== 'contact') return;

          // If this contact is currently selected, don't show notification toast
          const currentSelected = selectedPhoneRef.current?.replace(/^\+/, '') || '';
          if (normalizedPhone === currentSelected) return;

          // Increment unread count
          setUnreadCounts(prev => ({
            ...prev,
            [normalizedPhone]: (prev[normalizedPhone] || 0) + 1,
          }));

          // Play notification sound
          playNotificationSound();

          // Show in-app toast
          setLatestNotification(data);

          // Auto-dismiss toast after 5 seconds
          if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
          }
          dismissTimerRef.current = setTimeout(() => {
            setLatestNotification(null);
          }, 5000);

          // Show browser notification if tab is not focused
          if (document.hidden && notificationPermission === 'granted') {
            const contactName = data.contactName || normalizedPhone;
            const preview = data.message.content.length > 50
              ? data.message.content.substring(0, 47) + '...'
              : data.message.content;

            new Notification(`💬 ${contactName}`, {
              body: preview,
              icon: '/favicon.ico',
              tag: `whatzapp-${normalizedPhone}`,
              silent: true, // We play our own sound
            });
          }
        } catch (err) {
          console.error('[global-notifications] Parse error:', err);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Exponential backoff: 1s, 2s, 4s, 8s, max 15s
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000);
        reconnectAttempts++;
        console.warn(`[global-notifications] SSE error, reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    // Request notification permission on first interaction
    const handleFirstInteraction = () => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(p => setNotificationPermission(p));
      }
      document.removeEventListener('click', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);

    return () => {
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      document.removeEventListener('click', handleFirstInteraction);
    };
  }, [notificationPermission]);

  return {
    unreadCounts,
    clearUnread,
    notificationPermission,
    requestPermission,
    latestNotification,
    dismissNotification,
    incomingMessageEvent,
  };
}
