import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, CheckCircle, XCircle, CalendarPlus, Trash2, Edit,
  RefreshCw, Check, CheckCheck, EyeOff, Users, User,
  ChevronLeft, ChevronRight, Image, FileText, Video, Send,
  AlertCircle, MessageSquare, Search, X, Filter, Calendar,
  CalendarRange, ChevronDown,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsApp } from '../contexts/WhatsAppContext';
import { useNotification } from '../components/Notification';
import { useConfirm } from '../components/ConfirmModal';
import { countries } from 'country-data';

// ─── Dial codes ───────────────────────────────────────────────────────────────
const dialCodeMap = new Map();
countries.all.forEach(country => {
  if (country.countryCallingCodes && Array.isArray(country.countryCallingCodes)) {
    country.countryCallingCodes.forEach(code => {
      const cleanCode = code.replace(/^\+/, '');
      if (!dialCodeMap.has(cleanCode)) dialCodeMap.set(cleanCode, country.name);
    });
  }
});
const ALL_DIAL_CODES = Array.from(dialCodeMap.keys());
const CC2 = ALL_DIAL_CODES.filter(c => c.length === 2);
const CC3 = ALL_DIAL_CODES.filter(c => c.length === 3);

function formatPhone(raw) {
  if (!raw) return '';
  const d = String(raw).replace(/\D/g, '');
  if (!d) return String(raw);
  const s3 = d.slice(0, 3), s2 = d.slice(0, 2);
  if (CC3.includes(s3) && d.length > 5) return `+${s3} ${d.slice(3)}`;
  if (CC2.includes(s2) && d.length > 4) return `+${s2} ${d.slice(2)}`;
  return `+${d}`;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = ['pending', 'sent', 'failed'];
const TAB_LABELS = { pending: 'Upcoming', sent: 'Sent', failed: 'Failed' };
const TAB_ICONS = {
  pending: <Clock className="w-4 h-4" />,
  sent:    <CheckCheck className="w-4 h-4" />,
  failed:  <XCircle className="w-4 h-4" />,
};

// ─── Type filter options ──────────────────────────────────────────────────────
const TYPE_FILTERS = [
  { value: '',           label: 'All',        icon: <Filter className="w-3 h-3" /> },
  { value: 'individual', label: 'Individual', icon: <User className="w-3 h-3" /> },
  { value: 'group',      label: 'Groups',     icon: <Users className="w-3 h-3" /> },
  { value: 'status',     label: 'Status',     icon: <MessageSquare className="w-3 h-3" /> },
];

// ─── Date range presets ───────────────────────────────────────────────────────
function getPresetRange(preset, userTimezone) {
  const tz = userTimezone || 'UTC';
  const now = new Date();

  function toLocalIso(d) {
    // returns 'YYYY-MM-DDTHH:mm' in user's timezone for datetime-local input
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(d);
      const get = t => parts.find(p => p.type === t)?.value || '00';
      return `${get('year')}-${get('month')}-${get('day')}T${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`;
    } catch {
      return '';
    }
  }

  function startOfDay(d) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
  function endOfDay(d)   { const r = new Date(d); r.setHours(23,59,0,0); return r; }

  if (preset === 'today') {
    return { from: toLocalIso(startOfDay(now)), to: toLocalIso(endOfDay(now)) };
  }
  if (preset === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { from: toLocalIso(startOfDay(y)), to: toLocalIso(endOfDay(y)) };
  }
  if (preset === 'week') {
    const s = new Date(now); s.setDate(s.getDate() - 6);
    return { from: toLocalIso(startOfDay(s)), to: toLocalIso(endOfDay(now)) };
  }
  if (preset === 'month') {
    const s = new Date(now); s.setDate(s.getDate() - 29);
    return { from: toLocalIso(startOfDay(s)), to: toLocalIso(endOfDay(now)) };
  }
  if (preset === 'this_month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toLocalIso(startOfDay(s)), to: toLocalIso(endOfDay(now)) };
  }
  if (preset === 'three_months') {
    const s = new Date(now);
    s.setMonth(s.getMonth() - 3);
    return { from: toLocalIso(startOfDay(s)), to: toLocalIso(endOfDay(now)) };
  }
  return { from: '', to: '' };
}

// ─── Shared modal animation ───────────────────────────────────────────────────
const MODAL_STYLE = `
  @keyframes modal-fade-in {
    from { opacity:0; transform:scale(0.96) translateY(6px); }
    to   { opacity:1; transform:scale(1)    translateY(0);   }
  }
  .modal-animate { animation: modal-fade-in 0.16s cubic-bezier(0.22,1,0.36,1) both; }
`;

// ─── Date filter panel ────────────────────────────────────────────────────────
const PRESETS = [
  { key: 'today',        label: 'Today' },
  { key: 'yesterday',    label: 'Yesterday' },
  { key: 'week',         label: 'Last 7 days' },
  { key: 'month',        label: 'Last 30 days' },
  { key: 'this_month',   label: 'This month' },
  { key: 'three_months', label: 'Last 3 months' },
];

// ─── Date range modal ─────────────────────────────────────────────────────────
function DateModal({ dateRange, onApply, onClear, onClose, userTimezone }) {
  const [from, setFrom]     = useState(dateRange.from || '');
  const [to, setTo]         = useState(dateRange.to   || '');
  const [preset, setPreset] = useState('');

  const fmt = (localStr) => {
    if (!localStr) return '';
    const [dp, tp] = localStr.split('T');
    if (!dp || !tp) return localStr;
    const [Y, M, D] = dp.split('-').map(Number);
    const [h, m]    = tp.split(':').map(Number);
    return new Date(Y, M - 1, D, h, m).toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  function handlePreset(key) {
    setPreset(key);
    const r = getPresetRange(key, userTimezone);
    setFrom(r.from); setTo(r.to);
  }

  function handleApply() { onApply({ from, to }); onClose(); }
  function handleClear()  { setFrom(''); setTo(''); setPreset(''); onClear(); onClose(); }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden modal-animate">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <CalendarRange className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Date Range</p>
              <p className="text-[11px] text-gray-400">Filter by scheduled time</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: '65vh' }}>
          {/* Quick presets */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Select</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  className={`px-2 py-2 rounded-xl text-xs font-semibold border transition-all text-center leading-tight ${
                    preset === p.key
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">or custom</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Custom inputs */}
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-indigo-400" /> From
              </label>
              <input
                type="datetime-local"
                value={from}
                onChange={e => { setFrom(e.target.value); setPreset(''); }}
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-indigo-400" /> To
              </label>
              <input
                type="datetime-local"
                value={to}
                onChange={e => { setTo(e.target.value); setPreset(''); }}
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-gray-50 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Preview */}
          {(from || to) && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2.5">
              <p className="text-[11px] font-semibold text-indigo-600">
                {from ? fmt(from) : '—'}&nbsp;&nbsp;→&nbsp;&nbsp;{to ? fmt(to) : '—'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60">
          <button onClick={handleClear} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
            Clear
          </button>
          <button
            onClick={handleApply}
            disabled={!from && !to}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
      <style>{MODAL_STYLE}</style>
    </div>
  );
}

// ─── Type filter modal ────────────────────────────────────────────────────────
function FilterModal({ typeFilter, typeCounts, onSelect, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const tc = typeCounts || { individual: 0, group: 0, status: 0 };
  const total = tc.individual + tc.group + tc.status;

  const OPTIONS = [
    { value: '',           label: 'All',        sub: 'Show all message types',    icon: <Filter className="w-5 h-5" />,        iconBg: 'bg-gray-100',   iconClr: 'text-gray-500',   count: total },
    { value: 'individual', label: 'Individual', sub: 'Direct personal messages',  icon: <User className="w-5 h-5" />,          iconBg: 'bg-teal-100',   iconClr: 'text-teal-600',   count: tc.individual },
    { value: 'group',      label: 'Groups',     sub: 'Group chat messages',       icon: <Users className="w-5 h-5" />,         iconBg: 'bg-violet-100', iconClr: 'text-violet-600', count: tc.group },
    { value: 'status',     label: 'Status',     sub: 'WhatsApp status posts',     icon: <MessageSquare className="w-5 h-5" />, iconBg: 'bg-orange-100', iconClr: 'text-orange-600', count: tc.status },
  ];

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden modal-animate">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-whatsapp-teal/10 flex items-center justify-center">
              <Filter className="w-4 h-4 text-whatsapp-teal" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Filter by Type</p>
              <p className="text-[11px] text-gray-400">Select a message type</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="p-3 space-y-1.5">
          {OPTIONS.map(({ value, label, sub, icon, iconBg, iconClr, count }) => {
            const active = typeFilter === value;
            return (
              <button
                key={value}
                onClick={() => { onSelect(value); onClose(); }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 transition-all text-left ${
                  active
                    ? 'border-whatsapp-teal bg-whatsapp-teal/5'
                    : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} ${iconClr}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold leading-tight ${active ? 'text-whatsapp-teal' : 'text-gray-800'}`}>{label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{sub}</p>
                </div>
                <span className={`flex-shrink-0 min-w-[28px] text-center text-xs font-extrabold px-2 py-1 rounded-full ${
                  active ? 'bg-whatsapp-teal text-white' : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60">
          <p className="text-[11px] text-gray-400 text-center">Tap a type to filter · Tap <strong>All</strong> to reset</p>
        </div>
      </div>
      <style>{MODAL_STYLE}</style>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDisplayDateTime(localStr) {
  if (!localStr) return '';
  const [dp, tp] = localStr.split('T');
  if (!dp || !tp) return localStr;
  const [Y, M, D] = dp.split('-').map(Number);
  const [h, m]    = tp.split(':').map(Number);
  return new Date(Y, M - 1, D, h, m).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function parseUtc(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.includes('Z') || s.includes('+')) return new Date(s);
  return new Date(s.replace(' ', 'T') + 'Z');
}

function formatDate(raw, timezone) {
  const d = parseUtc(raw);
  if (!d || isNaN(d.getTime())) return '-';
  try {
    return d.toLocaleString('en-IN', {
      timeZone: timezone || 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return String(raw); }
}

// convert a datetime-local string (user's tz) to UTC ISO string for API
function localToUtcIso(localStr, userTimezone) {
  if (!localStr) return '';
  try {
    // localStr is "YYYY-MM-DDTHH:mm" — treat it as being in userTimezone
    // We use Intl trick: create a Date by parsing as if it were UTC,
    // then compute the offset for the user's timezone at that moment.
    const [datePart, timePart] = localStr.split('T');
    const [Y, M, D] = datePart.split('-').map(Number);
    const [h, m]    = (timePart || '00:00').split(':').map(Number);

    // Build a Date object treating the input as UTC (we'll correct below)
    const naive = new Date(Date.UTC(Y, M - 1, D, h, m, 0));

    // Get the UTC offset for this timezone at this naive time (minutes, positive = east)
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone || 'UTC',
      timeZoneName: 'shortOffset',
    });
    const parts = fmt.formatToParts(naive);
    const tzStr = parts.find(p => p.type === 'timeZoneName')?.value || 'UTC+0';
    const match = tzStr.match(/UTC([+-]\d+(?::\d+)?)/);
    let offsetMinutes = 0;
    if (match) {
      const [hh, mm = '0'] = match[1].split(':');
      offsetMinutes = parseInt(hh) * 60 + (parseInt(hh) >= 0 ? parseInt(mm) : -parseInt(mm));
    }

    const utc = new Date(naive.getTime() - offsetMinutes * 60000);
    return utc.toISOString();
  } catch {
    return new Date(localStr).toISOString();
  }
}

// ─── ACK badge ────────────────────────────────────────────────────────────────
function AckBadge({ ack, type, readCount, totalRecipients }) {
  if (type === 'status') return null;
  if (ack >= 3) {
    if (type === 'group') return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
        <CheckCheck className="w-3 h-3" />
        {totalRecipients > 0 ? `${readCount}/${totalRecipients} read` : `${readCount} read`}
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
        <CheckCheck className="w-3 h-3" />Read
      </span>
    );
  }
  if (ack === 2) return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
      <CheckCheck className="w-3 h-3" />Delivered
    </span>
  );
  if (ack === 1) return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
      <Check className="w-3 h-3" />Sent
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
      <Clock className="w-3 h-3" />Sending…
    </span>
  );
}

// ─── Pills ────────────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const m = {
    pending: { label: 'Upcoming', cls: 'text-amber-700 bg-amber-50 border-amber-200',  icon: <Clock className="w-3 h-3" /> },
    sent:    { label: 'Sent',     cls: 'text-green-700 bg-green-50 border-green-200',   icon: <Send className="w-3 h-3" /> },
    failed:  { label: 'Failed',   cls: 'text-red-700 bg-red-50 border-red-200',         icon: <XCircle className="w-3 h-3" /> },
  }[status] || { label: status, cls: 'text-gray-600 bg-gray-100 border-gray-200', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
}

function TypePill({ type }) {
  const m = {
    individual: { label: 'Individual', cls: 'text-teal-700 bg-teal-50 border-teal-100',      icon: <User className="w-3 h-3" /> },
    group:      { label: 'Group',      cls: 'text-violet-700 bg-violet-50 border-violet-100', icon: <Users className="w-3 h-3" /> },
    status:     { label: 'Status',     cls: 'text-orange-700 bg-orange-50 border-orange-100', icon: <MessageSquare className="w-3 h-3" /> },
  }[type] || { label: type, cls: 'text-gray-600 bg-gray-50 border-gray-100', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
}

function MediaPill({ type }) {
  if (!type) return null;
  const m = {
    image:    { icon: <Image className="w-3 h-3" />,    cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    video:    { icon: <Video className="w-3 h-3" />,    cls: 'text-purple-700 bg-purple-50 border-purple-200' },
    document: { icon: <FileText className="w-3 h-3" />, cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  }[type];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${m.cls}`}>
      {m.icon}{type}
    </span>
  );
}

// ─── Group Read Bar ───────────────────────────────────────────────────────────
function GroupReadBar({ msg, readCount, onOpenModal }) {
  const total = msg.total_recipients || 0;
  const pct = total > 0 ? Math.round((readCount / total) * 100) : 0;
  return (
    <div className="bg-blue-50/60 rounded-xl px-3.5 py-2.5 border border-blue-100">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
          <CheckCheck className="w-3 h-3" />Read receipts
        </span>
        <button onClick={onOpenModal}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors">
          View Members →
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-blue-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className="text-xs font-bold text-blue-700 tabular-nums whitespace-nowrap">
          {readCount}/{total} ({pct}%)
        </span>
      </div>
    </div>
  );
}

// ─── Group Members Modal ──────────────────────────────────────────────────────
const MEMBERS_PER_PAGE = 20;
function GroupMembersModal({ msg, readCount, onClose }) {
  const [allMembers, setAllMembers] = useState(null);
  const [fetching, setFetching]     = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch]         = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const searchRef = useRef(null);
  const total = msg.total_recipients ?? 0;

  useEffect(() => {
    searchRef.current?.focus();
    async function load() {
      try {
        const jid = encodeURIComponent(msg.recipient);
        const res = await api.get(`/whatsapp/groups/${jid}/members`);
        setAllMembers(res.data.members || []);
      } catch (err) {
        setFetchError(err.response?.data?.message || 'Could not load members. Sync groups first.');
        setAllMembers([]);
      } finally { setFetching(false); }
    }
    load();
  }, [msg.recipient]);

  const sorted = (allMembers || []).slice()
    .sort((a, b) => {
      if (a.name && !b.name) return -1;
      if (!a.name && b.name) return 1;
      if (a.name && b.name) return a.name.localeCompare(b.name);
      return (a.phone || '').localeCompare(b.phone || '');
    })
    .map((m, i) => ({ ...m, read: i < readCount, formattedPhone: formatPhone(m.phone), initial: m.name ? m.name[0].toUpperCase() : '#' }));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? sorted.filter(m => (m.name || '').toLowerCase().includes(q) || (m.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')))
    : sorted;

  useEffect(() => { setMemberPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / MEMBERS_PER_PAGE));
  const safePage   = Math.min(memberPage, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * MEMBERS_PER_PAGE, safePage * MEMBERS_PER_PAGE);
  const pct = total > 0 ? Math.round((readCount / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Users style={{ width: 18, height: 18 }} className="text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">{msg.recipient_name || 'Group'} - Members</p>
              <p className="text-xs text-gray-400 leading-tight">
                {total} total · <span className="text-blue-600 font-semibold">{readCount} read</span> · {Math.max(0, total - readCount)} unread
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pt-3 pb-2 flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1.5 text-xs text-gray-500">
            <span>Read progress</span>
            <span className="font-semibold text-gray-700">{readCount}/{total} ({pct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>
        <div className="px-5 py-3 flex-shrink-0 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white placeholder-gray-400 transition-all" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {fetching ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading members…</p>
            </div>
          ) : fetchError ? (
            <div className="flex items-start gap-3 px-5 py-8 text-sm text-red-500">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{fetchError}</p>
                <p className="text-gray-400 text-xs mt-1">Go to Settings → Sync Groups to load participant data.</p>
              </div>
            </div>
          ) : pageItems.map((m, i) => (
            <div key={m.phone || i}
              className={`flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors ${m.read ? '' : 'opacity-80'}`}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${m.read ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <User style={{ width: 18, height: 18 }} className={m.read ? 'text-blue-600' : 'text-gray-400'} />
                </div>
                <div className="min-w-0">
                  {m.name
                    ? <><p className="text-sm font-semibold text-gray-800 truncate leading-snug">{m.name}</p>{m.phone && <p className="text-xs font-mono text-gray-400 leading-snug">{m.formattedPhone}</p>}</>
                    : <p className="text-sm font-mono font-semibold text-gray-700 leading-snug">{m.formattedPhone || m.phone}</p>
                  }
                </div>
              </div>
              <div className="flex-shrink-0 ml-4">
                {m.read
                  ? <span className="flex items-center gap-1 text-xs font-bold text-blue-600"><CheckCheck className="w-4 h-4" />Read</span>
                  : <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3.5 h-3.5" />Unread</span>
                }
              </div>
            </div>
          ))}
        </div>
        {!fetching && !fetchError && filtered.length > MEMBERS_PER_PAGE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
            <button onClick={() => setMemberPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="btn-secondary btn-sm disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" />Prev</button>
            <span className="text-xs font-bold text-gray-500">{safePage} / {totalPages}</span>
            <button onClick={() => setMemberPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="btn-secondary btn-sm disabled:opacity-40">Next<ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Message Card ─────────────────────────────────────────────────────────────
function MessageCard({ msg, timezone, liveAck, onRefresh, onOpenMembers }) {
  const { notify } = useNotification();
  const confirm    = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const isPending = msg.status === 'pending';
  const isFailed  = msg.status === 'failed';
  const isSent    = msg.status === 'sent';
  const isGroup   = msg.type === 'group';
  const rc = liveAck?.read_count ?? msg.read_count ?? 0;

  async function handleDelete() {
    const ok = await confirm({
      title:        'Delete this message?',
      message:      'This scheduled message will be permanently removed and cannot be recovered.',
      confirmLabel: 'Delete',
      variant:      'danger',
      details:      msg.recipient
        ? `To: ${msg.recipient_name || formatPhone(msg.recipient)}`
        : 'WhatsApp Status post',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/messages/${msg.id}`);
      notify('Message deleted', 'success');
      onRefresh();
    } catch (err) {
      notify(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const accents = { pending: 'border-l-amber-400', sent: 'border-l-green-500', failed: 'border-l-red-400' };

  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${accents[msg.status] || 'border-l-gray-300'} shadow-sm hover:shadow-md transition-all duration-200 p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={msg.status} />
          <TypePill type={msg.type} />
          {msg.media_type && <MediaPill type={msg.media_type} />}
          {isSent && <AckBadge ack={liveAck?.ack_status ?? msg.ack_status ?? 0} type={msg.type} readCount={rc} totalRecipients={msg.total_recipients ?? 0} />}
        </div>
        {isPending && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Link to={`/schedule?edit=${msg.id}`}
              className="flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200 transition-all px-2.5 py-1.5 rounded-lg">
              <Edit className="w-3.5 h-3.5" />Edit
            </Link>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 transition-all px-2.5 py-1.5 rounded-lg disabled:opacity-40">
              <Trash2 className="w-3.5 h-3.5" />{deleting ? '…' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {msg.recipient && (
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${isGroup ? 'bg-violet-100' : 'bg-teal-100'}`}>
            {isGroup
              ? <Users style={{ width: 18, height: 18 }} className="text-violet-600" />
              : <User  style={{ width: 18, height: 18 }} className="text-teal-600" />
            }
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">
              {isGroup ? 'Group' : 'To'}
            </p>
            <p className="text-sm font-bold text-gray-800 truncate leading-tight">
              {msg.recipient_name || (isGroup ? msg.recipient : formatPhone(msg.recipient))}
            </p>
            {!isGroup && msg.recipient_name && (
              <p className="text-xs font-mono text-gray-400 leading-tight">{formatPhone(msg.recipient)}</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-100">
        {msg.message_body
          ? <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap break-words leading-relaxed">{msg.message_body}</p>
          : <p className="text-sm text-gray-400 italic">Media only - no caption</p>
        }
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="text-gray-400">Scheduled:</span>
          <span className="font-semibold text-gray-600">{formatDate(msg.scheduled_at, timezone)}</span>
        </div>
        {msg.sent_at && (
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
            <span className="text-gray-400">Sent:</span>
            <span className="font-semibold text-gray-600">{formatDate(msg.sent_at, timezone)}</span>
          </div>
        )}
      </div>

      {isGroup && isSent && (msg.total_recipients ?? 0) > 0 && (
        <GroupReadBar msg={msg} readCount={rc} onOpenModal={() => onOpenMembers(msg, rc)} />
      )}

      {isFailed && msg.error_message && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-600 break-all leading-relaxed">{msg.error_message}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user }   = useAuth();
  const { socket } = useWhatsApp();
  const { notify } = useNotification();

  const [tab, setTab]             = useState('pending');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [data, setData]           = useState({ messages: [], pagination: {}, typeCounts: { individual: 0, group: 0, status: 0 } });
  const [loading, setLoading]     = useState(false);
  const [stats, setStats]         = useState({ pending: 0, sent: 0, failed: 0 });
  const [page, setPage]           = useState(1);
  const [liveAcks, setLiveAcks]   = useState({});
  const [membersModal, setMembersModal] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDateModal, setShowDateModal]     = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: tab, page, limit: 20 };
      if (typeFilter) params.type = typeFilter;
      // Convert user-local datetime strings → UTC ISO for the API
      if (dateRange.from) params.date_from = localToUtcIso(dateRange.from, user?.timezone);
      if (dateRange.to)   params.date_to   = localToUtcIso(dateRange.to,   user?.timezone);
      const res = await api.get('/messages', { params });
      setData(res.data);
      setLiveAcks({});
    } catch {
      notify('Failed to load messages', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, page, typeFilter, dateRange, user?.timezone]);

  const fetchStats = useCallback(async () => {
    try {
      const [p, s, f] = await Promise.all([
        api.get('/messages', { params: { status: 'pending', limit: 1 } }),
        api.get('/messages', { params: { status: 'sent',    limit: 1 } }),
        api.get('/messages', { params: { status: 'failed',  limit: 1 } }),
      ]);
      setStats({ pending: p.data.pagination.total, sent: s.data.pagination.total, failed: f.data.pagination.total });
    } catch {}
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { fetchStats(); },   [fetchStats]);

  function handleTabChange(t) {
    setTab(t);
    setPage(1);
    setTypeFilter('');
    setDateRange({ from: '', to: '' });
  }

  function handleTypeFilter(v) { setTypeFilter(v); setPage(1); }

  function handleDateApply(range) { setDateRange(range); setPage(1); }
  function handleDateClear()      { setDateRange({ from: '', to: '' }); setPage(1); }

  // live socket events
  useEffect(() => {
    if (!socket) return;

    function onAck({ messageId, ack, readCount }) {
      setLiveAcks(prev => ({
        ...prev,
        [messageId]: { ack_status: ack, ...(readCount !== undefined ? { read_count: readCount } : {}) },
      }));
      setMembersModal(prev => {
        if (!prev) return prev;
        const row = data.messages.find(m => m.id === messageId);
        if (row?.id === messageId) return { ...prev, readCount: readCount ?? prev.readCount };
        return prev;
      });
    }

    function onSent({ messageId }) {
      if (tab === 'pending') {
        setData(prev => {
          // find the message type before removing it so we can update typeCounts
          const removedMsg = prev.messages.find(m => m.id === messageId);
          const msgType = removedMsg?.type;
          return {
            ...prev,
            messages: prev.messages.filter(m => m.id !== messageId),
            pagination: { ...prev.pagination, total: Math.max(0, (prev.pagination.total || 1) - 1) },
            typeCounts: msgType ? {
              ...prev.typeCounts,
              [msgType]: Math.max(0, (prev.typeCounts?.[msgType] ?? 1) - 1),
            } : prev.typeCounts,
          };
        });
      }
      setStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), sent: prev.sent + 1 }));
    }

    function onFailed({ messageId }) {
      if (tab === 'pending') {
        setData(prev => {
          const removedMsg = prev.messages.find(m => m.id === messageId);
          const msgType = removedMsg?.type;
          return {
            ...prev,
            messages: prev.messages.filter(m => m.id !== messageId),
            pagination: { ...prev.pagination, total: Math.max(0, (prev.pagination.total || 1) - 1) },
            typeCounts: msgType ? {
              ...prev.typeCounts,
              [msgType]: Math.max(0, (prev.typeCounts?.[msgType] ?? 1) - 1),
            } : prev.typeCounts,
          };
        });
      }
      setStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1), failed: prev.failed + 1 }));
    }

    socket.on('wa:message_ack',    onAck);
    socket.on('wa:message_sent',   onSent);
    socket.on('wa:message_failed', onFailed);
    return () => {
      socket.off('wa:message_ack',    onAck);
      socket.off('wa:message_sent',   onSent);
      socket.off('wa:message_failed', onFailed);
    };
  }, [socket, tab, data.messages]);

  const statCards = [
    { t: 'pending', label: 'Upcoming', v: stats.pending, color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100',  bar: 'bg-amber-500',  icon: <Clock   className="w-5 h-5 text-amber-500"  /> },
    { t: 'sent',    label: 'Sent',     v: stats.sent,    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-100',  bar: 'bg-green-500',  icon: <Send    className="w-5 h-5 text-green-500"  /> },
    { t: 'failed',  label: 'Failed',   v: stats.failed,  color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-100',    bar: 'bg-red-500',    icon: <XCircle className="w-5 h-5 text-red-500"   /> },
  ];

  const tc = data.typeCounts || { individual: 0, group: 0, status: 0 };
  const hasDateFilter = !!dateRange.from || !!dateRange.to;

  return (
    <div className="max-w-4xl mx-auto">

      <div className="flex items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome back, {user?.username}</p>
        </div>
        <Link to="/schedule" className="btn-primary flex-shrink-0 text-sm px-3 py-2 sm:px-4 sm:py-2.5">
          <CalendarPlus className="w-4 h-4" /><span className="hidden sm:inline">Schedule Message</span><span className="sm:hidden">Schedule</span>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        {statCards.map(({ t, label, v, color, bg, border, bar, icon }) => (
          <div
            key={label}
            onClick={() => handleTabChange(t)}
            className={`relative overflow-hidden rounded-xl border ${border} ${bg} p-3 sm:p-4 flex flex-col gap-2 sm:gap-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-100`}
          >
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-white/80 flex items-center justify-center shadow-sm">{icon}</div>
              <span className={`text-xl sm:text-2xl font-extrabold ${color} tabular-nums`}>{v}</span>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${bar}`} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

        {/* Tab bar + filter icons + refresh */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-3 border-b border-gray-100 min-w-0">
          {/* Tab group */}
          <div className="flex gap-0.5 sm:gap-1 bg-gray-100 rounded-xl p-1 min-w-0 flex-1 overflow-x-auto scrollbar-hide">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                  tab === t ? 'bg-white shadow-sm text-whatsapp-teal' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/80'
                }`}
              >
                {TAB_ICONS[t]}
                {TAB_LABELS[t]}
                {t === 'pending' && stats.pending > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1 sm:px-1.5 py-0.5 rounded-full font-extrabold">{stats.pending}</span>
                )}
                {t === 'failed' && stats.failed > 0 && (
                  <span className="text-[10px] bg-red-100 text-red-600 px-1 sm:px-1.5 py-0.5 rounded-full font-extrabold">{stats.failed}</span>
                )}
              </button>
            ))}
          </div>

          {/* Filter icon button */}
          <button
            onClick={() => setShowFilterModal(true)}
            title="Filter by type"
            className={`flex-shrink-0 relative w-9 h-9 flex items-center justify-center rounded-xl border-2 transition-all ${
              typeFilter
                ? 'bg-whatsapp-teal border-whatsapp-teal text-white shadow-sm'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-100'
            }`}
          >
            <Filter className="w-4 h-4" />
            {typeFilter && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-whatsapp-teal border-2 border-white rounded-full" />
            )}
          </button>

          {/* Date icon button */}
          <button
            onClick={() => setShowDateModal(true)}
            title="Filter by date range"
            className={`flex-shrink-0 relative w-9 h-9 flex items-center justify-center rounded-xl border-2 transition-all ${
              hasDateFilter
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-100'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            {hasDateFilter && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full" />
            )}
          </button>

          {/* Refresh button */}
          <button
            onClick={() => { fetchMessages(); fetchStats(); }}
            disabled={loading}
            className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 sm:px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Active filter chips row — shown only when a filter is active */}
        {(typeFilter || hasDateFilter) && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/50 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Active:</span>
            {typeFilter && (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-whatsapp-teal/10 text-whatsapp-teal border border-whatsapp-teal/20 px-2.5 py-1 rounded-full flex-shrink-0">
                {TYPE_FILTERS.find(f => f.value === typeFilter)?.icon}
                {TYPE_FILTERS.find(f => f.value === typeFilter)?.label}
                <button onClick={() => handleTypeFilter('')} className="ml-0.5 hover:bg-whatsapp-teal/20 rounded-full p-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {hasDateFilter && (
              <span className="inline-flex items-center gap-1 text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full flex-shrink-0">
                <CalendarRange className="w-3 h-3" />
                {dateRange.from ? formatDisplayDateTime(dateRange.from) : '—'}
                <span className="text-indigo-400 font-normal">→</span>
                {dateRange.to ? formatDisplayDateTime(dateRange.to) : '—'}
                <button onClick={handleDateClear} className="ml-0.5 hover:bg-indigo-100 rounded-full p-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Tab info banners */}
        {tab === 'pending' && (
          <div className="mx-4 mt-4 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Messages send automatically at the scheduled time. Cards disappear in <strong>real time</strong> once sent.</span>
          </div>
        )}
        {tab === 'sent' && (
          <div className="mx-4 mt-4 flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
            <CheckCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Read receipts update in <strong>real time</strong>. For group messages, click <strong>View Members</strong> to see who has read.</span>
          </div>
        )}

        {/* Message list */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-whatsapp-teal border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading messages…</p>
            </div>
          ) : data.messages.length === 0 ? (
            <div className="text-center py-16">
              {hasDateFilter ? (
                <>
                  <CalendarRange className="w-14 h-14 mx-auto mb-4 text-gray-200" />
                  <p className="font-bold text-gray-500">No messages in this date range</p>
                  <button onClick={handleDateClear} className="text-xs text-indigo-500 hover:underline mt-2">Clear date filter</button>
                </>
              ) : typeFilter ? (
                <>
                  <Filter className="w-14 h-14 mx-auto mb-4 text-gray-200" />
                  <p className="font-bold text-gray-500">No {typeFilter} messages {TAB_LABELS[tab].toLowerCase()}</p>
                  <button onClick={() => handleTypeFilter('')} className="text-xs text-whatsapp-teal hover:underline mt-2">Clear filter</button>
                </>
              ) : (
                <>
                  {tab === 'failed'  && <><XCircle  className="w-14 h-14 mx-auto mb-4 text-gray-200" /><p className="font-bold text-gray-500">No failed messages</p></>}
                  {tab === 'pending' && <><Clock    className="w-14 h-14 mx-auto mb-4 text-gray-200" /><p className="font-bold text-gray-500">No upcoming messages</p><Link to="/schedule" className="inline-flex items-center gap-1 text-xs text-whatsapp-teal hover:underline mt-2"><CalendarPlus className="w-3.5 h-3.5" />Schedule one now</Link></>}
                  {tab === 'sent'    && <><CheckCheck className="w-14 h-14 mx-auto mb-4 text-gray-200" /><p className="font-bold text-gray-500">No sent messages yet</p></>}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {data.messages.map(msg => (
                  <MessageCard
                    key={msg.id}
                    msg={msg}
                    timezone={user?.timezone}
                    liveAck={liveAcks[msg.id] || null}
                    onRefresh={() => { fetchMessages(); fetchStats(); }}
                    onOpenMembers={(m, rc) => setMembersModal({ msg: m, readCount: rc })}
                  />
                ))}
              </div>

              {data.pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-gray-100">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm disabled:opacity-40">
                    <ChevronLeft className="w-3.5 h-3.5" />Prev
                  </button>
                  <span className="text-sm font-bold text-gray-500">
                    {page} / {data.pagination.pages}
                    <span className="text-xs font-normal text-gray-400 ml-1">({data.pagination.total} total)</span>
                  </span>
                  <button onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))} disabled={page === data.pagination.pages} className="btn-secondary btn-sm disabled:opacity-40">
                    Next<ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {membersModal && (
        <GroupMembersModal
          msg={membersModal.msg}
          readCount={liveAcks[membersModal.msg.id]?.read_count ?? membersModal.readCount}
          onClose={() => setMembersModal(null)}
        />
      )}

      {showFilterModal && (
        <FilterModal
          typeFilter={typeFilter}
          typeCounts={tc}
          onSelect={handleTypeFilter}
          onClose={() => setShowFilterModal(false)}
        />
      )}

      {showDateModal && (
        <DateModal
          dateRange={dateRange}
          onApply={handleDateApply}
          onClear={handleDateClear}
          onClose={() => setShowDateModal(false)}
          userTimezone={user?.timezone}
        />
      )}
    </div>
  );
}