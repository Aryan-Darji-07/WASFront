import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WhatsAppProvider } from './contexts/WhatsAppContext';
import { NotificationProvider } from './components/Notification';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ScheduleMessagePage from './pages/ScheduleMessagePage';
import WhatsAppPage from './pages/WhatsAppPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import { ConfirmProvider } from './components/ConfirmModal';

function AppShell() {
  return (
    <WhatsAppProvider>
    <ConfirmProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><ScheduleMessagePage /></ProtectedRoute>} />
          <Route path="/whatsapp" element={<ProtectedRoute><WhatsAppPage /></ProtectedRoute>} />
          <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      </ConfirmProvider>
    </WhatsAppProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}
