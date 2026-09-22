import React, { useState, useMemo } from 'react';
import { X, Info, AlertCircle, Loader2 } from 'lucide-react';
import type { Vendor, RoleKey } from '@/types';
import { ROLE_CONFIG, ROLE_KEYS, isRoleAllowedUnder } from '@/config/roles';
import { useAppStore } from '@/store/useAppStore';
import { getValidParents, getDescendantIds, wouldCreateCycle } from '@/lib/tree';
import { Combobox } from '@/components/ui/Combobox';
import type { ComboboxOption } from '@/components/ui/Combobox';
import { toast } from 'sonner';

interface MoveProfileModalProps {
  vendor: Vendor | null;
  isOpen: boolean;
  onClose: () => void;
  onMoveSuccess?: (vendorId: string, newParentId: string) => void;
}

interface MoveProfileModalContentProps {
  vendor: Vendor;
  onClose: () => void;
  onMoveSuccess?: (vendorId: string, newParentId: string) => void;
}

const MoveProfileModalContent: React.FC<MoveProfileModalContentProps> = ({
  vendor,
  onClose,
  onMoveSuccess,
}) => {
  const vendorsById = useAppStore((s) => s.vendorsById);
  const childrenIndex = useAppStore((s) => s.childrenIndex);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const moveVendor = useAppStore((s) => s.moveVendor);
  const changeRole = useAppStore((s) => s.changeRole);
  const setExpanded = useAppStore((s) => s.setExpanded);

  const [mode, setMode] = useState<'parent' | 'role'>('parent');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic role configuration
  const roleConfig = ROLE_CONFIG[vendor.role];
  const parentVendor = vendor.parentId ? vendorsById[vendor.parentId] : null;

  // Compute valid parents (defense in depth: excludes self, descendants, role-incompatible, suspended, out-of-scope)
  const validParents = useMemo(() => {
    if (!vendor) return [];
    return getValidParents(vendor, {
      actorId: currentUserId,
      byId: vendorsById,
      index: childrenIndex,
    });
  }, [vendor, currentUserId, vendorsById, childrenIndex]);

  // Map to ComboboxOption array
  const parentOptions: ComboboxOption[] = useMemo(() => {
    return validParents.map((id) => {
      const v = vendorsById[id]!;
      const count = (childrenIndex[id] || []).length;
      return {
        id: v.id,
        label: v.name,
        secondary: v.email,
        badge: count,
      };
    });
  }, [validParents, vendorsById, childrenIndex]);

  // Compute accurate descendant count for info banner (Section 14/F2)
  const descendants = useMemo(() => {
    if (!vendor) return [];
    return getDescendantIds(vendor.id, childrenIndex);
  }, [vendor, childrenIndex]);

  const selectedParent = selectedParentId ? vendorsById[selectedParentId] : null;

  // Change Role (F3): Find candidate roles and check for child conflicts
  const candidateRoles = useMemo(() => {
    if (!vendor) return [];
    return ROLE_KEYS.filter((r) => r !== 'ADMIN' && r !== vendor.role);
  }, [vendor]);

  const existingChildren = useMemo(() => {
    if (!vendor) return [];
    const childIds = childrenIndex[vendor.id] || [];
    return childIds.map((id) => vendorsById[id]!).filter(Boolean);
  }, [vendor, childrenIndex, vendorsById]);

  // Check if selected role conflicts with existing children
  const roleConflict = useMemo(() => {
    if (mode !== 'role' || !selectedRole) return null;

    // 1. Parent constraint
    if (parentVendor && !isRoleAllowedUnder(selectedRole, parentVendor.role)) {
      return {
        type: 'PARENT',
        message: `Role "${ROLE_CONFIG[selectedRole].label}" cannot be placed under parent "${parentVendor.name}" (${ROLE_CONFIG[parentVendor.role].label}).`,
      };
    }

    // 2. Child constraints
    const allowedChildren = ROLE_CONFIG[selectedRole].allowedChildRoles;
    const blocking = existingChildren.filter((c) => !allowedChildren.includes(c.role));
    if (blocking.length > 0) {
      const names = blocking.map((b) => `"${b.name}" (${ROLE_CONFIG[b.role].label})`).join(', ');
      return {
        type: 'CHILDREN',
        message: `Cannot change to ${ROLE_CONFIG[selectedRole].label}: child ${names} must be moved first (ROLE_CHANGE_CONFLICT).`,
      };
    }

    return null;
  }, [mode, selectedRole, parentVendor, existingChildren]);

  if (!roleConfig) return null;

  // Dynamic helper text for Screen 2
  const parentRoleLabel = roleConfig.parentRoleLabel || 'site admin';
  const helperText = `Move ${roleConfig.label.toLowerCase()} under a different ${parentRoleLabel}`;

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId || isSubmitting) return;

    // Defense in depth validation before API call
    if (wouldCreateCycle(vendor.id, selectedParentId, vendorsById)) {
      setErrorMessage('Cycle detected: cannot move a vendor under itself or its own descendants.');
      return;
    }

    const targetParent = vendorsById[selectedParentId];
    if (!targetParent || !isRoleAllowedUnder(vendor.role, targetParent.role)) {
      setErrorMessage(`Invalid parent role: ${roleConfig.label} cannot be placed under ${targetParent?.role ?? 'unknown'}.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const originalParentId = vendor.parentId;
    const vendorId = vendor.id;
    const targetParentId = selectedParentId;
    const targetParentName = targetParent.name;
    const vendorName = vendor.name;

    try {
      await moveVendor(vendorId, targetParentId);

      // Expand target parent in hierarchy tree
      setExpanded(targetParentId, true);

      // Close modal
      onClose();

      // Trigger 2s pulse highlight on moved node (Section 4A.9)
      onMoveSuccess?.(vendorId, targetParentId);

      // Show Undo toast for 5 seconds (Section 14/F2)
      toast.success(`"${vendorName}" moved under "${targetParentName}"`, {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: async () => {
            if (originalParentId) {
              try {
                await moveVendor(vendorId, originalParentId);
                toast.success(`Restored "${vendorName}" to original parent.`);
              } catch {
                toast.error(`Failed to undo move.`);
              }
            }
          },
        },
      });
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to move vendor profile.';
      setErrorMessage(msg);
    }
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || roleConflict || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await changeRole(vendor.id, selectedRole);
      onClose();
      toast.success(`Changed "${vendor.name}" role to ${ROLE_CONFIG[selectedRole].label}.`);
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to change vendor role.';
      setErrorMessage(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs w-full h-full border-none cursor-default"
        onClick={onClose}
        aria-label="Close dialog backdrop"
      />

      {/* Modal Container (Screen 2) */}
      <div className="relative w-full max-w-[480px] rounded-xl bg-white p-6 shadow-xl border border-slate-200 z-10 text-left">
        {/* Header: Title + Close (X) button */}
        <div className="flex items-center justify-between pb-3">
          <h3 id="move-modal-title" className="text-lg font-semibold text-slate-900 truncate">
            Move {vendor.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Radio selector: Change Parent / Change Role (Screen 2) */}
        <div className="flex items-center gap-6 mt-1 mb-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 select-none">
            <input
              type="radio"
              name="move-mode"
              value="parent"
              checked={mode === 'parent'}
              onChange={() => {
                setMode('parent');
                setErrorMessage(null);
              }}
              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <span>Change Parent</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 select-none">
            <input
              type="radio"
              name="move-mode"
              value="role"
              checked={mode === 'role'}
              onChange={() => {
                setMode('role');
                setErrorMessage(null);
              }}
              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <span>Change Role</span>
          </label>
        </div>

        {/* Inline Error Banner if operation failed or validation error */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Error occurred</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ─── Mode 1: Change Parent (Screen 2 & 3) ─── */}
        {mode === 'parent' ? (
          <form onSubmit={handleMoveSubmit} className="space-y-4">
            {/* Helper Text */}
            <p className="text-xs text-slate-500 -mt-2">
              {helperText}
            </p>

            {/* Combobox Dropdown Trigger & List */}
            <div className="space-y-1.5">
              <Combobox
                options={parentOptions}
                value={selectedParentId}
                onChange={(id) => {
                  setSelectedParentId(id);
                  setErrorMessage(null);
                }}
                placeholder={`Select ${parentRoleLabel.charAt(0).toUpperCase() + parentRoleLabel.slice(1)}`}
                searchPlaceholder="Search by name"
                emptyText={`No matching ${parentRoleLabel} found`}
                disabled={isSubmitting}
              />
            </div>

            {/* Info Banner (Screen 2: neutral gray #F5F5F7, accurate descendant count) */}
            <div className="p-3 rounded-lg bg-[#F5F5F7] border border-slate-200/60 flex items-start gap-3">
              <div className="p-0.5 rounded-full text-slate-500 shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {descendants.length > 0 ? (
                  <>
                    All{' '}
                    <span className="font-semibold text-slate-800">
                      {descendants.length}
                    </span>{' '}
                    sub-vendors and deployment associates under this{' '}
                    {roleConfig.label.toLowerCase()} will also be moved under the{' '}
                    {selectedParent ? (
                      <span className="font-medium text-slate-800">{selectedParent.name}</span>
                    ) : (
                      parentRoleLabel
                    )}
                    .
                  </>
                ) : (
                  <>No team members are under this {roleConfig.label.toLowerCase()}.</>
                )}
              </p>
            </div>

            {/* Footer Buttons (Screen 2: Cancel outlined pill, Move flat pill) */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-500/80 hover:bg-indigo-50/60 rounded-full transition-colors cursor-pointer select-none"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!selectedParentId || isSubmitting}
                className={`px-6 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-2 select-none ${
                  selectedParentId && !isSubmitting
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Move</span>
              </button>
            </div>
          </form>
        ) : (
          /* ─── Mode 2: Change Role (F3) ─── */
          <form onSubmit={handleRoleSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 -mt-2">
              Change role for <span className="font-semibold text-slate-700">{vendor.name}</span>
            </p>

            <div className="space-y-1.5">
              <label htmlFor="new-role-select" className="block text-xs font-medium text-slate-700">
                Select New Role
              </label>
              <select
                id="new-role-select"
                value={selectedRole || ''}
                onChange={(e) => {
                  setSelectedRole((e.target.value as RoleKey) || null);
                  setErrorMessage(null);
                }}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Choose Role --</option>
                {candidateRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_CONFIG[r].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Conflict Warning if children incompatible */}
            {roleConflict && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="leading-relaxed">{roleConflict.message}</p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-[#F5F5F7] border border-slate-200/60 text-xs text-slate-600 leading-relaxed">
              Changing role resets granted permissions to the new role&apos;s defaults, bounded by ancestor permissions.
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-500/80 hover:bg-indigo-50/60 rounded-full transition-colors cursor-pointer select-none"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!selectedRole || Boolean(roleConflict) || isSubmitting}
                className={`px-6 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-2 select-none ${
                  selectedRole && !roleConflict && !isSubmitting
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Change Role</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export const MoveProfileModal: React.FC<MoveProfileModalProps> = ({
  vendor,
  isOpen,
  onClose,
  onMoveSuccess,
}) => {
  if (!isOpen || !vendor) return null;
  return (
    <MoveProfileModalContent
      key={vendor.id}
      vendor={vendor}
      onClose={onClose}
      onMoveSuccess={onMoveSuccess}
    />
  );
};
