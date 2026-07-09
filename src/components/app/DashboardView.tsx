'use client';

// src/components/app/DashboardView.tsx
// Premium SaaS Dashboard — insight-driven, interactive, with funnel, timeline, sparklines
// STRICT WORKSPACE ISOLATION: all data scoped to active workspace contacts

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Users2, MessageSquare, Send, Unlock, UserPlus, ClipboardList, Mail,
  Building2, Globe, Briefcase, ShoppingBag, Zap, ArrowUpRight, ArrowDownRight,
  Plus, Download, ChevronRight, Megaphone, LayoutTemplate, Phone,
  TrendingUp, Eye, MousePointerClick, CheckCheck, Sparkles, Activity,
} from 'lucide-react';

// ─── Helpers ───
function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  return String(phone).replace(/^\+/, '');
}

function formatPhoneDisplay(phone: string): string {
  if (!phone) return 'Unknown';
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.length === 0) return 'Unknown';
  if (cleaned.length > 10) {
    const cc = cleaned.startsWith('+') ? cleaned.slice(0, 3) : '+' + cleaned.slice(0, 2);
    const rest = cleaned.startsWith('+') ? cleaned.slice(3) : cleaned.slice(2);
    return `${cc} ${rest.slice(0, 5)} ${rest.slice(5)}`.trim();
  }
  return cleaned;
}

function formatTimeAgo(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const s = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString();
}

// ─── Sparkline (tiny inline chart) ───
function Sparkline({ data, color = '#25D366' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const w = 80, h = 28, px = 2;
  const points = data.map((v, i) => {
    const x = px + (i / (data.length - 1)) * (w - 2 * px);
    const y = h - px - ((v / max) * (h - 2 * px));
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `${px},${h - px} ${points} ${w - px},${h - px}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-7">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Animated Number ───
function AnimNum({ target, duration = 800 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const step = Math.max(1, Math.ceil(target / (duration / 16)));
    let cur = 0;
    const t = setInterval(() => {
      cur += step;
      if (cur >= target) { setVal(target); clearInterval(t); }
      else setVal(cur);
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);
  return <>{val}</>;
}

// ─── Funnel Step ───
function FunnelStep({ label, value, percent, color, width, delay, icon }: {
  label: string; value: number; percent: string; color: string; width: number; delay: number; icon: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ delay, duration: 0.6, ease: 'easeOut' }}
      style={{ originX: 0 }}
      className="group"
    >
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-[12px] font-bold text-gray-600 uppercase tracking-wider w-20">{label}</span>
        <div className="flex-1 relative">
          <div className="h-10 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${width}%` }}
              transition={{ delay: delay + 0.2, duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-lg flex items-center justify-between px-3 relative overflow-hidden"
              style={{ background: `linear-gradient(90deg, ${color}15, ${color}40)` }}
            >
              <span className="text-[13px] font-bold relative z-10" style={{ color }}>{value.toLocaleString()}</span>
              <span className="text-[11px] font-bold relative z-10 opacity-70" style={{ color }}>{percent}</span>
            </motion.div>
          </div>
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ background: `${color}12` }}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Timeline Item ───
function TimelineItem({ icon, text, time, isLast, delay }: {
  icon: React.ReactNode; text: string; time: string; isLast: boolean; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex gap-3"
    >
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-xl bg-[#25D366]/[0.08] flex items-center justify-center text-[#25D366] shrink-0">
          {icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-[#25D366]/20 to-transparent min-h-[24px]" />}
      </div>
      <div className={`flex-1 ${isLast ? '' : 'pb-5'}`}>
        <p className="text-[14px] font-medium text-gray-700 leading-snug">{text}</p>
        <p className="text-[12px] text-gray-400 mt-0.5 font-medium">{time}</p>
      </div>
    </motion.div>
  );
}

// ─── Custom Chart Tooltip ───
const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-gray-100 px-4 py-3">
        <p className="text-[12px] font-bold text-gray-900 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-[12px] text-gray-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}: <span className="font-bold text-gray-900">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Chart Data ───
const CHART_DATA_7D = [
  { day: 'Mon', sent: 35, delivered: 32 },
  { day: 'Tue', sent: 52, delivered: 48 },
  { day: 'Wed', sent: 48, delivered: 45 },
  { day: 'Thu', sent: 65, delivered: 60 },
  { day: 'Fri', sent: 72, delivered: 68 },
  { day: 'Sat', sent: 58, delivered: 55 },
  { day: 'Sun', sent: 80, delivered: 76 },
];

const CHART_DATA_30D = [
  { day: 'W1', sent: 180, delivered: 165 },
  { day: 'W2', sent: 220, delivered: 205 },
  { day: 'W3', sent: 195, delivered: 182 },
  { day: 'W4', sent: 310, delivered: 290 },
];

// ════════════ MAIN ════════════
export default function DashboardView() {
  const { activeWorkspace, activeContacts, setActiveScreen } = useWorkspace();
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [chatStats, setChatStats] = useState({ totalChats: 0, sentToday: 0, openConversations: 0 });
  const [isLive, setIsLive] = useState(true);
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d');
  const [mounted, setMounted] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const contactMap = useCallback(() => {
    const map = new Map<string, string>();
    activeContacts.forEach(c => map.set(normalizePhone(c.phoneNumber), c.name));
    return map;
  }, [activeContacts]);

  const fetchRecentChats = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const res = await fetch('/api/sfmc/messages');
      const data = await res.json();
      if (!data.messages) return;

      const cMap = contactMap();
      const workspacePhones = new Set(activeContacts.map(c => normalizePhone(c.phoneNumber)));
      
      const convMap = new Map<string, any>();
      data.messages.forEach((msg: any) => {
        const phone = normalizePhone(msg.contactKey || msg.phone);
        if (!phone) return;
        
        if (!convMap.has(phone)) {
          convMap.set(phone, {
            phoneNumber: phone,
            lastMessage: msg.body,
            lastMessageTimestamp: msg.timestamp,
            unreadCount: msg.status === 'delivered' ? 1 : 0
          });
        } else {
          // If this is a newer message, update the lastMessage
          const existing = convMap.get(phone);
          if (new Date(msg.timestamp) > new Date(existing.lastMessageTimestamp)) {
             existing.lastMessage = msg.body;
             existing.lastMessageTimestamp = msg.timestamp;
          }
        }
      });

      const conversations = Array.from(convMap.values());

      const filtered = conversations
        .filter((conv: any) => workspacePhones.has(normalizePhone(conv.phoneNumber)))
        .sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime())
        .slice(0, 5)
        .map((conv: any) => {
          const phone = normalizePhone(conv.phoneNumber);
          return {
            name: cMap.get(phone) || formatPhoneDisplay(conv.phoneNumber),
            message: conv.lastMessage || 'No recent messages',
            time: formatTimeAgo(conv.lastMessageTimestamp),
            unread: conv.unreadCount || 0,
          };
        });

      setRecentChats(filtered);

      const allWsConvs = conversations.filter((conv: any) =>
        workspacePhones.has(normalizePhone(conv.phoneNumber))
      );
      setChatStats({
        totalChats: allWsConvs.length,
        sentToday: allWsConvs.filter((c: any) => {
          if (!c.lastMessageTimestamp) return false;
          return new Date(c.lastMessageTimestamp).toDateString() === new Date().toDateString();
        }).length,
        openConversations: allWsConvs.filter((c: any) => (c.unreadCount || 0) > 0).length,
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, [activeWorkspace?.id, activeContacts, contactMap]);

  useEffect(() => {
    fetchRecentChats();
    if (isLive) pollingRef.current = setInterval(fetchRecentChats, 8000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchRecentChats, isLive]);

  useEffect(() => {
    setRecentChats([]);
    fetchRecentChats();
  }, [activeWorkspace?.id]);

  if (!activeWorkspace) return null;

  const totalContacts = activeContacts.length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const chartData = chartRange === '7d' ? CHART_DATA_7D : CHART_DATA_30D;

  // Insight cards
  const insightCards = [
    { label: 'Total Contacts', value: totalContacts, trend: '+12%', up: true, icon: <Users2 size={20} />, sparkData: [3, 5, 4, 7, 6, 8, 9] },
    { label: 'Total Chats', value: chatStats.totalChats, trend: '+8%', up: true, icon: <MessageSquare size={20} />, sparkData: [2, 4, 3, 5, 7, 6, 8] },
    { label: 'Sent Today', value: chatStats.sentToday, trend: '+5%', up: true, icon: <Send size={20} />, sparkData: [1, 2, 1, 3, 2, 4, 3] },
    { label: 'Open Chats', value: chatStats.openConversations, trend: '-2%', up: false, icon: <Unlock size={20} />, sparkData: [5, 4, 6, 3, 4, 2, 3] },
  ];

  // Funnel data
  const funnelSteps = [
    { label: 'Sent', value: 4200, percent: '100%', color: '#25D366', width: 100, icon: <Send size={14} className="text-[#25D366]" /> },
    { label: 'Delivered', value: 3780, percent: '90%', color: '#3DDC84', width: 90, icon: <CheckCheck size={14} className="text-[#3DDC84]" /> },
    { label: 'Read', value: 2520, percent: '60%', color: '#7AE8A5', width: 60, icon: <Eye size={14} className="text-[#7AE8A5]" /> },
    { label: 'Replied', value: 840, percent: '20%', color: '#128C7E', width: 20, icon: <MousePointerClick size={14} className="text-[#128C7E]" /> },
  ];

  // Activities
  const activities = [
    { icon: <UserPlus size={16} />, text: `New contact added to ${activeWorkspace.name}`, time: '2 min ago' },
    { icon: <ClipboardList size={16} />, text: 'Template message sent to 12 contacts', time: '15 min ago' },
    { icon: <Mail size={16} />, text: 'Incoming message from a contact', time: '1 hour ago' },
    { icon: <Megaphone size={16} />, text: 'Broadcast campaign completed', time: '3 hours ago' },
    { icon: <Sparkles size={16} />, text: `${activeWorkspace.name} workspace created`, time: 'Today' },
  ];

  const stagger = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>

      {/* ════════ HERO HEADER ════════ */}
      <div className="relative overflow-hidden">
        {/* Gradient strip */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#25D366]/[0.04] via-white to-[#128C7E]/[0.03]" />
        <div className="absolute top-0 right-0 w-[600px] h-[250px] bg-gradient-to-bl from-[#25D366]/[0.06] to-transparent rounded-bl-[100px]" />

        <div className="relative px-8 pt-8 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-extrabold text-gray-900 tracking-tight"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                {greeting} 👋
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-sm text-gray-500 mt-1.5"
              >
                Here&apos;s what&apos;s happening with <span className="font-semibold text-gray-700">{activeWorkspace.name}</span> today
              </motion.p>

              {/* Dynamic insight chip */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-3 flex items-center gap-2 flex-wrap"
              >
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366]/[0.08] text-[13px] font-semibold text-[#25D366] border border-[#25D366]/10">
                  <TrendingUp size={14} /> Engagement up +12% today 🚀
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[12px] font-semibold text-gray-600 border border-gray-200 shadow-sm">
                  <Activity size={13} className="text-[#25D366]" /> {chatStats.totalChats} active conversations
                </span>
              </motion.div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsLive(!isLive)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                  isLive ? 'bg-[#25D366]/[0.06] border-[#25D366]/20 text-[#25D366]' : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#25D366] animate-pulse' : 'bg-gray-400'}`} />
                {isLive ? 'Live' : 'Paused'}
              </button>
              <button
                onClick={() => {
                  // Build CSV from dashboard data
                  const rows = [
                    ['Metric', 'Value'],
                    ['Total Contacts', String(totalContacts)],
                    ['Total Chats', String(chatStats.totalChats)],
                    ['Sent Today', String(chatStats.sentToday)],
                    ['Open Conversations', String(chatStats.openConversations)],
                    [''],
                    ['Recent Chats'],
                    ['Name', 'Last Message', 'Time', 'Unread'],
                    ...recentChats.map((c: any) => [c.name, `"${(c.message || '').replace(/"/g, '""')}"`, c.time, String(c.unread || 0)]),
                  ];
                  const csv = rows.map(r => Array.isArray(r) ? r.join(',') : r).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${activeWorkspace.name.replace(/\s+/g, '_')}_dashboard_${new Date().toISOString().slice(0,10)}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
              >
                <Download size={15} /> Export
              </button>
              <button
                onClick={() => setActiveScreen('broadcasts')}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#25D366] to-[#128C7E] shadow-sm shadow-green-600/15 hover:shadow-lg hover:shadow-green-600/20 transition-all flex items-center gap-2"
              >
                <Plus size={15} /> New Campaign
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8">

        {/* ════════ INSIGHT CARDS ════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {insightCards.map((card, i) => (
            <motion.div
              key={i}
              {...stagger}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="bg-white/70 backdrop-blur-md rounded-2xl p-5 border border-gray-200/60 shadow-sm hover:shadow-md hover:border-[#25D366]/15 transition-all duration-300 cursor-default group"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">{card.label}</span>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#25D366]/10 to-[#128C7E]/10 flex items-center justify-center text-[#25D366] group-hover:scale-110 transition-transform">
                  {card.icon}
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    <AnimNum target={card.value} />
                  </p>
                  <div className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full mt-1.5 ${
                    card.up ? 'text-[#25D366] bg-[#25D366]/[0.08]' : 'text-red-500 bg-red-50'
                  }`}>
                    {card.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {card.trend}
                  </div>
                </div>
                <Sparkline data={card.sparkData} color={card.up ? '#25D366' : '#ef4444'} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* ════════ FUNNEL + CHART ROW ════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-6">

          {/* Conversion Funnel — 2 cols */}
          <motion.div
            {...stagger}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Conversion Funnel</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">WhatsApp message journey</p>
              </div>
              <div className="text-[12px] font-bold text-[#25D366] bg-[#25D366]/[0.06] px-2.5 py-1 rounded-lg">
                20% conversion
              </div>
            </div>
            <div className="space-y-3">
              {funnelSteps.map((step, i) => (
                <FunnelStep key={step.label} {...step} delay={0.5 + i * 0.15} />
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-lg h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '20%' }}
                  transition={{ delay: 1.2, duration: 0.8 }}
                  className="h-full rounded-lg bg-gradient-to-r from-[#25D366] to-[#128C7E]"
                />
              </div>
              <span className="text-[12px] font-bold text-gray-500">20% reply rate</span>
            </div>
          </motion.div>

          {/* Message Analytics Chart — 3 cols */}
          <motion.div
            {...stagger}
            transition={{ delay: 0.5 }}
            className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Message Analytics</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Sent vs delivered over time</p>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {(['7d', '30d'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
                      chartRange === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {r === '7d' ? '7 Days' : '30 Days'}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-4 h-[260px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#25D366" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#25D366" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="delGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#93c5fd" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="sent" name="Sent" stroke="#25D366" strokeWidth={2.5} fill="url(#sentGrad)" dot={{ r: 3.5, fill: '#25D366', stroke: 'white', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#93c5fd" strokeWidth={2} strokeDasharray="5 4" fill="url(#delGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="px-6 pb-4 flex items-center gap-5">
              <span className="flex items-center gap-1.5 text-[12px] text-gray-500 font-medium">
                <span className="w-3 h-0.5 rounded bg-[#25D366]" /> Sent
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-gray-500 font-medium">
                <span className="w-3 h-0.5 rounded bg-blue-300 opacity-70" style={{ borderTop: '2px dashed #93c5fd', height: 0 }} /> Delivered
              </span>
            </div>
          </motion.div>
        </div>

        {/* ════════ RECENT CHATS + TIMELINE ROW ════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-6">

          {/* Recent Chats — 3 cols */}
          <motion.div
            {...stagger}
            transition={{ delay: 0.6 }}
            className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-bold text-gray-900">Recent Chats</h3>
                {isLive && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#25D366] bg-[#25D366]/[0.06] px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" /> LIVE
                  </span>
                )}
              </div>
              <button onClick={() => setActiveScreen('chats')} className="text-[12px] font-semibold text-[#25D366] hover:text-[#128C7E] transition-colors flex items-center gap-0.5">
                View All <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {recentChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#25D366]/[0.06] flex items-center justify-center mb-4">
                    <MessageSquare size={24} className="text-[#25D366]" />
                  </div>
                  <p className="text-sm font-bold text-gray-700 mb-1">No activity yet</p>
                  <p className="text-[12px] text-gray-400 max-w-[220px] mb-4">
                    Start your first campaign to see conversations here
                  </p>
                  <button
                    onClick={() => setActiveScreen('broadcasts')}
                    className="text-[13px] font-bold text-[#25D366] flex items-center gap-1 hover:underline"
                  >
                    <Megaphone size={14} /> Launch campaign
                  </button>
                </div>
              ) : (
                recentChats.map((chat, i) => {
                  const initials = chat.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 + i * 0.06 }}
                      onClick={() => setActiveScreen('chats')}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#25D366]/[0.02] transition-all cursor-pointer group"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                          {initials}
                        </div>
                        {/* Live green dot */}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#25D366] border-2 border-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] font-semibold text-gray-900 truncate">{chat.name}</span>
                          <span className="text-[11px] text-gray-400 ml-2 shrink-0">{chat.time}</span>
                        </div>
                        <p className="text-[13px] text-gray-500 truncate mt-0.5">{chat.message}</p>
                      </div>
                      {chat.unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#25D366] text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                          {chat.unread}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* Activity Timeline — 2 cols */}
          <motion.div
            {...stagger}
            transition={{ delay: 0.65 }}
            className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-bold text-gray-900">Activity Timeline</h3>
              <button className="text-[12px] font-semibold text-[#25D366] hover:text-[#128C7E] transition-colors">
                View All
              </button>
            </div>
            <div className="flex-1">
              {activities.map((item, i) => (
                <TimelineItem
                  key={i}
                  icon={item.icon}
                  text={item.text}
                  time={item.time}
                  isLast={i === activities.length - 1}
                  delay={0.7 + i * 0.1}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* ════════ QUICK ACTION BAR ════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="mt-6 mb-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-4"
        >
          <div className="flex items-center gap-4 overflow-x-auto">
            <p className="text-[13px] font-bold text-gray-700 shrink-0 pr-2 border-r border-gray-200">Quick Actions</p>
            {[
              { label: 'Send Broadcast', icon: <Megaphone size={16} />, screen: 'broadcasts' as const },
              { label: 'Add Contact', icon: <UserPlus size={16} />, screen: 'contacts' as const },
              { label: 'Create Template', icon: <LayoutTemplate size={16} />, screen: 'templates' as const },
              { label: 'Fast Reply', icon: <Zap size={16} />, screen: 'fast-reply' as const },
            ].map((action, i) => (
              <button
                key={i}
                onClick={() => setActiveScreen(action.screen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:border-[#25D366]/30 hover:bg-[#25D366]/[0.04] hover:text-[#25D366] transition-all shrink-0"
              >
                {action.icon} {action.label}
              </button>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
