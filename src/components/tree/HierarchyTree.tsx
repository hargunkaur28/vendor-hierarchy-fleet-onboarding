import React, { useMemo, useRef, useEffect } from 'react';
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

  const containerRef = useRef<HTMLDivElement>(null);

  // Center the root node horizontally when the tree initially renders or root changes
  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      }
    }
  }, [rootNode?.id]);

  // Auto-scroll first matched node into view centered on BOTH axes when search filters match
  useEffect(() => {
    if (hasFilter && matchIds.size > 0) {
      const firstMatchId = Array.from(matchIds)[0];
      if (firstMatchId) {
        const raf1 = requestAnimationFrame(() => {
          const raf2 = requestAnimationFrame(() => {
            const matchEl = document.getElementById(`node-${firstMatchId}`);
            const container = containerRef.current;
            if (matchEl && container) {
              const cardRect = matchEl.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();

              const targetScrollTop =
                container.scrollTop +
                (cardRect.top - containerRect.top) -
                container.clientHeight / 2 +
                cardRect.height / 2;

              const targetScrollLeft =
                container.scrollLeft +
                (cardRect.left - containerRect.left) -
                container.clientWidth / 2 +
                cardRect.width / 2;

              if (typeof container.scrollTo === 'function') {
                container.scrollTo({
                  top: Math.max(0, targetScrollTop),
                  left: Math.max(0, targetScrollLeft),
                  behavior: 'smooth',
                });
              } else {
                container.scrollTop = Math.max(0, targetScrollTop);
                container.scrollLeft = Math.max(0, targetScrollLeft);
              }
            }
          });
          return () => cancelAnimationFrame(raf2);
        });
        return () => cancelAnimationFrame(raf1);
      }
    }
  }, [hasFilter, matchIds]);

  // Keep DOM focus in sync with selectedVendorId when selection changes
  useEffect(() => {
    if (selectedVendorId) {
      const el = document.getElementById(`node-${selectedVendorId}`);
      if (el && document.activeElement !== el) {
        const isInputActive =
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA';
        if (!isInputActive) {
          el.focus();
        }
      }
    }
  }, [selectedVendorId]);

  // Keyboard navigation handler for tree nodes
  const handleNodeKeyDown = (
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
      const targetEl = document.getElementById(`node-${targetId}`);
      const container = containerRef.current;
      if (targetEl && container) {
        targetEl.focus();
        const cardRect = targetEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const isVerticallyOutside =
          cardRect.top < containerRect.top + 24 ||
          cardRect.bottom > containerRect.bottom - 24;
        const isHorizontallyOutside =
          cardRect.left < containerRect.left + 24 ||
          cardRect.right > containerRect.right - 24;

        if (isVerticallyOutside || isHorizontallyOutside) {
          const targetScrollTop =
            container.scrollTop +
            (cardRect.top - containerRect.top) -
            container.clientHeight / 2 +
            cardRect.height / 2;

          const targetScrollLeft =
            container.scrollLeft +
            (cardRect.left - containerRect.left) -
            container.clientWidth / 2 +
            cardRect.width / 2;

          if (typeof container.scrollTo === 'function') {
            container.scrollTo({
              top: Math.max(0, targetScrollTop),
              left: Math.max(0, targetScrollLeft),
              behavior: 'smooth',
            });
          } else {
            container.scrollTop = Math.max(0, targetScrollTop);
            container.scrollLeft = Math.max(0, targetScrollLeft);
          }
        }
      } else if (targetEl) {
        targetEl.focus();
      }
      setSelectedVendorId(targetId);
    };

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        // Down moves to child tier
        if (hasChildren) {
          if (!isExpanded) {
            toggleExpanded(vendorId);
          }
          if (children[0]) {
            focusNode(children[0]);
          }
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        // Up moves to parent tier
        if (parentId) {
          focusNode(parentId);
        }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        // If node has children and is collapsed, expand it
        if (hasChildren && !isExpanded) {
          toggleExpanded(vendorId);
        } else if (nextSiblingId) {
          // Move to next sibling if available
          focusNode(nextSiblingId);
        } else if (hasChildren && isExpanded && children[0]) {
          // If already expanded and no next sibling, move down to first child
          focusNode(children[0]);
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        // If node has children and is expanded, collapse it
        if (hasChildren && isExpanded) {
          toggleExpanded(vendorId);
        } else if (prevSiblingId) {
          // Move to previous sibling if available
          focusNode(prevSiblingId);
        } else if (parentId) {
          // Otherwise move to parent
          focusNode(parentId);
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
      ref={containerRef}
      className="w-full h-full overflow-auto p-8 bg-slate-50/60"
      role="tree"
      aria-label="Organization hierarchy tree"
    >
      <div className="w-max min-w-full flex flex-col items-center pt-6 pb-64 px-16">
        {renderBranch(rootNode.id)}
      </div>
    </div>
  );
};
