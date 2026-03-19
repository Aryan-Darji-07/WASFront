import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarPlus,
  Smartphone,
  Users,
  User,
  Menu,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsApp } from '../contexts/WhatsAppContext';
import LogoutButton from './LogoutButton';

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/schedule',  icon: CalendarPlus,    label: 'Schedule Message' },
  { to: '/whatsapp',  icon: Smartphone,      label: 'WhatsApp' },
  { to: '/users',     icon: Users,           label: 'Users', adminOnly: true },
  { to: '/profile',   icon: User,            label: 'Profile' },
];

const STATUS_COLORS = {
  connected:    'bg-green-400',
  qr_ready:     'bg-yellow-400 animate-pulse',
  initializing: 'bg-blue-400 animate-pulse',
  disconnected: 'bg-red-400',
};

const STATUS_LABELS = {
  connected:    'Connected',
  qr_ready:     'Scan QR',
  initializing: 'Connecting...',
  disconnected: 'Disconnected',
};

export default function Layout({ children }) {
  const { user } = useAuth();
  const { waStatus } = useWhatsApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = navItems.filter(item => !item.adminOnly || user?.role === 'admin');

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-whatsapp-dark text-white w-64">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-whatsapp-teal/30">
        <MessageSquare className="w-8 h-8 text-whatsapp-green" />
        <div>
          <h1 className="font-bold text-lg leading-tight">WA Scheduler</h1>
          <p className="text-xs text-gray-400">Personal Automation</p>
        </div>
      </div>

      {/* WA Status */}
      <div className="px-4 py-3 mx-4 mt-4 rounded-lg bg-black/20 flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[waStatus] || 'bg-gray-400'}`} />
        <span className="text-sm">{STATUS_LABELS[waStatus] || waStatus}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-whatsapp-teal text-white'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-4 border-t border-whatsapp-teal/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-whatsapp-teal flex items-center justify-center font-bold text-sm flex-shrink-0">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>

        {/* LogoutButton handles the confirm modal internally */}
        <LogoutButton />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-whatsapp-dark text-white">
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-semibold">WA Scheduler</span>
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[waStatus]}`} />
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}