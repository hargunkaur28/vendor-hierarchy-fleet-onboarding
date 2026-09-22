import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown, UserX } from 'lucide-react';
import type { Vendor } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { selectVisibleTree } from '@/store/selectors';
import { TreeNodeCard } from './TreeNodeCard';

interface HierarchyTreeProps {
  onMoveProfile?: (vendor: Vendor) => void;
  onEditVendor?: (vendor: Vendor) => void;
}

export const HierarchyTree: React.FC<HierarchyTreeProps> = ({
  onMoveProfile,
  onEditVendor,
}) => {
  const vendorsById = useAppStore((s) => s.vendorsById);
  const childrenIndex = useAppStore((s) => s.childrenIndex);
  const expandedIds = useAppStore((s) => s.expandedIds);
  const toggleExpanded = useAppStore((s) => s.toggleExpanded);
  const selectedVendorId = useAppStore((s) => s.selectedVendorId);
  const setSelectedVendorId = useAppStore((s) => s.setSelectedVendorId);
  const isLoading = useAppStore((s) => s.isLoading);

  const searchFilters = useAppStore((s) => s.searchFilters);
  const statusFilter = useAppStore((s) => s.statusFilter);

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

  // Keyboard navigation handler for tree nodes
  const handleNodeKeyDown = (
    e: React.KeyboardEvent,
    vendorId: string,
    parentId: string | null,
  ) => {
    const children = (childrenIndex[vendorId] || []).filter(
      (id) => !hasFilter || visibleIds.has(id),
    );
    const isExpanded = expandedIds.has(vendorId);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        // Navigate to first child if expanded
        if (isExpanded && children.length > 0 && children[0]) {
          const firstChildEl = document.getElementById(`node-${children[0]}`);
          firstChildEl?.focus();
          setSelectedVendorId(children[0]);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        // Navigate to parent
        if (parentId) {
          const parentEl = document.getElementById(`node-${parentId}`);
          parentEl?.focus();
          setSelectedVendorId(parentId);
        }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (!isExpanded && children.length > 0) {
          toggleExpanded(vendorId);
        } else if (isExpanded && children.length > 0 && children[0]) {
          const nextChildEl = document.getElementById(`node-${children[0]}`);
          nextChildEl?.focus();
          setSelectedVendorId(children[0]);
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (isExpanded && children.length > 0) {
          toggleExpanded(vendorId);
        } else if (parentId) {
          const parentEl = document.getElementById(`node-${parentId}`);
          parentEl?.focus();
          setSelectedVendorId(parentId);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        setSelectedVendorId(vendorId);
        break;
      }
    }
  };

  // Recursive Branch Renderer
  const renderBranch = (vendorId: string): React.ReactNode => {
    const vendor = vendorsById[vendorId];
    if (!vendor) return null;

    if (hasFilter && !visibleIds.has(vendorId)) {
      return null;
    }

    const rawChildren = childrenIndex[vendorId] || [];
    const children = rawChildren.filter((id) => !hasFilter || visibleIds.has(id));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(vendorId) || hasFilter; // Auto-expand matching filter
    const isSelected = selectedVendorId === vendorId;
    const isMatch = hasFilter && matchIds.has(vendorId);

    return (
      <div key={vendorId} className="flex flex-col items-center">
        {/* Node Card */}
        <TreeNodeCard
          id={`node-${vendorId}`}
          vendor={vendor}
          isSelected={isSelected}
          isSearchMatch={isMatch}
          onSelect={() => setSelectedVendorId(vendorId)}
          onMoveProfile={onMoveProfile ? () => onMoveProfile(vendor) : undefined}
          onEdit={onEditVendor ? () => onEditVendor(vendor) : undefined}
          onKeyDown={(e) => handleNodeKeyDown(e, vendorId, vendor.parentId)}
        />

        {/* Expand / Collapse Chevron + Child Count Badge */}
        {hasChildren && (
          <div className="relative flex flex-col items-center">
            {/* Top vertical connector from card to badge */}
            <div className="w-[1.5px] h-3 bg-slate-300" />

            {/* Caret Button with count badge */}
            <button
              type="button"
              onClick={() => toggleExpanded(vendorId)}
              className="z-10 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-2xs cursor-pointer select-none"
              title={`${isExpanded ? 'Collapse' : 'Expand'} ${children.length} direct child team members`}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${vendor.name}'s ${children.length} team members`}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronUp className="w-3 h-3 text-slate-500" />
              ) : (
                <ChevronDown className="w-3 h-3 text-slate-500" />
              )}
              <span>{children.length}</span>
            </button>

            {/* Bottom vertical connector from badge into children bus line */}
            {isExpanded && <div className="w-[1.5px] h-4 bg-slate-300" />}
          </div>
        )}

        {/* Children Subtree */}
        {hasChildren && isExpanded && (
          <div className="flex pt-1 relative">
            {children.map((childId, index) => {
              const isFirst = index === 0;
              const isLast = index === children.length - 1;
              const isSingle = children.length === 1;

              return (
                <div key={childId} className="flex flex-col items-center px-3 relative">
                  {/* Horizontal bus line linking children */}
                  {!isSingle && (
                    <div
                      className={`absolute top-0 h-[1.5px] bg-slate-300 ${
                        isFirst
                          ? 'left-1/2 right-0'
                          : isLast
                            ? 'left-0 right-1/2'
                            : 'left-0 right-0'
                      }`}
                    />
                  )}

                  {/* Vertical connector dropping down into child card */}
                  <div className="w-[1.5px] h-4 bg-slate-300" />

                  {/* Recursively render child branch */}
                  {renderBranch(childId)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4" />
        <p className="text-sm">Loading organization hierarchy...</p>
      </div>
    );
  }

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
        <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query or tags filter.</p>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-[600px] overflow-auto p-8 flex justify-center bg-slate-50/60"
      role="tree"
      aria-label="Organization hierarchy tree"
    >
      <div className="inline-flex min-w-max justify-center py-4">
        {renderBranch(rootNode.id)}
      </div>
    </div>
  );
};
