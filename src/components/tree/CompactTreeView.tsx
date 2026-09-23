import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronRight,
  ChevronDown,
  ArrowRightLeft,
  UserX,
} from 'lucide-react';
import type { Vendor } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { selectVisibleTree } from '@/store/selectors';
import { ROLE_CONFIG } from '@/config/roles';
import { Avatar } from '@/components/common/Avatar';

interface CompactTreeViewProps {
  onMoveProfile?: (vendor: Vendor) => void;
  pulsingVendorId?: string | null;
}

interface FlatTreeNode {
  vendor: Vendor;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  childrenCount: number;
  parentId: string | null;
}

export const CompactTreeView: React.FC<CompactTreeViewProps> = ({
  onMoveProfile,
  pulsingVendorId,
}) => {
  const vendorsById = useAppStore((s) => s.vendorsById);
  const childrenIndex = useAppStore((s) => s.childrenIndex);
  const expandedIds = useAppStore((s) => s.expandedIds);
  const toggleExpanded = useAppStore((s) => s.toggleExpanded);
  const selectedVendorId = useAppStore((s) => s.selectedVendorId);
  const setSelectedVendorId = useAppStore((s) => s.setSelectedVendorId);
  const searchFilters = useAppStore((s) => s.searchFilters);
  const statusFilter = useAppStore((s) => s.statusFilter);
  const searchQuery = useAppStore((s) => s.searchFilters.search.trim().toLowerCase());

  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize visible tree reactively based on filters and vendors
  const { matchIds, visibleIds, hasFilter } = useMemo(() => {
    return selectVisibleTree({
      vendorsById,
      searchFilters,
      statusFilter,
    } as Parameters<typeof selectVisibleTree>[0]);
  }, [vendorsById, searchFilters, statusFilter]);

  // Find root node (vendor without parentId, or 'admin')
  const rootNode = useMemo(() => {
    return (
      vendorsById['admin'] ||
      Object.values(vendorsById).find((v) => !v.parentId) ||
      Object.values(vendorsById)[0]
    );
  }, [vendorsById]);

  // Flatten the hierarchy based on expanded states and filters
  const flatNodes = useMemo(() => {
    if (!rootNode) return [];

    const list: FlatTreeNode[] = [];

    const traverse = (nodeId: string, depth: number) => {
      const vendor = vendorsById[nodeId];
      if (!vendor) return;

      if (hasFilter && !visibleIds.has(nodeId)) {
        return;
      }

      const rawChildren = childrenIndex[nodeId] || [];
      const children = rawChildren.filter((id) => !hasFilter || visibleIds.has(id));
      const hasChildren = children.length > 0;
      const isExpanded = expandedIds.has(nodeId) || hasFilter;

      list.push({
        vendor,
        depth,
        hasChildren,
        isExpanded,
        childrenCount: children.length,
        parentId: vendor.parentId,
      });

      if (hasChildren && isExpanded) {
        children.forEach((childId) => traverse(childId, depth + 1));
      }
    };

    traverse(rootNode.id, 0);
    return list;
  }, [rootNode, vendorsById, childrenIndex, expandedIds, hasFilter, visibleIds]);

  // Virtualizer for smooth rendering of large trees
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 48,
    overscan: 10,
    initialRect: { width: 800, height: 600 },
  });

  const virtualItems = virtualizer.getVirtualItems();
  const itemsToRender = virtualItems.length > 0
    ? virtualItems.map((vi) => ({
        item: flatNodes[vi.index]!,
        index: vi.index,
        style: {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          width: '100%',
          height: `${vi.size}px`,
          transform: `translateY(${vi.start}px)`,
        },
      }))
    : flatNodes.map((item, index) => ({
        item,
        index,
        style: {
          height: '48px',
        },
      }));

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

  const handleKeyDown = (e: React.KeyboardEvent, index: number, item: FlatTreeNode) => {
    const { vendor, hasChildren, isExpanded } = item;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (index < flatNodes.length - 1) {
          const nextNode = flatNodes[index + 1];
          if (nextNode) {
            setSelectedVendorId(nextNode.vendor.id);
            const nextEl = document.getElementById(`compact-node-${nextNode.vendor.id}`);
            nextEl?.focus();
          }
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (index > 0) {
          const prevNode = flatNodes[index - 1];
          if (prevNode) {
            setSelectedVendorId(prevNode.vendor.id);
            const prevEl = document.getElementById(`compact-node-${prevNode.vendor.id}`);
            prevEl?.focus();
          }
        }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (hasChildren && !isExpanded) {
          toggleExpanded(vendor.id);
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (hasChildren && isExpanded) {
          toggleExpanded(vendor.id);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        setSelectedVendorId(vendor.id);
        break;
      }
      case 'm':
      case 'M': {
        const roleConfig = ROLE_CONFIG[vendor.role];
        if (roleConfig?.movable && onMoveProfile) {
          e.preventDefault();
          onMoveProfile(vendor);
        }
        break;
      }
    }
  };

  if (!rootNode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-12 text-slate-500">
        <UserX className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No vendors found</h3>
        <p className="text-sm text-slate-400 mt-1">Please initialize or seed data in the Dev Panel.</p>
      </div>
    );
  }

  if (hasFilter && matchIds.size === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20 text-slate-500">
        <UserX className="w-10 h-10 text-slate-300 mb-2" />
        <h4 className="text-sm font-semibold text-slate-700">No matching team members</h4>
        <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query or filters.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto bg-slate-50/50 p-4 sm:p-6"
      role="tree"
      aria-label="Compact organization hierarchy"
    >
      <div
        className="w-full max-w-4xl mx-auto bg-white rounded-xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden relative"
        style={{ height: `${virtualizer.getTotalSize() || flatNodes.length * 48}px` }}
      >
        {itemsToRender.map(({ item, index, style }) => {
          const { vendor, depth, hasChildren, isExpanded, childrenCount } = item;
          const roleConfig = ROLE_CONFIG[vendor.role];
          const isSelected = selectedVendorId === vendor.id;
          const isMatch = hasFilter && matchIds.has(vendor.id);
          const isPulsing = pulsingVendorId === vendor.id;
          const isMovable = roleConfig?.movable ?? false;

          return (
            <div
              key={vendor.id}
              id={`compact-node-${vendor.id}`}
              tabIndex={0}
              role="treeitem"
              aria-selected={isSelected}
              aria-expanded={hasChildren ? isExpanded : undefined}
              aria-level={depth + 1}
              style={style}
              onClick={() => setSelectedVendorId(vendor.id)}
              onKeyDown={(e) => handleKeyDown(e, index, item)}
              className={`flex items-center justify-between px-4 transition-colors group cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10 ${
                isPulsing ? 'bg-indigo-100/70 ring-2 ring-indigo-500 animate-pulse' : ''
              } ${
                isSelected
                  ? 'bg-indigo-50/80 border-l-4 border-l-indigo-600'
                  : isMatch
                    ? 'bg-amber-50/60 hover:bg-amber-100/40'
                    : 'hover:bg-slate-50'
              }`}
            >
              {/* Left Side: Indentation + Chevron + Avatar + Info */}
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                {/* Indentation guide lines */}
                <div
                  className="flex items-center shrink-0"
                  style={{ width: `${depth * 24}px` }}
                >
                  {Array.from({ length: depth }).map((_, i) => (
                    <div
                      key={i}
                      className="w-6 h-full flex items-center justify-center"
                    >
                      <div className="w-[1px] h-12 bg-slate-200" />
                    </div>
                  ))}
                </div>

                {/* Expand / Collapse Chevron */}
                <div className="w-6 shrink-0 flex items-center justify-center">
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(vendor.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${vendor.name}'s ${childrenCount} child vendors`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1.5" />
                  )}
                </div>

                {/* Avatar */}
                <Avatar name={vendor.name} role={vendor.role} size="sm" />

                {/* Name, Role & Email */}
                <div className="min-w-0 flex items-center gap-2.5 truncate">
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {renderHighlighted(vendor.name)}
                  </span>

                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                    style={{
                      backgroundColor: `${roleConfig?.colorHex}15`,
                      color: roleConfig?.colorHex,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: roleConfig?.colorHex }}
                    />
                    {roleConfig?.label ?? vendor.role}
                  </span>

                  <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                    {renderHighlighted(vendor.email)}
                  </span>
                </div>
              </div>

              {/* Right Side: Status Badge, Child Count & Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Child Count Badge if any */}
                {hasChildren && (
                  <span
                    className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200"
                    title={`${childrenCount} direct reports`}
                  >
                    {childrenCount} {childrenCount === 1 ? 'member' : 'members'}
                  </span>
                )}

                {/* Status Badge */}
                <span
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    vendor.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : vendor.status === 'SUSPENDED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {vendor.status}
                </span>

                {/* Actions: Move and Edit */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  {isMovable && onMoveProfile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveProfile(vendor);
                      }}
                      className="p-1 rounded text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title={`Move ${vendor.name}`}
                      aria-label={`Move ${vendor.name}`}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
