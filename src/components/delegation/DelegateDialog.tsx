import React, { useState, useMemo } from 'react';
import { X, ShieldAlert, CheckSquare, Square, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import type { PermissionKey } from '@/types';
import { ALL_PERMISSIONS, PERMISSION_CONFIG } from '@/config/permissions';
import { ROLE_CONFIG } from '@/config/roles';
import { useAppStore } from '@/store/useAppStore';
import { getDescendantIds } from '@/lib/tree';
import { getEffectivePermissions } from '@/lib/permissions';
import { toast } from 'sonner';

interface DelegateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DelegateDialog: React.FC<DelegateDialogProps> = ({ isOpen, onClose }) => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const childrenIndex = useAppStore((s) => s.childrenIndex);
  const createDelegation = useAppStore((s) => s.createDelegation);

  const currentUser = vendorsById[currentUserId];
  const [selectedDelegateId, setSelectedDelegateId] = useState<string>('');
  const [selectedScope, setSelectedScope] = useState<PermissionKey[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delegator's effective permissions (ceiling for delegation scope)
  const delegatorEffectivePerms = useMemo(() => {
    return new Set(getEffectivePermissions(currentUserId, vendorsById));
  }, [currentUserId, vendorsById]);

  // Strict descendants eligible to be delegates (never self)
  const eligibleDelegates = useMemo(() => {
    const descendantIds = getDescendantIds(currentUserId, childrenIndex);
    return descendantIds
      .filter((id) => id !== currentUserId)
      .map((id) => vendorsById[id]!)
      .filter((v) => Boolean(v) && v.id !== currentUserId);
  }, [currentUserId, childrenIndex, vendorsById]);

  const selectedDelegate = selectedDelegateId ? vendorsById[selectedDelegateId] : null;

  const handleTogglePerm = (perm: PermissionKey) => {
    if (!delegatorEffectivePerms.has(perm)) return;
    setSelectedScope((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const handleDelegateEverything = () => {
    setSelectedScope(Array.from(delegatorEffectivePerms));
  };

  const handleClearScope = () => {
    setSelectedScope([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelegateId || selectedScope.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await createDelegation({
        delegatorId: currentUserId,
        delegateId: selectedDelegateId,
        scope: selectedScope,
      });

      toast.success(
        `Successfully delegated ${selectedScope.length} permissions to "${selectedDelegate?.name}".`,
      );
      onClose();
      // Reset form
      setSelectedDelegateId('');
      setSelectedScope([]);
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to create delegation.';
      setError(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delegate-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs w-full h-full border-none cursor-default"
        onClick={onClose}
        aria-label="Close dialog backdrop"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="delegate-modal-title" className="text-base font-bold text-slate-900 tracking-tight">
                Delegate Authority (F5)
              </h2>
              <p className="text-xs text-slate-500">
                Grant scoped authority from {currentUser?.name} to a team member in your subtree.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Delegate Target Picker */}
          <div className="space-y-1.5">
            <label htmlFor="delegate-select" className="block text-xs font-semibold text-slate-700">
              Select Delegate (Must be in your subtree)
            </label>
            {eligibleDelegates.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                You have no team members in your subtree to delegate to.
              </div>
            ) : (
              <select
                id="delegate-select"
                value={selectedDelegateId}
                onChange={(e) => setSelectedDelegateId(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Choose Delegate --</option>
                {eligibleDelegates.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({ROLE_CONFIG[v.role].label}) — {v.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Scope Checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Delegated Scope ({selectedScope.length} of {delegatorEffectivePerms.size} permitted selected)
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleDelegateEverything}
                  className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline cursor-pointer"
                >
                  Delegate everything
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleClearScope}
                  className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-lg bg-slate-50/50">
              {ALL_PERMISSIONS.map((perm) => {
                const isHeld = delegatorEffectivePerms.has(perm);
                const isChecked = selectedScope.includes(perm);

                return (
                  <button
                    type="button"
                    key={perm}
                    disabled={!isHeld || isSubmitting}
                    onClick={() => handleTogglePerm(perm)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-colors cursor-pointer select-none ${
                      !isHeld
                        ? 'bg-slate-100/60 border-slate-200/60 opacity-50 cursor-not-allowed'
                        : isChecked
                          ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 text-indigo-600">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 fill-indigo-600 text-white" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight">{PERMISSION_CONFIG[perm].label}</p>
                      <p className="text-[11px] text-slate-500 leading-normal mt-0.5 truncate">
                        {isHeld ? PERMISSION_CONFIG[perm].description : "You do not hold this permission"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Warning Banner (Spec F5) */}
          {selectedDelegate && (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-semibold">{selectedDelegate.name}</span> will be able to perform these actions in your name. All actions taken will be attributed to your authority in the audit log.
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer select-none"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!selectedDelegateId || selectedScope.length === 0 || isSubmitting}
              className={`px-6 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-2 select-none ${
                selectedDelegateId && selectedScope.length > 0 && !isSubmitting
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Delegation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
