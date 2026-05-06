import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import Contacts from './components/Contacts';
import Settings from './components/Settings';
import Team from './components/Team';
import Scheduling from './components/Scheduling';
import Kanban from './components/Kanban';
import Campaigns from './components/Campaigns';
import Journeys from './components/Journeys';
import Auth from './pages/Auth';
import ProtectedRoute from './components/ProtectedRoute';

import { CompanySettingsProvider } from './hooks/useCompanySettings';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { Toaster } from 'sonner';
import { OnboardingWizard } from './components/OnboardingWizard';
import { useOnboardingStatus } from './hooks/useOnboardingStatus';

const AppLayout: React.FC = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isComplete, hasSeenWizard, loading } = useOnboardingStatus();

  useEffect(() => {
    if (!loading && !isComplete && !hasSeenWizard) {
      setShowOnboarding(true);
    }
  }, [loading, isComplete, hasSeenWizard]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar />

      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        <div className="flex-1 w-full h-full relative">
          <Outlet context={{ showOnboarding, setShowOnboarding }} />
        </div>
      </main>

      <OnboardingWizard
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
};

const ToasterWrapper: React.FC = () => {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      richColors
      theme={theme}
    />
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CompanySettingsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pipeline" element={<Kanban />} />
                <Route path="/chat" element={<ChatInterface />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/scheduling" element={<Scheduling />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/journeys" element={<Journeys />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
          <ToasterWrapper />
        </CompanySettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
