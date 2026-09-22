import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Delegation } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

interface RevokeConfirmDialogProps {
  delegation: Delegation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RevokeConfirmDialog: React.FC<RevokeConfirmDialogProps> = ({
  delegation,
  isOpen,
  onClose,
}) => {
  const vendorsById = useAppStore((s) => s.vendorsById);
  const deleteDelegation = useAppStore((s) => s.deleteDelegation);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !delegation) return null;

  const delegate = vendorsById[delegation.delegateId];

  const handleRevoke = async () => {
    setIsSubmitting(true);
    try {
      await deleteDelegation(delegation.id);
      toast.success(`Revoked delegated authority from "${delegate?.name ?? 'delegate'}".`);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to revoke delegation.';
      toast.error(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-modal-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs w-full h-full border-none cursor-default"
        onClick={onClose}
        aria-label="Close dialog backdrop"
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 id="revoke-modal-title" className="text-base font-bold text-slate-900">
              Revoke Delegated Authority
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Are you sure you want to revoke authority from{' '}
              <span className="font-semibold text-slate-900">{delegate?.name}</span>?
              They will immediately lose access to act on your behalf. This action is logged in audit history.
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer select-none"
          >
            Keep Delegation
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer select-none"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Revoke Authority</span>
          </button>
        </div>
      </div>
    </div>
  );
};
