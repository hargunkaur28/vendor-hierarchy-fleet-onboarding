import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { TeamPage } from '@/pages/TeamPage';
import {
  DashboardPage,
  VehiclesPage,
  DriversPage,
  DocumentsPage,
  AuditPage,
} from '@/pages/Placeholders';
import { DelegationPage } from '@/pages/DelegationPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function App() {
  const initApp = useAppStore((s) => s.initApp);
  const isInitialized = useAppStore((s) => s.isInitialized);

  useEffect(() => {
    if (!isInitialized) {
      initApp();
    }
  }, [initApp, isInitialized]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/team" replace />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/drivers" element={<DriversPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/delegation" element={<DelegationPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
