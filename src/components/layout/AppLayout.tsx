import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

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

        <main className="flex-1 overflow-auto bg-slate-50/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
