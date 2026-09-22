import React, { useState, useRef, useEffect } from 'react';
import { Bell, Menu, Sliders, ChevronDown, Check, UserCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { selectCurrentUser, selectExpiringDocuments } from '@/store/selectors';
import { ROLE_CONFIG } from '@/config/roles';
import { Avatar } from '@/components/common/Avatar';
import { DevPanel } from '@/components/dev/DevPanel';

interface HeaderProps {
  title?: string;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'My Team',
  onToggleSidebar,
}) => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const switchUser = useAppStore((s) => s.switchUser);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const currentUser = selectCurrentUser(useAppStore.getState());
  const expiringDocs = selectExpiringDocuments(useAppStore.getState());

  const [isViewAsOpen, setIsViewAsOpen] = useState(false);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsViewAsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const vendorsList = Object.values(vendorsById);

  return (
    <>
      <header className="sticky top-0 z-20 h-14 bg-white/90 backdrop-blur-xs border-b border-slate-200 px-6 flex items-center justify-between">
        {/* Left: Mobile menu toggle + Page title */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Acting on Behalf of indicator (if applicable) */}
          {currentUserId !== 'admin' && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Perspective: {currentUser?.name}</span>
            </div>
          )}

          {/* Expiry reminders notification bell */}
          <button
            type="button"
            className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title={`${expiringDocs.length} expiring documents`}
            aria-label={`Notifications (${expiringDocs.length} reminders)`}
          >
            <Bell className="w-4 h-4" />
            {expiringDocs.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>

          {/* Dev Panel Trigger */}
          <button
            type="button"
            onClick={() => setIsDevPanelOpen(true)}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Open Developer Panel"
            aria-label="Developer Panel"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* View As Switcher Dropdown (Per Section 4A.5) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsViewAsOpen(!isViewAsOpen)}
              className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              aria-label="Switch user perspective"
              aria-expanded={isViewAsOpen}
              aria-haspopup="listbox"
            >
              {currentUser && (
                <Avatar name={currentUser.name} role={currentUser.role} size="sm" />
              )}
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {currentUser?.name ?? 'Select user'}
                </p>
                <p className="text-[10px] text-slate-500 leading-none">
                  {currentUser ? (ROLE_CONFIG[currentUser.role]?.label ?? currentUser.role) : 'View as'}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {isViewAsOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 overflow-hidden"
                role="listbox"
                aria-label="Select user to view as"
              >
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  View As (Switch Perspective)
                </div>
                <div className="mt-1 max-h-60 overflow-y-auto space-y-1">
                  {vendorsList.slice(0, 15).map((vendor) => {
                    const isSelected = vendor.id === currentUserId;
                    const rConfig = ROLE_CONFIG[vendor.role];
                    return (
                      <button
                        key={vendor.id}
                        type="button"
                        onClick={() => {
                          switchUser(vendor.id);
                          setIsViewAsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={vendor.name} role={vendor.role} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate leading-tight">
                              {vendor.name}
                            </p>
                            <p className="text-[10px] text-slate-400 leading-none truncate">
                              {rConfig?.label ?? vendor.role}
                            </p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Dev Panel Modal */}
      <DevPanel isOpen={isDevPanelOpen} onClose={() => setIsDevPanelOpen(false)} />
    </>
  );
};
