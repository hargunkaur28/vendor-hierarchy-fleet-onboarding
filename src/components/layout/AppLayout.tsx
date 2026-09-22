import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { UserCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { PERMISSION_CONFIG } from '@/config/permissions';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  const actingOnBehalfOf = useAppStore((s) => s.actingOnBehalfOf);
  const setActingOnBehalfOf = useAppStore((s) => s.setActingOnBehalfOf);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const delegationsById = useAppStore((s) => s.delegationsById);
  const vendorsById = useAppStore((s) => s.vendorsById);

  const activeDelegation = actingOnBehalfOf
    ? Object.values(delegationsById).find(
        (d) => d.delegatorId === actingOnBehalfOf && d.delegateId === currentUserId && d.enabled,
      )
    : null;
  const delegator = actingOnBehalfOf ? vendorsById[actingOnBehalfOf] : null;

  // Map route to page title
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/team':
        return 'My Team';
      case '/dashboard':
        return 'Dashboard';
      case '/vehicles':
        return 'Fleet & Vehicles';
      case '/drivers':
        return 'Drivers';
      case '/documents':
        return 'Document Verification';
      case '/delegation':
        return 'Delegation & Access';
      case '/audit':
        return 'Audit Logs';
      default:
        return 'Vendor Management';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      <Toaster position="top-right" richColors closeButton />

      {/* Desktop Sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden w-full h-full border-none cursor-default"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close mobile navigation drawer backdrop"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onCloseMobile={() => setIsMobileOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          title={getPageTitle()}
          onToggleSidebar={() => setIsMobileOpen(!isMobileOpen)}
        />

        {/* Acting on Behalf of Banner (Spec Section 8.2 / F5) */}
        {actingOnBehalfOf && delegator && (
          <div className="bg-[#1D4ED8]/10 border-b border-[#1D4ED8]/25 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#1D4ED8]">
            <div className="flex items-center gap-2 flex-wrap">
              <UserCheck className="w-4 h-4 shrink-0 text-[#1D4ED8]" />
              <span>
                You are acting on behalf of <strong className="font-semibold text-blue-950">{delegator.name}</strong>.
                Permitted actions are restricted to your delegated scope:
              </span>
              <div className="inline-flex flex-wrap gap-1 ml-1">
                {activeDelegation?.scope.map((p) => (
                  <span
                    key={p}
                    className="px-1.5 py-0.5 text-[10px] font-semibold bg-white/80 text-blue-900 border border-blue-200/80 rounded"
                  >
                    {PERMISSION_CONFIG[p]?.label ?? p}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActingOnBehalfOf(null)}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 transition-colors shadow-2xs select-none cursor-pointer"
            >
              Exit Acting Mode
            </button>
          </div>
        )}

        <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
