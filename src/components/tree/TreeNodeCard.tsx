import React from 'react';
import { Pencil, ArrowRightLeft } from 'lucide-react';
import type { Vendor } from '@/types';
import { ROLE_CONFIG } from '@/config/roles';
import { Avatar } from '@/components/common/Avatar';
import { useAppStore } from '@/store/useAppStore';

interface TreeNodeCardProps {
  id?: string;
  vendor: Vendor;
  isSelected?: boolean;
  isSearchMatch?: boolean;
  isPulsing?: boolean;
  onSelect?: () => void;
  onMoveProfile?: () => void;
  onEdit?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export const TreeNodeCard: React.FC<TreeNodeCardProps> = React.memo(({
  id,
  vendor,
  isSelected = false,
  isSearchMatch = false,
  isPulsing = false,
  onSelect,
  onMoveProfile,
  onEdit,
  onKeyDown,
}) => {
  const roleConfig = ROLE_CONFIG[vendor.role];
  const searchQuery = useAppStore((s) => s.searchFilters.search.trim().toLowerCase());

  // Helper to highlight matching search term
  const renderHighlighted = (text: string) => {
    if (!searchQuery) return text;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(searchQuery);
    if (idx === -1) return text;

    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-indigo-100 text-indigo-950 px-0.5 rounded-xs font-medium">
          {text.slice(idx, idx + searchQuery.length)}
        </mark>
        {text.slice(idx + searchQuery.length)}
      </>
    );
  };

  const isMovable = roleConfig?.movable ?? false;

  return (
    <div
      id={id}
      tabIndex={0}
      role="treeitem"
      aria-selected={isSelected}
      aria-label={`${vendor.name}, ${roleConfig?.label ?? vendor.role}`}
      onMouseDown={(e) => {
        if (e.target instanceof HTMLElement && e.target.closest('button')) {
          return;
        }
        e.currentTarget.focus();
      }}
      onClick={(e) => {
        e.currentTarget.focus();
        onSelect?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.();
        }
        onKeyDown?.(e);
      }}
      className={`relative w-[210px] bg-white rounded-lg p-3 text-left transition-all select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        isPulsing ? 'ring-4 ring-indigo-500/80 ring-offset-2 animate-pulse shadow-md' : ''
      } ${
        isSelected
          ? 'border-2 border-indigo-600 shadow-xs'
          : isSearchMatch
            ? 'border-2 border-indigo-400'
            : 'border border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top row: Avatar + Name + Edit Pencil */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={vendor.name} role={vendor.role} size="md" />
          <div className="min-w-0">
            <h4
              className="text-xs font-semibold text-slate-900 truncate leading-tight"
              title={vendor.name}
            >
              {renderHighlighted(vendor.name)}
            </h4>
            <p
              className="text-[11px] text-slate-500 truncate leading-normal"
              title={vendor.email}
            >
              {renderHighlighted(vendor.email)}
            </p>
          </div>
        </div>

        {/* Edit Pencil Icon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.();
          }}
          className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors shrink-0"
          title="Edit Profile"
          aria-label={`Edit ${vendor.name}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Move Profile button for movable roles */}
      {isMovable && onMoveProfile && (
        <div className="mt-2.5 pt-1.5 border-t border-slate-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMoveProfile();
            }}
            className="w-full py-1 px-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50/60 border border-indigo-500/80 rounded-md transition-colors flex items-center justify-center gap-1.5"
            aria-label={`Move ${vendor.name}`}
          >
            <ArrowRightLeft className="w-3 h-3" />
            <span>Move Profile</span>
          </button>
        </div>
      )}
    </div>
  );
});
