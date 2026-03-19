import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../services/api';

const WhatsAppContext = createContext(null);

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

    const socket = io('https://whatsapp-scheduler-t9a2.onrender.com/', {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
  console.log('[Socket] Connected');
  socket.emit('join', { userId: user.id }); // tells server which user's room to join
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

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    return () => {
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