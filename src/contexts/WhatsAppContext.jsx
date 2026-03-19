import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../services/api';

const WhatsAppContext = createContext(null);

// On Render, frontend and backend are separate services.
// We connect the socket directly to the backend URL.
const BACKEND_URL =  "https://whatsapp-scheduler-t9a2.onrender.com".replace('/api', '')

export function WhatsAppProvider({ children }) {
  const { user } = useAuth();
  const [waStatus, setWaStatus] = useState('initializing');
  const [qrCode, setQrCode] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    // Fetch real status via HTTP immediately — don't wait for socket
    api.get('/whatsapp/status').then(res => {
      setWaStatus(res.data.status);
      setQrCode(res.data.qr || null);
    }).catch(() => {
      setWaStatus('disconnected');
    });

    const socket = io(BACKEND_URL, {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      socket.emit('join', { userId: user.id });
      // Re-fetch status on reconnect in case we missed events
      api.get('/whatsapp/status').then(res => {
        setWaStatus(res.data.status);
        setQrCode(res.data.qr || null);
      }).catch(() => {});
    });

    socket.on('wa:status', ({ status, qr }) => {
      setWaStatus(status);
      setQrCode(qr || null);
    });

    socket.on('wa:qr', ({ qr }) => {
      setQrCode(qr);
      setWaStatus('qr_ready');
    });

    socket.on('wa:ready', () => {
      setWaStatus('connected');
      setQrCode(null);
    });

    socket.on('wa:disconnected', () => {
      setWaStatus('disconnected');
      setQrCode(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connect error:', err.message);
    });

    // Poll status every 10s as fallback when socket is unreliable
    const pollInterval = setInterval(() => {
      if (!socket.connected) {
        api.get('/whatsapp/status').then(res => {
          setWaStatus(res.data.status);
          setQrCode(res.data.qr || null);
        }).catch(() => {});
      }
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      socket.disconnect();
    };
  }, [user]);

  return (
    <WhatsAppContext.Provider value={{ waStatus, qrCode, socket: socketRef.current }}>
      {children}
    </WhatsAppContext.Provider>
  );
}

export function useWhatsApp() {
  return useContext(WhatsAppContext);
}