import React, { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown, Keyboard, Check, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { RoleLegend } from './RoleLegend';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { ROLE_CONFIG } from '@/config/roles';
import type { RoleKey } from '@/types';

const AVAILABLE_TAGS = ['North', 'South', 'East', 'West', 'Airport', 'Fleet', 'Premium', 'Electric'];
const ALL_ROLES: RoleKey[] = [
  'ADMIN',
  'SITE_ADMIN',
  'GROUP_VENDOR',
  'SUB_VENDOR',
  'DEPLOYMENT_ASSOCIATE',
];

export const TreeToolbar: React.FC = () => {
  const searchFilters = useAppStore((s) => s.searchFilters);
  const setSearchFilters = useAppStore((s) => s.setSearchFilters);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);

  // Local immediate state for zero-lag input rendering
  const [localSearch, setLocalSearch] = useState(searchFilters.search);
  const [prevExternalSearch, setPrevExternalSearch] = useState(searchFilters.search);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external search filter changes (e.g. cleared elsewhere) during render
  if (searchFilters.search !== prevExternalSearch) {
    setPrevExternalSearch(searchFilters.search);
    setLocalSearch(searchFilters.search);
  }

  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tagsDropdownRef = useRef<HTMLDivElement>(null);
  const rolesDropdownRef = useRef<HTMLDivElement>(null);

  // Global '/' shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (e.key === '/' && activeTag !== 'input' && activeTag !== 'textarea') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagsDropdownRef.current && !tagsDropdownRef.current.contains(e.target as Node)) {
        setIsTagsOpen(false);
      }
      if (rolesDropdownRef.current && !rolesDropdownRef.current.contains(e.target as Node)) {
        setIsRolesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setSearchFilters({ search: value });
    }, 250);
  };

  const handleClearSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setLocalSearch('');
    setSearchFilters({ search: '' });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClearSearch();
      searchInputRef.current?.blur();
    }
  };

  const handleTagToggle = (tag: string) => {
    const current = searchFilters.tags || [];
    const updated = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    setSearchFilters({ tags: updated });
  };

  const handleRoleToggle = (role: RoleKey) => {
    const current = searchFilters.roles || [];
    const updated = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    setSearchFilters({ roles: updated });
  };

  return (
    <div className="w-full bg-white border-b border-slate-200 px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      {/* Left side: Search input + Select Tags + Role Legend */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="relative min-w-[280px] sm:w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by name, email or Phone No."
            className="w-full pl-9 pr-14 py-2 text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            aria-label="Search vendors by name, email or phone number"
          />
          {localSearch ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded">
              /
            </kbd>
          )}
        </div>

        {/* Select Tags Multi-Select Dropdown */}
        <div className="relative" ref={tagsDropdownRef}>
          <button
            type="button"
            onClick={() => setIsTagsOpen(!isTagsOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-normal text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            aria-expanded={isTagsOpen}
            aria-haspopup="listbox"
          >
            <span>
              {searchFilters.tags.length > 0
                ? `${searchFilters.tags.length} tag${searchFilters.tags.length > 1 ? 's' : ''} selected`
                : 'Select Tags'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {isTagsOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-1.5"
              role="listbox"
              aria-label="Filter by tags"
            >
              <div className="space-y-0.5 max-h-56 overflow-y-auto">
                {AVAILABLE_TAGS.map((tag) => {
                  const isSelected = searchFilters.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span>{tag}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
              {searchFilters.tags.length > 0 && (
                <div className="pt-1.5 mt-1 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSearchFilters({ tags: [] })}
                    className="text-[11px] text-indigo-600 hover:underline px-2 py-0.5"
                  >
                    Clear tags
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Select Roles Multi-Select Dropdown */}
        <div className="relative" ref={rolesDropdownRef}>
          <button
            type="button"
            onClick={() => setIsRolesOpen(!isRolesOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-normal text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            aria-expanded={isRolesOpen}
            aria-haspopup="listbox"
          >
            <span>
              {searchFilters.roles.length > 0
                ? `${searchFilters.roles.length} role${searchFilters.roles.length > 1 ? 's' : ''} selected`
                : 'Select Roles'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {isRolesOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-1.5"
              role="listbox"
              aria-label="Filter by roles"
            >
              <div className="space-y-0.5 max-h-56 overflow-y-auto">
                {ALL_ROLES.map((role) => {
                  const isSelected = searchFilters.roles.includes(role);
                  const config = ROLE_CONFIG[role];
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleToggle(role)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: config.colorHex }}
                        />
                        <span>{config.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
              {searchFilters.roles.length > 0 && (
                <div className="pt-1.5 mt-1 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSearchFilters({ roles: [] })}
                    className="text-[11px] text-indigo-600 hover:underline px-2 py-0.5 cursor-pointer"
                  >
                    Clear roles
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Role Color Legend */}
        <div className="hidden lg:block pl-2">
          <RoleLegend />
        </div>
      </div>

      {/* Right side: Keyboard shortcut icon + View Mode toggles */}
      <div className="flex items-center gap-2.5 self-end xl:self-auto">
        {/* Keyboard Shortcuts Trigger Button */}
        <button
          type="button"
          onClick={() => setIsShortcutsOpen(true)}
          className="p-2 text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 rounded-lg transition-colors"
          title="Keyboard shortcuts (Press / to search)"
          aria-label="View keyboard shortcuts"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Horizontal View Toggle */}
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'horizontal' ? 'tree' : 'horizontal')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
            viewMode === 'horizontal'
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          aria-pressed={viewMode === 'horizontal'}
        >
          Horizontal
        </button>

        {/* Compact View Toggle */}
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'compact' ? 'tree' : 'compact')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
            viewMode === 'compact'
              ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          aria-pressed={viewMode === 'compact'}
        >
          Compact
        </button>
      </div>

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
