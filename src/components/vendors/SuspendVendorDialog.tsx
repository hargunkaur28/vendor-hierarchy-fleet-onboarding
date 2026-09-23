import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X } from 'lucide-react';
import type { Vendor } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

interface SuspendVendorDialogProps {
  vendor: Vendor;
  isOpen: boolean;
  onClose: () => void;
}

export const SuspendVendorDialog: React.FC<SuspendVendorDialogProps> = ({
  vendor,
  isOpen,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const suspendVendor = useAppStore((s) => s.suspendVendor);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      toast.error('Suspension reason must be at least 5 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await suspendVendor(vendor.id, trimmed);
      toast.success(`Vendor "${vendor.name}" and subtree suspended.`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to suspend vendor.';
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
      aria-labelledby="suspend-dialog-title"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-rose-600">
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-100">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 id="suspend-dialog-title" className="text-base font-bold text-slate-900 tracking-tight">
                Suspend Sub-Vendor (F9)
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

        {/* Warning Banner */}
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              You are about to suspend <span className="underline">{vendor.name}</span> ({vendor.role}).
            </p>
            <p className="text-rose-700 leading-relaxed">
              Per Spec Section 8.4, suspending a vendor freezes their entire subtree. All sub-vendors, vehicles, and drivers under this account will immediately become non-operational.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="suspend-reason" className="text-xs font-semibold text-slate-700">
              Suspension Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="suspend-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Audit failure: multiple vehicles operating without valid insurance certificates..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-slate-800 resize-none"
              required
              minLength={5}
            />
            <p className="text-[10px] text-slate-400">
              Min 5 characters. This reason will be displayed on the suspended account banner.
            </p>
          </div>

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
              type="submit"
              disabled={isSubmitting || reason.trim().length < 5}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Suspending...' : 'Confirm Suspension'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
