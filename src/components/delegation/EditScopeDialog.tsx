import React, { useState, useMemo } from 'react';
import { X, CheckSquare, Square, Loader2, AlertCircle, Edit3 } from 'lucide-react';
import type { Delegation, PermissionKey } from '@/types';
import { ALL_PERMISSIONS, PERMISSION_CONFIG } from '@/config/permissions';
import { useAppStore } from '@/store/useAppStore';
import { getEffectivePermissions } from '@/lib/permissions';
import { toast } from 'sonner';

interface EditScopeDialogProps {
  delegation: Delegation | null;
  isOpen: boolean;
  onClose: () => void;
}

interface EditScopeDialogContentProps {
  delegation: Delegation;
  onClose: () => void;
}

const EditScopeDialogContent: React.FC<EditScopeDialogContentProps> = ({
  delegation,
  onClose,
}) => {
  const vendorsById = useAppStore((s) => s.vendorsById);
  const updateDelegationScope = useAppStore((s) => s.updateDelegationScope);

  const [selectedScope, setSelectedScope] = useState<PermissionKey[]>(delegation.scope);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delegatorEffectivePerms = useMemo(() => {
    return new Set(getEffectivePermissions(delegation.delegatorId, vendorsById));
  }, [delegation.delegatorId, vendorsById]);

  const delegate = vendorsById[delegation.delegateId];

  const handleTogglePerm = (perm: PermissionKey) => {
    if (!delegatorEffectivePerms.has(perm)) return;
    setSelectedScope((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScope.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await updateDelegationScope(delegation.id, selectedScope);
      toast.success(`Updated delegated scope for "${delegate?.name ?? 'delegate'}".`);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to update scope.';
      setError(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-scope-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs w-full h-full border-none cursor-default"
        onClick={onClose}
        aria-label="Close dialog backdrop"
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-indigo-600" />
            <h2 id="edit-scope-title" className="text-sm font-bold text-slate-900">
              Edit Scope for {delegate?.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Delegated Permissions ({selectedScope.length} selected)
            </label>

            <div className="space-y-1.5 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-lg bg-slate-50/50">
              {ALL_PERMISSIONS.map((perm) => {
                const isHeld = delegatorEffectivePerms.has(perm);
                const isChecked = selectedScope.includes(perm);

                return (
                  <button
                    type="button"
                    key={perm}
                    disabled={!isHeld || isSubmitting}
                    onClick={() => handleTogglePerm(perm)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer select-none ${
                      !isHeld
                        ? 'bg-slate-100/60 border-slate-200/60 opacity-50 cursor-not-allowed'
                        : isChecked
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{PERMISSION_CONFIG[perm].label}</span>
                    <div className="text-indigo-600">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 fill-indigo-600 text-white" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedScope.length === 0 || isSubmitting}
              className={`px-5 py-1.5 text-xs font-medium rounded-full flex items-center gap-1.5 ${
                selectedScope.length > 0 && !isSubmitting
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>Save Scope</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const EditScopeDialog: React.FC<EditScopeDialogProps> = ({
  delegation,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !delegation) return null;
  return <EditScopeDialogContent key={delegation.id} delegation={delegation} onClose={onClose} />;
};
