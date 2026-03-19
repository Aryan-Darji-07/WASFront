import React, { useState, useEffect, useRef } from 'react';
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
    description: 'WhatsApp is starting up. Please wait — this can take up to 60 seconds on first run.',
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
  const [localQr, setLocalQr] = useState(null);
  const [localStatus, setLocalStatus] = useState(null);
  const pollRef = useRef(null);

  // Use local overrides while polling, fall back to socket-driven context values
  const displayStatus = localStatus || waStatus;
  const displayQr     = localQr     || qrCode;

  // Poll backend every 4s after clicking Connect until connected/failed
  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/whatsapp/status');
        const { status, qr } = res.data;
        setLocalStatus(status);
        setLocalQr(qr || null);
        if (status === 'connected' || status === 'disconnected') {
          stopPolling();
          if (status === 'connected') {
            setLocalStatus(null);
            setLocalQr(null);
          }
        }
      } catch {}
    }, 4000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Sync localStatus when context updates to connected
  useEffect(() => {
    if (waStatus === 'connected') {
      setLocalStatus(null);
      setLocalQr(null);
      stopPolling();
    }
    if (waStatus === 'qr_ready' && qrCode) {
      setLocalQr(qrCode);
      setLocalStatus('qr_ready');
    }
  }, [waStatus, qrCode]);

  useEffect(() => () => stopPolling(), []);

  async function handleConnect() {
    setActionLoading(true);
    setLocalStatus('initializing');
    try {
      await api.post('/whatsapp/connect');
      notify('WhatsApp initialization started — please wait up to 60 seconds', 'info');
      startPolling();
    } catch (err) {
      notify(err.response?.data?.message || 'Connect failed', 'error');
      setLocalStatus(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect WhatsApp? Pending messages will not be sent until reconnected.')) return;
    setActionLoading(true);
    stopPolling();
    try {
      await api.post('/whatsapp/disconnect');
      setLocalStatus('disconnected');
      setLocalQr(null);
      notify('WhatsApp disconnected', 'warning');
    } catch (err) {
      notify(err.response?.data?.message || 'Disconnect failed', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRefresh() {
    try {
      const res = await api.get('/whatsapp/status');
      setLocalStatus(res.data.status);
      setLocalQr(res.data.qr || null);
    } catch {}
  }

  const info = STATUS_INFO[displayStatus] || STATUS_INFO.disconnected;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Smartphone className="w-7 h-7 text-whatsapp-teal" />
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Connection</h1>
        <button
          onClick={handleRefresh}
          className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh status"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
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
      {displayStatus === 'qr_ready' && displayQr && (
        <div className="card text-center mb-6">
          <h3 className="font-semibold text-gray-700 mb-4">Scan with WhatsApp</h3>
          <div className="inline-block p-4 border-2 border-gray-200 rounded-xl">
            <img src={displayQr} alt="WhatsApp QR Code" className="w-56 h-56 mx-auto" />
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
          <p className="text-xs text-gray-400 mt-3">
            After scanning, it may take <strong>30–60 seconds</strong> to show as Connected on Render.
          </p>
        </div>
      )}

      {/* Initializing — show spinner with note */}
      {displayStatus === 'initializing' && (
        <div className="card text-center mb-6">
          <div className="w-10 h-10 border-4 border-whatsapp-teal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Starting Chrome and loading WhatsApp...</p>
          <p className="text-xs text-gray-400 mt-1">This can take up to 60 seconds on first run.</p>
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-4">Actions</h3>
        <div className="flex gap-3">
          {(displayStatus === 'disconnected') && (
            <button
              onClick={handleConnect}
              disabled={actionLoading}
              className="btn-primary flex-1 justify-center"
            >
              {actionLoading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Wifi className="w-4 h-4" />Connect WhatsApp</>
              }
            </button>
          )}

          {displayStatus === 'connected' && (
            <button
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="btn-danger flex-1 justify-center"
            >
              {actionLoading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><WifiOff className="w-4 h-4" />Disconnect</>
              }
            </button>
          )}

          {(displayStatus === 'initializing' || displayStatus === 'qr_ready') && (
            <p className="text-sm text-gray-500 text-center w-full py-2">
              {displayStatus === 'qr_ready' ? 'Waiting for QR scan...' : 'Waiting for device linking...'}
            </p>
          )}
        </div>
      </div>

      {/* Session Info */}
      <div className="card mt-4 bg-blue-50 border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">Session Persistence</h3>
        <p className="text-sm text-blue-700">
          Your WhatsApp session is stored in the database. After a server restart,
          the session is restored automatically — no QR scan needed unless WhatsApp expires it.
        </p>
      </div>
    </div>
  );
}