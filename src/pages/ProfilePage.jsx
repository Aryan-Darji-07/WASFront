import React, { useState } from 'react';
import { User, Globe, Key, Save, Phone } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../components/Notification';
import { useConfirm } from '../components/ConfirmModal';

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Dubai',
  'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Seoul',
  'Asia/Jakarta', 'Asia/Colombo', 'Asia/Kathmandu', 'Asia/Tashkent',
  'Asia/Almaty', 'Asia/Beirut', 'Asia/Riyadh', 'Asia/Tehran',
  'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'America/Toronto', 'America/Mexico_City',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
  'Pacific/Honolulu', 'UTC',
];

export default function ProfilePage() {
  const { user, updateUserState } = useAuth();
  const { notify } = useNotification();
  const confirm = useConfirm();

  // ── Timezone ──────────────────────────────────────────────────────────────
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [tzLoading, setTzLoading] = useState(false);

  // ── Mobile ────────────────────────────────────────────────────────────────
  const [mobile, setMobile]       = useState(user?.mobile || '');
  const [mobileLoading, setMobileLoading] = useState(false);

  // ── Password ──────────────────────────────────────────────────────────────
  const [pwForm, setPwForm]   = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  async function saveTimezone(e) {
    e.preventDefault();
    setTzLoading(true);
    try {
      await api.put('/users/me/timezone', { timezone });
      updateUserState({ timezone });
      notify('Timezone updated', 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update timezone', 'error');
    } finally {
      setTzLoading(false);
    }
  }

  async function saveMobile(e) {
    e.preventDefault();
    setMobileLoading(true);
    try {
      await api.put(`/users/${user.id}`, { mobile });
      updateUserState({ mobile });
      notify('Mobile number updated', 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update mobile', 'error');
    } finally {
      setMobileLoading(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      notify('New passwords do not match', 'error');
      return;
    }
    if (pwForm.new_password.length < 6) {
      notify('Password must be at least 6 characters', 'error');
      return;
    }

    const ok = await confirm({
      title:        'Change Password?',
      message:      'You will remain logged in after the password change.',
      confirmLabel: 'Yes, Change Password',
      cancelLabel:  'Cancel',
      variant:      'warning',
    });
    if (!ok) return;

    setPwLoading(true);
    try {
      await api.put(`/users/${user.id}/password`, {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      notify('Password changed successfully', 'success');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>

      {/* Info card */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-whatsapp-teal flex items-center justify-center text-white font-bold text-2xl">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{user?.username}</h2>
            <p className="text-gray-500">{user?.email}</p>
            {user?.mobile && (
              <p className="text-gray-400 text-sm flex items-center gap-1 mt-0.5">
                <Phone className="w-3.5 h-3.5" />{user.mobile}
              </p>
            )}
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
              user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Number */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="w-5 h-5 text-whatsapp-teal" />
          <h2 className="font-semibold text-gray-900">Mobile Number</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Your contact number for account-related notifications.
        </p>
        <form onSubmit={saveMobile} className="flex gap-3">
          <input
            type="tel"
            className="input flex-1"
            placeholder="e.g. +91 9876543210"
            value={mobile}
            onChange={e => setMobile(e.target.value)}
          />
          <button type="submit" disabled={mobileLoading} className="btn-primary">
            {mobileLoading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Save className="w-4 h-4" /> Save</>
            }
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          Current: <strong>{user?.mobile || '-'}</strong>
        </p>
      </div>

      {/* Timezone */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-whatsapp-teal" />
          <h2 className="font-semibold text-gray-900">Timezone Preference</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Your scheduled message times will use this timezone by default.
        </p>
        <form onSubmit={saveTimezone} className="flex gap-3">
          <select
            className="input flex-1"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <button type="submit" disabled={tzLoading} className="btn-primary">
            {tzLoading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Save className="w-4 h-4" /> Save</>
            }
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          Current: <strong>{user?.timezone}</strong>
        </p>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-whatsapp-teal" />
          <h2 className="font-semibold text-gray-900">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              type="password"
              className="input"
              value={pwForm.current_password}
              onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              type="password"
              className="input"
              value={pwForm.new_password}
              minLength={6}
              onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type="password"
              className="input"
              value={pwForm.confirm}
              onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
              required
            />
          </div>
          <button type="submit" disabled={pwLoading} className="btn-primary">
            {pwLoading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Key className="w-4 h-4" /> Change Password</>
            }
          </button>
        </form>
      </div>
    </div>
  );
}