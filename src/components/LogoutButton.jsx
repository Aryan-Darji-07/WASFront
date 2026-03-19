import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from './ConfirmModal';

export default function LogoutButton({ className = '' }) {
  const { logout } = useAuth();
  const confirm    = useConfirm();

  async function handleLogout() {
    const ok = await confirm({
      title:        'Log out?',
      message:      'You will be redirected to the login page. Any unsaved changes will be lost.',
      confirmLabel: 'Log Out',
      cancelLabel:  'Stay',
      variant:      'logout',
    });
    if (ok) logout();
  }

  return (
    <button
      onClick={handleLogout}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors ${className}`}
    >
      <LogOut className="w-4 h-4" />
      Log Out
    </button>
  );
}