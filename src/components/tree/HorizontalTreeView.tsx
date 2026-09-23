import React, { useMemo, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, UserX } from 'lucide-react';
import type { Vendor } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { selectVisibleTree } from '@/store/selectors';
import { TreeNodeCard } from './TreeNodeCard';

interface HorizontalTreeViewProps {
  onMoveProfile?: (vendor: Vendor) => void;
  onEditVendor?: (vendor: Vendor) => void;
  pulsingVendorId?: string | null;
}

export const HorizontalTreeView: React.FC<HorizontalTreeViewProps> = ({
  onMoveProfile,
  onEditVendor,
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

  // Auto-scroll first match into view
  useEffect(() => {
    if (hasFilter && matchIds.size > 0) {
      const firstMatchId = Array.from(matchIds)[0];
      if (firstMatchId) {
        const el = document.getElementById(`horiz-node-${firstMatchId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  }, [hasFilter, matchIds]);

  const handleKeyDown = (
    e: React.KeyboardEvent,
    vendorId: string,
    parentId: string | null,
  ) => {
    const rawChildren = childrenIndex[vendorId] || [];
    const children = rawChildren.filter((id) => !hasFilter || visibleIds.has(id));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(vendorId);

    // Siblings under the same parent
    const siblings = parentId
      ? (childrenIndex[parentId] || []).filter(
          (id) => !hasFilter || visibleIds.has(id),
        )
      : [];
    const currentIndex = siblings.indexOf(vendorId);
    const nextSiblingId =
      currentIndex >= 0 && currentIndex < siblings.length - 1
        ? siblings[currentIndex + 1]
        : null;
    const prevSiblingId =
      currentIndex > 0 ? siblings[currentIndex - 1] : null;

    const focusNode = (targetId: string) => {
      setSelectedVendorId(targetId);
      const targetEl = document.getElementById(`horiz-node-${targetId}`);
      targetEl?.focus();
    };

    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        // SPEC: Right = expand
        if (hasChildren && !isExpanded) {
          toggleExpanded(vendorId);
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        // SPEC: Left = collapse
        if (hasChildren && isExpanded) {
          toggleExpanded(vendorId);
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (nextSiblingId) {
          focusNode(nextSiblingId);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (prevSiblingId) {
          focusNode(prevSiblingId);
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

  // Recursive Branch Renderer with strictly orthogonal / right-angle connector lines
  const renderBranch = (vendorId: string): React.ReactNode => {
    const vendor = vendorsById[vendorId];
    if (!vendor) return null;

    if (hasFilter && !visibleIds.has(vendorId)) {
      return null;
    }

    const rawChildren = childrenIndex[vendorId] || [];
    const children = rawChildren.filter((id) => !hasFilter || visibleIds.has(id));
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(vendorId) || hasFilter;
    const isSelected = selectedVendorId === vendorId;
    const isMatch = hasFilter && matchIds.has(vendorId);

    return (
      <div key={vendorId} className="flex items-center">
        {/* Node Card */}
        <TreeNodeCard
          id={`horiz-node-${vendorId}`}
          vendor={vendor}
          isSelected={isSelected}
          isSearchMatch={isMatch}
          isPulsing={pulsingVendorId === vendorId}
          onSelect={() => setSelectedVendorId(vendorId)}
          onMoveProfile={onMoveProfile ? () => onMoveProfile(vendor) : undefined}
          onEdit={onEditVendor ? () => onEditVendor(vendor) : undefined}
          onKeyDown={(e) => handleKeyDown(e, vendorId, vendor.parentId)}
        />

        {/* Expand / Collapse Chevron + Child Count Badge */}
        {hasChildren && (
          <div className="flex items-center shrink-0">
            {/* Horizontal connector from card to badge */}
            <div className="w-3.5 h-[1.5px] bg-slate-300" />

            {/* Caret Button */}
            <button
              type="button"
              onClick={() => toggleExpanded(vendorId)}
              className="z-10 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-2xs cursor-pointer select-none"
              title={`${isExpanded ? 'Collapse' : 'Expand'} ${children.length} team members`}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${vendor.name}'s ${children.length} team members`}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronLeft className="w-3 h-3 text-slate-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500" />
              )}
              <span>{children.length}</span>
            </button>

            {/* Orthogonal connector lines dropping into children */}
            {isExpanded && (
              <div className="flex items-center">
                {/* Connector from badge into children bus line */}
                <div className="w-3.5 h-[1.5px] bg-slate-300" />

                {/* Children Column */}
                <div className="flex flex-col py-2 relative">
                  {children.map((childId, index) => {
                    const isFirst = index === 0;
                    const isLast = index === children.length - 1;
                    const isSingle = children.length === 1;

                    return (
                      <div key={childId} className="flex items-center py-2.5 relative">
                        {/* Orthogonal vertical bus line connecting siblings */}
                        {!isSingle && (
                          <div
                            className={`absolute left-0 w-[1.5px] bg-slate-300 ${
                              isFirst
                                ? 'top-1/2 bottom-0'
                                : isLast
                                  ? 'top-0 bottom-1/2'
                                  : 'top-0 bottom-0'
                            }`}
                          />
                        )}

                        {/* Orthogonal horizontal branch line into child node */}
                        <div className="w-5 h-[1.5px] bg-slate-300" />

                        {/* Child branch */}
                        {renderBranch(childId)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
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
      className="w-full h-full overflow-auto p-8 bg-slate-50/60"
      role="tree"
      aria-label="Horizontal organization hierarchy tree"
    >
      <div className="w-max min-w-full flex items-center p-8 pr-64">
        {renderBranch(rootNode.id)}
      </div>
    </div>
  );
};
