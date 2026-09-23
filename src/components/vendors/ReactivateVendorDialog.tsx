import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, X } from 'lucide-react';
import type { Vendor } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { canActorOverrideOrReactivate } from '@/lib/seniority';
import { toast } from 'sonner';

interface ReactivateVendorDialogProps {
  vendor: Vendor;
  isOpen: boolean;
  onClose: () => void;
}

export const ReactivateVendorDialog: React.FC<ReactivateVendorDialogProps> = ({
  vendor,
  isOpen,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const reactivateVendor = useAppStore((s) => s.reactivateVendor);

  if (!isOpen) return null;

  const suspenderId = vendor.suspendedBy?.vendorId;
  const suspender = suspenderId ? vendorsById[suspenderId] : undefined;

  // Seniority check per Section 8.4: only original suspender or more senior ancestor can reactivate
  const seniority = suspenderId
    ? canActorOverrideOrReactivate(currentUserId, suspenderId, vendorsById)
    : { allowed: true };

  const handleReactivate = async () => {
    if (!seniority.allowed) {
      toast.error(seniority.reason ?? 'Insufficient seniority to reactivate vendor.');
      return;
    }

    setIsSubmitting(true);
    try {
      await reactivateVendor(vendor.id);
      toast.success(`Vendor "${vendor.name}" and subtree reactivated.`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reactivate vendor.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reactivate-dialog-title"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-600">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 id="reactivate-dialog-title" className="text-base font-bold text-slate-900 tracking-tight">
                Reactivate Sub-Vendor (F9)
              </h3>
              <p className="text-xs text-slate-400">Super Vendor Override Control</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Suspension Info */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span className="font-semibold text-slate-700">Vendor:</span>
            <span>{vendor.name} ({vendor.role})</span>
          </div>
          {suspender && (
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-semibold text-slate-700">Suspended By:</span>
              <span>{suspender.name} ({suspender.role})</span>
            </div>
          )}
          {vendor.suspendedBy?.reason && (
            <div className="pt-1 border-t border-slate-200/60 text-slate-600">
              <span className="font-semibold text-slate-700">Reason:</span>
              <p className="mt-0.5 text-slate-500 italic bg-white p-2 rounded border border-slate-200">
                &ldquo;{vendor.suspendedBy.reason}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Seniority warning if not allowed */}
        {!seniority.allowed && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Reactivation Restricted</p>
              <p className="text-amber-700 leading-relaxed">{seniority.reason}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || !seniority.allowed}
            onClick={handleReactivate}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={seniority.reason}
          >
            {isSubmitting ? 'Reactivating...' : 'Confirm Reactivation'}
          </button>
        </div>
      </div>
    </div>
  );
};
