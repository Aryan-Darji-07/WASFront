import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, Upload, X, Users, Zap, Search, RefreshCw, Check, ChevronDown, User, FileText, Image, Video, Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../components/Notification';
import { countries } from 'country-data';

// ─── Build unique country dial codes with a representative name ──────────────
const dialCodeMap = new Map();
countries.all.forEach(country => {
  if (country.countryCallingCodes && Array.isArray(country.countryCallingCodes)) {
    country.countryCallingCodes.forEach(code => {
      // Remove leading '+' if present, keep as string
      const cleanCode = code.replace(/^\+/, '');
      if (!dialCodeMap.has(cleanCode)) {
        dialCodeMap.set(cleanCode, country.name);
      }
    });
  }
});
const COUNTRY_OPTIONS = Array.from(dialCodeMap.entries())
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ─── Arrays of dial codes by length (for formatting) ─────────────────────────
const ALL_DIAL_CODES = Array.from(dialCodeMap.keys());
const CC2 = ALL_DIAL_CODES.filter(code => code.length === 2);
const CC3 = ALL_DIAL_CODES.filter(code => code.length === 3);

// ─── Phone formatter (uses the dynamic CC2/CC3) ──────────────────────────────
function formatPhone(raw) {
  if (!raw) return '';
  const d = String(raw).replace(/\D/g, '');
  if (!d) return String(raw);
  const s3 = d.slice(0, 3), s2 = d.slice(0, 2);
  if (CC3.includes(s3) && d.length > 5) return `+${s3} ${d.slice(3)}`;
  if (CC2.includes(s2) && d.length > 4) return `+${s2} ${d.slice(2)}`;
  return `+${d}`;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toLocalDatetime(utcString, timezone) {
  if (!utcString) return '';
  try {
    const s = String(utcString).trim();
    const iso = (s.includes('Z') || s.includes('+')) ? s : s.replace(' ', 'T') + 'Z';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone || 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
    return formatter.format(date).replace(' ', 'T');
  } catch { return ''; }
}

// ─── Item icon (group or individual) ─────────────────────────────────────────
function ItemIcon({ type = 'individual', size = 36 }) {
  const isGroup = type === 'group';
  const iconSize = Math.round(size * 0.5);
  return (
    <div
      className={`rounded-full flex-shrink-0 flex items-center justify-center ${
        isGroup ? 'bg-violet-100 text-violet-600' : 'bg-teal-100 text-teal-600'
      }`}
      style={{ width: size, height: size }}
    >
      {isGroup
        ? <Users style={{ width: iconSize, height: iconSize }} />
        : <User  style={{ width: iconSize, height: iconSize }} />
      }
    </div>
  );
}

// ─── Multi-select dropdown ────────────────────────────────────────────────────
function MultiSelectDropdown({
  items, selected, onToggle,
  placeholder = 'Search...',
  loading = false,
  onSync, syncing = false, syncLabel = 'Sync',
  emptyText = 'No items found.',
  itemType = 'individual',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const filtered = items.filter(item =>
    !query ||
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    (item.sublabel && item.sublabel.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        className={`input cursor-pointer flex items-center gap-2 flex-wrap min-h-[42px] py-1.5 ${open ? 'border-whatsapp-teal ring-2 ring-whatsapp-teal/20' : ''}`}
        style={{ userSelect: 'none' }}
      >
        {selected.size === 0 ? (
          <span className="text-gray-400 text-sm py-0.5">{loading ? 'Loading…' : placeholder}</span>
        ) : (
          <span className="text-sm text-gray-700">{selected.size} selected</span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 p-2 border-b border-gray-100">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-sm outline-none w-full text-gray-700 placeholder-gray-400"
                onClick={e => e.stopPropagation()}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')}>
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {onSync && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onSync(); }}
                disabled={syncing || loading}
                className="flex items-center gap-1.5 text-xs font-medium text-whatsapp-teal border border-whatsapp-teal/30 bg-whatsapp-teal/5 hover:bg-whatsapp-teal/10 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : syncLabel}
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-whatsapp-teal rounded-full animate-spin" />
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">{emptyText}</div>
            ) : (
              filtered.map(item => {
                const isSelected = selected.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onToggle(item.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-whatsapp-teal/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <ItemIcon type={itemType} size={36} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                      {item.sublabel && (
                        <p className="text-xs text-gray-400 truncate">{item.sublabel}</p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'bg-whatsapp-teal border-whatsapp-teal' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selected.size > 0 && (
            <div className="border-t border-gray-100 px-3 py-2 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">{selected.size} selected</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); [...selected].forEach(id => onToggle(id)); }}
                className="text-xs text-red-500 hover:text-red-600 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Custom Country Select (single-select dropdown) ─────────────────────────
function CountrySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const filtered = COUNTRY_OPTIONS.filter(
    ({ code, name }) =>
      !query ||
      name.toLowerCase().includes(query.toLowerCase()) ||
      code.includes(query)
  );

  const selectedCountry = COUNTRY_OPTIONS.find(c => c.code === value);

  return (
    <div ref={ref} className="relative w-full sm:w-auto sm:min-w-[130px]">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`input flex items-center justify-between w-full ${
          open ? 'border-whatsapp-teal ring-2 ring-whatsapp-teal/20' : ''
        }`}
      >
        <span className="truncate">
          {selectedCountry ? `+${selectedCountry.code}` : 'Code'}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown panel - now wider for laptop screens */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[200px]  max-w-sm">
          {/* Search */}
          <div className="flex items-center gap-2 p-2 border-b border-gray-100">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search country..."
                className="bg-transparent text-sm outline-none w-full text-gray-700 placeholder-gray-400"
                onClick={e => e.stopPropagation()}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')}>
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                No countries found
              </div>
            ) : (
              filtered.map(({ code, name }) => {
                const isSelected = code === value;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      onChange(code);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-whatsapp-teal/5'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex-1 text-sm text-gray-800">
                      {name} <span className="text-gray-400">(+{code})</span>
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-whatsapp-teal flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Existing media display (for edit mode) ───────────────────────────────────
function ExistingMediaBadge({ mediaPath, mediaType, mediaFilename, onClearMedia, newFile }) {
  if (!mediaPath && !newFile) return null;

  const iconMap = {
    image:    <Image className="w-4 h-4 text-emerald-500" />,
    video:    <Video className="w-4 h-4 text-purple-500" />,
    document: <FileText className="w-4 h-4 text-orange-500" />,
  };

  if (newFile) {
    return (
      <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
        <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs text-center">
          {newFile.name.split('.').pop().toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{newFile.name}</p>
          <p className="text-xs text-gray-400">{(newFile.size / 1024 / 1024).toFixed(2)} MB · New file</p>
        </div>
        <button type="button" onClick={onClearMedia} className="text-gray-400 hover:text-red-500">
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 border border-blue-100 rounded-lg bg-blue-50">
      <div className="w-10 h-10 bg-white rounded flex items-center justify-center">
        {iconMap[mediaType] || <FileText className="w-4 h-4 text-gray-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-blue-800">{mediaFilename || mediaPath}</p>
        <p className="text-xs text-blue-500 capitalize">{mediaType || 'media'} · Existing attachment</p>
      </div>
      <button
        type="button"
        onClick={onClearMedia}
        className="text-blue-400 hover:text-red-500 transition-colors"
        title="Remove this media"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

const TIMEZONES = [
  'Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo','Asia/Shanghai',
  'Europe/London','Europe/Paris','Europe/Berlin',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Sao_Paulo',
  'Africa/Cairo','Australia/Sydney','Pacific/Auckland','UTC',
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ScheduleMessagePage() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [form, setForm] = useState({
    type: 'individual',
    message_body: '',
    scheduled_at: '',
    user_timezone: user?.timezone || 'Asia/Kolkata',
  });

  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [selectedGroups,   setSelectedGroups]   = useState(new Set());

  // New file to upload
  const [mediaFile,    setMediaFile]    = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  // Existing media from the DB (edit mode)
  const [existingMedia, setExistingMedia] = useState(null);
  const [keepExisting, setKeepExisting]   = useState(true);

  // Manual number entry with country code
  const [selectedCountry, setSelectedCountry] = useState('91'); // default India
  const [localNumber, setLocalNumber] = useState('');
  const [manualError, setManualError] = useState('');

  // Contacts list
  const [contacts,        setContacts]        = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsSyncing, setContactsSyncing] = useState(false);

  // Groups list
  const [groups,        setGroups]        = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsSyncing, setGroupsSyncing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [editLoaded, setEditLoaded] = useState(false);

  // ── Load contacts (always, for both create and edit modes) ──────────────────
  useEffect(() => {
    if (form.type !== 'individual') return;
    setContactsLoading(true);
    api.get('/whatsapp/contacts')
      .then(res => setContacts(res.data.contacts || []))
      .catch(() => {})
      .finally(() => setContactsLoading(false));
  }, [form.type]);

  // ── Load groups (always, for both create and edit modes) ───────────────────
  useEffect(() => {
    if (form.type !== 'group') return;
    setGroupsLoading(true);
    api.get('/whatsapp/groups/with-pics')
      .then(res => setGroups(res.data.groups || []))
      .catch(() => api.get('/whatsapp/groups').then(r => setGroups(r.data.groups || [])))
      .finally(() => setGroupsLoading(false));
  }, [form.type]);

  // ── Load edit message data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!editId) return;
    api.get('/messages', { params: { limit: 100 } }).then(res => {
      const msg = res.data.messages.find(m => String(m.id) === editId);
      if (!msg) return;

      setForm({
        type:           msg.type,
        message_body:   msg.message_body || '',
        scheduled_at:   toLocalDatetime(msg.scheduled_at, msg.user_timezone),
        user_timezone:  msg.user_timezone,
      });

      if (msg.recipient) {
        if (msg.type === 'individual') setSelectedContacts(new Set([msg.recipient]));
        if (msg.type === 'group')      setSelectedGroups(new Set([msg.recipient]));
      }

      if (msg.media_path) {
        setExistingMedia({ path: msg.media_path, type: msg.media_type, filename: msg.media_filename });
        setKeepExisting(true);
      }

      setEditLoaded(true);
    }).catch(() => {});
  }, [editId]);

  // ── Sync contacts ──────────────────────────────────────────────────────────
  async function syncContacts() {
    setContactsSyncing(true);
    try {
      const res = await api.get('/whatsapp/contacts?sync=true');
      setContacts(res.data.contacts || []);
      notify(`Synced ${res.data.contacts?.length || 0} contacts`, 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Sync failed', 'error');
    } finally {
      setContactsSyncing(false);
    }
  }

  // ── Sync groups ────────────────────────────────────────────────────────────
  async function syncGroups() {
    setGroupsSyncing(true);
    try {
      const res = await api.post('/whatsapp/groups/sync');
      const res2 = await api.get('/whatsapp/groups/with-pics').catch(() => res);
      setGroups(res2.data.groups || res.data.groups || []);
      notify(`Synced ${res.data.groups?.length || 0} groups`, 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Sync failed', 'error');
    } finally {
      setGroupsSyncing(false);
    }
  }

  // ── Manual number handlers ─────────────────────────────────────────────────
  function addManualNumber() {
    const localDigits = localNumber.replace(/\D/g, '');
    if (!localDigits) {
      setManualError('Please enter a number');
      return;
    }
    const fullNumber = selectedCountry + localDigits; // e.g. "91" + "9876543210"
    const totalDigits = fullNumber.length;
    if (totalDigits < 8 || totalDigits > 15) {
      setManualError('Total digits (country code + local number) must be 8–15');
      return;
    }
    if (selectedContacts.has(fullNumber)) {
      setManualError('Number already added');
      return;
    }
    setSelectedContacts(prev => new Set(prev).add(fullNumber));
    setLocalNumber('');
    setManualError('');
  }

  function handleManualKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addManualNumber();
    }
  }

  // ── Media handlers ─────────────────────────────────────────────────────────
  function handleMediaChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { notify('File size exceeds 16MB limit', 'error'); return; }
    setMediaFile(file);
    setMediaPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    setKeepExisting(false);
  }

  function removeMedia() {
    setMediaFile(null);
    setMediaPreview(null);
    setKeepExisting(false);
  }

  // ── Recipients ─────────────────────────────────────────────────────────────
  function getRecipients() {
    if (form.type === 'individual') return [...selectedContacts];
    if (form.type === 'group')      return [...selectedGroups];
    return [];
  }

  // ── Build FormData ─────────────────────────────────────────────────────────
  function buildFormData(recipient, includeScheduledAt = true) {
    const fd = new FormData();
    fd.append('type', form.type);
    fd.append('user_timezone', form.user_timezone);
    if (includeScheduledAt) fd.append('scheduled_at', form.scheduled_at);
    if (form.type !== 'status' && recipient) fd.append('recipient', recipient);
    if (form.message_body) fd.append('message_body', form.message_body);
    if (mediaFile) fd.append('media', mediaFile);
    return fd;
  }

  // ── Submit (schedule or update) ────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.message_body && !mediaFile && !(editId && keepExisting && existingMedia)) {
      notify('Please enter a message or attach media', 'error');
      return;
    }

    const recipients = getRecipients();
    if (form.type !== 'status' && recipients.length === 0) {
      notify(`Please select at least one ${form.type === 'group' ? 'group' : 'contact'}`, 'error');
      return;
    }

    setLoading(true);
    try {
      if (editId) {
        const recipient = recipients[0];
        await api.put(`/messages/${editId}`, {
          recipient,
          message_body:   form.message_body,
          scheduled_at:   form.scheduled_at,
          user_timezone:  form.user_timezone,
        });
        notify('Message updated successfully', 'success');
        navigate('/');
      } else {
        const targets = form.type === 'status' ? [null] : recipients;
        await Promise.all(targets.map(r => api.post('/messages', buildFormData(r))));
        notify(
          targets.length > 1
            ? `Scheduled ${targets.length} messages successfully`
            : 'Message scheduled successfully',
          'success'
        );
        navigate('/');
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to schedule message', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Send Now ───────────────────────────────────────────────────────────────
  async function handleSendNow() {
    if (!form.message_body && !mediaFile) {
      notify('Please enter a message or attach media', 'error');
      return;
    }
    const recipients = getRecipients();
    if (form.type !== 'status' && recipients.length === 0) {
      notify(`Please select at least one ${form.type === 'group' ? 'group' : 'contact'}`, 'error');
      return;
    }
    setLoading(true);
    try {
      const targets = form.type === 'status' ? [null] : recipients;
      await Promise.all(targets.map(r => api.post('/messages/send-now', buildFormData(r, false))));
      notify(targets.length > 1 ? `Sent ${targets.length} messages successfully` : 'Message sent successfully', 'success');
      navigate('/');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Dropdown items ─────────────────────────────────────────────────────────
  const contactItems = contacts.map(c => ({
    id:       c.phone,
    label:    c.name || c.phone,
    sublabel: formatPhone(c.phone),
  }));

  const groupItems = groups.map(g => ({
    id:       g.group_jid,
    label:    g.name,
    sublabel: `${g.participants_count} member${g.participants_count !== 1 ? 's' : ''}`,
  }));

  function toggleContact(id) {
    setSelectedContacts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleGroup(id) {
    setSelectedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // Combine selected contacts (both from DB and manual) for display in pills
  const allSelectedContacts = [...selectedContacts].map(id => {
    const found = contactItems.find(item => item.id === id);
    if (found) return found;
    // manual number
    return { id, label: formatPhone(id) };
  });

  const minDatetime = (() => {
    const d = new Date(Date.now() + 60000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  })();

  const showMediaSection = !editId || editLoaded;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {editId ? 'Edit Scheduled Message' : 'Schedule a Message'}
      </h1>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Message Type ── */}
          <div>
            <label className="label">Message Type</label>
            <div className="grid grid-cols-3 gap-3">
              {['individual', 'group', 'status'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    if (editId) return;
                    setForm(p => ({ ...p, type: t }));
                    setSelectedContacts(new Set());
                    setSelectedGroups(new Set());
                  }}
                  disabled={!!editId}
                  className={`py-2.5 rounded-lg border-2 text-sm font-medium capitalize transition-colors ${
                    form.type === t
                      ? 'border-whatsapp-teal bg-whatsapp-teal/5 text-whatsapp-teal'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── Individual: contacts dropdown + manual entry ── */}
          {form.type === 'individual' && (
            <div>
              <label className="label flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Select Contacts
                {selectedContacts.size > 0 && (
                  <span className="ml-1 text-xs bg-whatsapp-teal text-white px-1.5 py-0.5 rounded-full font-normal">
                    {selectedContacts.size}
                  </span>
                )}
              </label>

              {/* Selected pills (above dropdown) */}
              {allSelectedContacts.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {allSelectedContacts.map(item => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 bg-whatsapp-teal/10 text-whatsapp-teal text-xs font-medium px-2 py-1 rounded-full"
                    >
                      <ItemIcon type="individual" size={18} />
                      <span className="max-w-[120px] truncate">{item.label}</span>
                      <button
                        type="button"
                        onClick={() => toggleContact(item.id)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <MultiSelectDropdown
                items={contactItems}
                selected={selectedContacts}
                onToggle={toggleContact}
                placeholder={contactsLoading ? 'Loading contacts...' : 'Search contacts…'}
                loading={contactsLoading}
                onSync={syncContacts}
                syncing={contactsSyncing}
                syncLabel="Sync Contacts"
                itemType="individual"
                emptyText={
                  contacts.length === 0
                    ? 'No contacts cached. Click "Sync Contacts" to fetch from WhatsApp.'
                    : 'No contacts match your search.'
                }
              />

              {/* Manual number input with custom country select */}
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <CountrySelect value={selectedCountry} onChange={setSelectedCountry} />

                <input
                  type="tel"
                  value={localNumber}
                  onChange={e => {
                    setLocalNumber(e.target.value);
                    setManualError('');
                  }}
                  onKeyDown={handleManualKeyDown}
                  placeholder="Local number (e.g. 9876543210)"
                  className="input w-full sm:flex-1"
                />

                <button
                  type="button"
                  onClick={addManualNumber}
                  className="btn-secondary whitespace-nowrap w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </button>
              </div>
              {manualError && <p className="text-xs text-red-500 mt-1">{manualError}</p>}
              <p className="text-xs text-gray-400 mt-1.5">
                Select country and enter local number. Full number (country code + local) must be 8–15 digits.
              </p>
              {editId && (
                <p className="text-xs text-amber-600 mt-1.5">
                  ⚠ In edit mode only one recipient can be selected.
                </p>
              )}
            </div>
          )}

          {/* ── Group: groups dropdown ── */}
          {form.type === 'group' && (
            <div>
              <label className="label flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Select Groups
                {selectedGroups.size > 0 && (
                  <span className="ml-1 text-xs bg-whatsapp-teal text-white px-1.5 py-0.5 rounded-full font-normal">
                    {selectedGroups.size}
                  </span>
                )}
              </label>
              <MultiSelectDropdown
                items={groupItems}
                selected={selectedGroups}
                onToggle={toggleGroup}
                placeholder={groupsLoading ? 'Loading groups...' : 'Search groups…'}
                loading={groupsLoading}
                onSync={syncGroups}
                syncing={groupsSyncing}
                syncLabel="Sync Groups"
                itemType="group"
                emptyText={
                  groups.length === 0
                    ? 'No groups cached. Click "Sync Groups" to fetch from WhatsApp.'
                    : 'No groups match your search.'
                }
              />
              {editId && (
                <p className="text-xs text-amber-600 mt-1.5">
                  ⚠ In edit mode only one group can be selected.
                </p>
              )}
              {!editId && (
                <p className="text-xs text-gray-400 mt-1.5">
                  You can select multiple groups - a separate message will be scheduled for each.
                </p>
              )}
            </div>
          )}

          {/* ── Message Body ── */}
          <div>
            <label className="label">
              Message {form.type === 'status' ? '(Status Text)' : ''}
              {(mediaFile || (keepExisting && existingMedia)) ? ' (optional with media)' : ''}
            </label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder={form.type === 'status' ? 'Your status text...' : 'Your message...'}
              value={form.message_body}
              onChange={e => setForm(p => ({ ...p, message_body: e.target.value }))}
              maxLength={4096}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{form.message_body.length}/4096</p>
          </div>

          {/* ── Media ── */}
          {showMediaSection && (
            <div>
              <label className="label">
                {editId ? 'Attachment' : 'Attach Media'}
                {!editId && <span className="ml-1 font-normal text-gray-400">(image, video, document - max 16MB)</span>}
              </label>

              {mediaFile ? (
                <ExistingMediaBadge
                  newFile={mediaFile}
                  onClearMedia={removeMedia}
                />
              ) : keepExisting && existingMedia ? (
                <ExistingMediaBadge
                  mediaPath={existingMedia.path}
                  mediaType={existingMedia.type}
                  mediaFilename={existingMedia.filename}
                  onClearMedia={() => { setKeepExisting(false); setMediaFile(null); }}
                />
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-whatsapp-teal hover:bg-whatsapp-teal/5 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">
                    {editId && existingMedia && !keepExisting
                      ? 'Upload a replacement file (optional)'
                      : 'Click to upload or drag & drop'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,.pdf,.doc,.docx,.zip"
                    onChange={handleMediaChange}
                  />
                </label>
              )}
            </div>
          )}

          {/* ── Schedule Time & Timezone ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Scheduled Date & Time</label>
              <input
                type="datetime-local"
                className="input"
                value={form.scheduled_at}
                min={!editId ? minDatetime : undefined}
                onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                required={!editId}
              />
            </div>
            <div>
              <label className="label">Timezone</label>
              <select
                className="input"
                value={form.user_timezone}
                onChange={e => setForm(p => ({ ...p, user_timezone: e.target.value }))}
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/')} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            {!editId && (
              <button
                type="button"
                onClick={handleSendNow}
                disabled={loading}
                className="btn-secondary flex-1 justify-center border-amber-400 text-amber-600 hover:bg-amber-50"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Send Now
                    {getRecipients().length > 1 && (
                      <span className="ml-1 text-xs opacity-70">({getRecipients().length})</span>
                    )}
                  </>
                )}
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {editId ? 'Update' : 'Schedule'}
                  {!editId && getRecipients().length > 1 && (
                    <span className="ml-1 text-xs opacity-80">({getRecipients().length})</span>
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}