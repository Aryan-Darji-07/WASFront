import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, RefreshCw, Shield, User, Edit, Phone, X, Save } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../components/Notification';
import { useConfirm } from '../components/ConfirmModal';

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'UTC',
];

// ─── Create User Modal ────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }) {
  const { notify }  = useNotification();
  const confirm     = useConfirm();
  const [form, setForm] = useState({
    username: '', email: '', password: '', role: 'user',
    timezone: 'Asia/Kolkata', full_name: '', mobile: '',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const ok = await confirm({
      title:        `Create user "${form.username}"?`,
      message:      `A new ${form.role} account will be created for ${form.email}.`,
      confirmLabel: 'Create User',
      cancelLabel:  'Review Again',
      variant:      'info',
    });
    if (!ok) return;

    setLoading(true);
    try {
      await api.post('/users', form);
      notify('User created successfully', 'success');
      onCreated();
      onClose();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Create New User</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Username *</label>
              <input className="input" value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.full_name} placeholder="Optional"
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input type="tel" className="input" value={form.mobile} placeholder="e.g. +91 9876543210"
              onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} />
          </div>
          <div>
            <label className="label">Password *</label>
            <input type="password" className="input" value={form.password} minLength={6}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Timezone</label>
              <select className="input" value={form.timezone}
                onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Create User'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────
function EditUserModal({ user: u, onClose, onSaved }) {
  const { notify } = useNotification();
  const confirm    = useConfirm();
  const [form, setForm] = useState({
    username:  u.username  || '',
    full_name: u.full_name || '',
    email:     u.email     || '',
    mobile:    u.mobile    || '',
    role:      u.role      || 'user',
    timezone:  u.timezone  || 'Asia/Kolkata',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const ok = await confirm({
      title:        `Save changes for "${u.username}"?`,
      message:      'The user\'s profile will be updated immediately.',
      confirmLabel: 'Save Changes',
      cancelLabel:  'Keep Editing',
      variant:      'warning',
    });
    if (!ok) return;

    setLoading(true);
    try {
      await api.put(`/users/${u.id}`, form);
      notify('User updated successfully', 'success');
      onSaved();
      onClose();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update user', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Edit User</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Username</label>
              <input className="input" value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input type="tel" className="input" value={form.mobile} placeholder="e.g. +91 9876543210"
              onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Timezone</label>
              <select className="input" value={form.timezone}
                onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Save className="w-4 h-4" />Save Changes</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { notify }            = useNotification();
  const confirm               = useConfirm();
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser]     = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users);
    } catch {
      notify('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function deleteUser(id, username) {
    const ok = await confirm({
      title:        `Delete "${username}"?`,
      message:      'This will permanently delete the user and all their scheduled messages. This cannot be undone.',
      confirmLabel: 'Delete User',
      cancelLabel:  'Keep User',
      variant:      'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/users/${id}`);
      notify('User deleted', 'success');
      fetchUsers();
    } catch (err) {
      notify(err.response?.data?.message || 'Delete failed', 'error');
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="btn-secondary" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-whatsapp-teal border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 pb-3 pr-4">User</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-3 pr-4">Mobile</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-3 pr-4">Role</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-3 pr-4">Timezone</th>
                <th className="text-left text-xs font-semibold text-gray-500 pb-3 pr-4">Created</th>
                <th className="text-right text-xs font-semibold text-gray-500 pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  {/* User column */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-whatsapp-teal/20 flex items-center justify-center text-whatsapp-teal font-bold text-sm flex-shrink-0">
                        {(u.full_name || u.username)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                          {u.full_name || u.username}
                          {u.id === currentUser?.id && (
                            <span className="ml-1.5 text-xs text-gray-400 font-normal">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Mobile column */}
                  <td className="py-3 pr-4">
                    {u.mobile ? (
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {u.mobile}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </td>

                  {/* Role column */}
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {u.role}
                    </span>
                  </td>

                  {/* Timezone */}
                  <td className="py-3 pr-4 text-sm text-gray-600">{u.timezone}</td>

                  {/* Created */}
                  <td className="py-3 pr-4 text-sm text-gray-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditUser(u)}
                        className="btn-secondary btn-sm"
                        title="Edit user"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => deleteUser(u.id, u.username)}
                          className="btn-danger btn-sm"
                          title="Delete user"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={fetchUsers} />
      )}
      {editUser && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={fetchUsers} />
      )}
    </div>
  );
}