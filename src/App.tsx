import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { AppLayout } from '@/components/layout/AppLayout';

const TeamPage = lazy(() => import('@/pages/TeamPage').then((m) => ({ default: m.TeamPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const VehiclesPage = lazy(() => import('@/pages/VehiclesPage').then((m) => ({ default: m.VehiclesPage })));
const DriversPage = lazy(() => import('@/pages/DriversPage').then((m) => ({ default: m.DriversPage })));
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
const DelegationPage = lazy(() => import('@/pages/DelegationPage').then((m) => ({ default: m.DelegationPage })));
const AuditPage = lazy(() => import('@/pages/AuditPage').then((m) => ({ default: m.AuditPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const PageLoader = () => (
  <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-12 text-slate-400">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
    <span className="text-xs font-medium text-slate-500">Loading view...</span>
  </div>
);

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
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
