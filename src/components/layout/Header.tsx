import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, Menu, Sliders, ChevronDown, Check, UserCheck, Search, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { selectExpiringDocuments } from '@/store/selectors';
import { ROLE_CONFIG } from '@/config/roles';
import { Avatar } from '@/components/common/Avatar';
import { DevPanel } from '@/components/dev/DevPanel';
import type { RoleKey } from '@/types';

const ROLE_ORDER: RoleKey[] = [
  'ADMIN',
  'SITE_ADMIN',
  'GROUP_VENDOR',
  'SUB_VENDOR',
  'DEPLOYMENT_ASSOCIATE',
];

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
  const delegationsById = useAppStore((s) => s.delegationsById);
  const currentUser = useAppStore((s) => s.vendorsById[s.currentUserId]);
  const expiringCount = useAppStore((s) => selectExpiringDocuments(s).length);
  const actingOnBehalfOf = useAppStore((s) => s.actingOnBehalfOf);
  const setActingOnBehalfOf = useAppStore((s) => s.setActingOnBehalfOf);
  const activeReceivedDelegations = Object.values(delegationsById).filter(
    (d) => d.delegateId === currentUserId && d.enabled,
  );

  const [isViewAsOpen, setIsViewAsOpen] = useState(false);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
  const [viewAsSearch, setViewAsSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsViewAsOpen(false);
        setViewAsSearch('');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isViewAsOpen) {
        setIsViewAsOpen(false);
        setViewAsSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isViewAsOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isViewAsOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isViewAsOpen]);

  const vendorsList = Object.values(vendorsById);

  const filteredVendors = useMemo(() => {
    const q = viewAsSearch.trim().toLowerCase();
    if (!q) return vendorsList;
    return vendorsList.filter((v) => {
      const roleLabel = ROLE_CONFIG[v.role]?.label?.toLowerCase() ?? '';
      return (
        v.name.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q) ||
        roleLabel.includes(q)
      );
    });
  }, [vendorsList, viewAsSearch]);

  const vendorsByRole = useMemo(() => {
    const groups: Partial<Record<RoleKey, typeof vendorsList>> = {};
    for (const v of filteredVendors) {
      if (!groups[v.role]) groups[v.role] = [];
      groups[v.role]!.push(v);
    }
    return groups;
  }, [filteredVendors]);

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
          {/* Acting on Behalf of indicator (Spec 4A.5: status-info pill) */}
          {actingOnBehalfOf ? (
            <button
              type="button"
              onClick={() => setActingOnBehalfOf(null)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/30 hover:bg-[#1D4ED8]/20 transition-colors select-none cursor-pointer"
              title="Click to stop acting on behalf"
              aria-label={`Acting on behalf of ${vendorsById[actingOnBehalfOf]?.name ?? 'delegator'}. Click to exit.`}
            >
              <span className="w-2 h-2 rounded-full bg-[#1D4ED8] animate-pulse" />
              <span>Acting for {vendorsById[actingOnBehalfOf]?.name ?? 'Delegator'}</span>
              <span className="text-[10px] text-blue-600/80 font-normal ml-0.5">✕</span>
            </button>
          ) : activeReceivedDelegations.length > 0 && activeReceivedDelegations[0] ? (
            <button
              type="button"
              onClick={() => {
                const targetDelegatorId = activeReceivedDelegations[0]?.delegatorId;
                if (targetDelegatorId) setActingOnBehalfOf(targetDelegatorId);
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors select-none cursor-pointer"
              title={`Switch to act on behalf of ${vendorsById[activeReceivedDelegations[0].delegatorId]?.name ?? 'delegator'}`}
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Act for {vendorsById[activeReceivedDelegations[0].delegatorId]?.name ?? 'Delegator'}</span>
            </button>
          ) : currentUserId !== 'admin' ? (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Perspective: {currentUser?.name}</span>
            </div>
          ) : null}

          {/* Expiry reminders notification bell */}
          <button
            type="button"
            className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title={`${expiringCount} expiring documents`}
            aria-label={`Notifications (${expiringCount} reminders)`}
          >
            <Bell className="w-4 h-4" />
            {expiringCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>

          {/* Dev Panel Trigger */}
          <button
            type="button"
            onClick={() => setIsDevPanelOpen(true)}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Open Developer Panel"
            aria-label="Developer Panel"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* View As Switcher Dropdown (Per Section 4A.5 & Section 10) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsViewAsOpen(!isViewAsOpen)}
              className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
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
                className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                role="listbox"
                aria-label="Select user to view as"
              >
                {/* Search Bar */}
                <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search user or role..."
                      value={viewAsSearch}
                      onChange={(e) => setViewAsSearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    {viewAsSearch && (
                      <button
                        type="button"
                        onClick={() => setViewAsSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Grouped Vendor List */}
                <div className="max-h-80 overflow-y-auto p-1.5 space-y-2">
                  {ROLE_ORDER.map((role) => {
                    const list = vendorsByRole[role];
                    if (!list || list.length === 0) return null;
                    const rConfig = ROLE_CONFIG[role];
                    return (
                      <div key={role} className="space-y-0.5">
                        <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rConfig.colorHex }} />
                            <span>{rConfig.label}</span>
                          </span>
                          <span className="text-[9px] font-medium bg-slate-100 px-1.5 py-0.2 rounded-full text-slate-500">
                            {list.length}
                          </span>
                        </div>
                        {list.map((vendor) => {
                          const isSelected = vendor.id === currentUserId;
                          return (
                            <button
                              key={vendor.id}
                              type="button"
                              onClick={() => {
                                switchUser(vendor.id);
                                setIsViewAsOpen(false);
                                setViewAsSearch('');
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 text-indigo-900 font-medium'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar name={vendor.name} role={vendor.role} size="sm" />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate leading-tight">
                                    {vendor.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 leading-none truncate mt-0.5">
                                    {vendor.email}
                                  </p>
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {filteredVendors.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No users matching "{viewAsSearch}"
                    </div>
                  )}
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
