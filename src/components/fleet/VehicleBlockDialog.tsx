import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { Vehicle } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

interface VehicleBlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
}

export const VehicleBlockDialog: React.FC<VehicleBlockDialogProps> = ({
  isOpen,
  onClose,
  vehicle,
}) => {
  const blockVehicle = useAppStore((s) => s.blockVehicle);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await blockVehicle(vehicle.id, reason.trim());
      toast.success(`Vehicle "${vehicle.regNo}" has been blocked.`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to block vehicle.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-vehicle-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs w-full h-full border-none cursor-default"
        onClick={onClose}
        aria-label="Close dialog backdrop"
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div>
          <h3 id="block-vehicle-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>Block Vehicle ({vehicle.regNo})</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Blocking this vehicle immediately deactivates it and prevents trips until an admin unblocks it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="block-reason-input" className="block text-xs font-semibold text-slate-700">
              Reason for Block <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="block-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Safety audit pending, multiple speeding violations, or police report..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || isSubmitting}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer ${
                reason.trim() && !isSubmitting
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-2xs'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Blocking...' : 'Confirm Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
