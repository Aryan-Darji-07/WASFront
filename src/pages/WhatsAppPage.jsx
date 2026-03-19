import React, { useState } from 'react';
import { Smartphone, RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useWhatsApp } from '../contexts/WhatsAppContext';
import { useNotification } from '../components/Notification';

const STATUS_INFO = {
  connected: {
    label: 'Connected',
    description: 'WhatsApp is active and ready to send messages.',
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    icon: <Wifi className="w-6 h-6 text-green-500" />,
  },
  qr_ready: {
    label: 'Scan QR Code',
    description: 'Open WhatsApp on your phone → Linked Devices → Link a Device, then scan.',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
    icon: <Smartphone className="w-6 h-6 text-yellow-500" />,
  },
  initializing: {
    label: 'Connecting...',
    description: 'WhatsApp is starting up. Please wait.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    icon: <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />,
  },
  disconnected: {
    label: 'Disconnected',
    description: 'WhatsApp is not connected. Click "Connect" to start.',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    icon: <WifiOff className="w-6 h-6 text-red-500" />,
  },
};

export default function WhatsAppPage() {
  const { waStatus, qrCode } = useWhatsApp();
  const { notify } = useNotification();
  const [actionLoading, setActionLoading] = useState(false);

  const info = STATUS_INFO[waStatus] || STATUS_INFO.disconnected;

  async function handleConnect() {
    setActionLoading(true);
    try {
      await api.post('/whatsapp/connect');
      notify('WhatsApp initialization started', 'info');
    } catch (err) {
      notify(err.response?.data?.message || 'Connect failed', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect WhatsApp? Pending messages will not be sent until reconnected.')) return;
    setActionLoading(true);
    try {
      await api.post('/whatsapp/disconnect');
      notify('WhatsApp disconnected', 'warning');
    } catch (err) {
      notify(err.response?.data?.message || 'Disconnect failed', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Smartphone className="w-7 h-7 text-whatsapp-teal" />
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Connection</h1>
      </div>

      {/* Status Card */}
      <div className={`card border-2 ${info.bg} mb-6`}>
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">{info.icon}</div>
          <div>
            <h2 className={`font-bold text-lg ${info.color}`}>{info.label}</h2>
            <p className="text-sm text-gray-600">{info.description}</p>
          </div>
        </div>
      </div>

      {/* QR Code */}
      {waStatus === 'qr_ready' && qrCode && (
        <div className="card text-center mb-6">
          <h3 className="font-semibold text-gray-700 mb-4">Scan with WhatsApp</h3>
          <div className="inline-block p-4 border-2 border-gray-200 rounded-xl">
            <img
              src={qrCode}
              alt="WhatsApp QR Code"
              className="w-56 h-56 mx-auto"
            />
          </div>
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-left">
            <p className="text-sm font-medium text-yellow-800 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              How to scan:
            </p>
            <ol className="text-sm text-yellow-700 mt-1.5 space-y-1 list-decimal list-inside">
              <li>Open WhatsApp on your phone</li>
              <li>Tap Menu (⋮) → Linked Devices</li>
              <li>Tap "Link a Device"</li>
              <li>Point your phone's camera at the QR code above</li>
            </ol>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-4">Actions</h3>
        <div className="flex gap-3">
          {waStatus === 'disconnected' && (
            <button
              onClick={handleConnect}
              disabled={actionLoading}
              className="btn-primary flex-1 justify-center"
            >
              {actionLoading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  Connect WhatsApp
                </>
              )}
            </button>
          )}

          {waStatus === 'connected' && (
            <button
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="btn-danger flex-1 justify-center"
            >
              {actionLoading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  Disconnect
                </>
              )}
            </button>
          )}

          {(waStatus === 'initializing' || waStatus === 'qr_ready') && (
            <p className="text-sm text-gray-500 text-center w-full py-2">
              Waiting for device linking...
            </p>
          )}
        </div>
      </div>

      {/* Session Info */}
      <div className="card mt-4 bg-blue-50 border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">Session Persistence</h3>
        <p className="text-sm text-blue-700">
          Your WhatsApp session is stored in the database. After a server restart,
          the session is restored automatically - no QR scan needed unless WhatsApp expires it.
        </p>
      </div>
    </div>
  );
}
