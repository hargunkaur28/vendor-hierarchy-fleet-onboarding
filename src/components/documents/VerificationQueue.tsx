import React, { useState } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Car,
  User,
  AlertCircle,
  FileText,
  Calendar,
} from 'lucide-react';
import type { DocumentRecord } from '@/types';
import { MIN_REJECTION_REASON_LENGTH } from '@/config/constants';
import { useAppStore } from '@/store/useAppStore';
import { selectSubtreeVehicles, selectSubtreeDrivers } from '@/store/selectors';
import { authorize } from '@/lib/permissions';
import { toast } from 'sonner';

interface PendingDocItem {
  entityType: 'VEHICLE' | 'DRIVER';
  entityId: string;
  entityName: string; // regNo or driver name
  ownerVendorId: string;
  ownerVendorName: string;
  document: DocumentRecord;
}

export const VerificationQueue: React.FC = () => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const delegationsById = useAppStore((s) => s.delegationsById);
  const reviewDocument = useAppStore((s) => s.reviewDocument);

  // Check VERIFY_DOCUMENTS permission
  const delegationsList = Object.values(delegationsById);
  const canVerify = authorize(
    { actorId: currentUserId, permission: 'VERIFY_DOCUMENTS', targetVendorId: currentUserId },
    vendorsById,
    delegationsList,
  ).allowed;

  // Rejection modal state
  const [rejectingItem, setRejectingItem] = useState<PendingDocItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Collect all PENDING documents in actor's subtree
  const vehicles = selectSubtreeVehicles(useAppStore.getState(), currentUserId);
  const drivers = selectSubtreeDrivers(useAppStore.getState(), currentUserId);

  const pendingItems: PendingDocItem[] = [];

  for (const v of vehicles) {
    const owner = vendorsById[v.ownerVendorId];
    for (const doc of v.documents) {
      if (doc.verification.status === 'PENDING') {
        pendingItems.push({
          entityType: 'VEHICLE',
          entityId: v.id,
          entityName: `${v.regNo} (${v.model})`,
          ownerVendorId: v.ownerVendorId,
          ownerVendorName: owner?.name || v.ownerVendorId,
          document: doc,
        });
      }
    }
  }

  for (const d of drivers) {
    const owner = vendorsById[d.ownerVendorId];
    for (const doc of d.documents) {
      if (doc.verification.status === 'PENDING') {
        pendingItems.push({
          entityType: 'DRIVER',
          entityId: d.id,
          entityName: `${d.name} (${d.phone})`,
          ownerVendorId: d.ownerVendorId,
          ownerVendorName: owner?.name || d.ownerVendorId,
          document: doc,
        });
      }
    }
  }

  const handleApprove = async (item: PendingDocItem) => {
    if (!canVerify) {
      toast.error("You don't have permission to verify documents.");
      return;
    }
    try {
      await reviewDocument({
        entityType: item.entityType,
        entityId: item.entityId,
        docId: item.document.id,
        status: 'APPROVED',
      });
      toast.success(
        `Approved ${item.document.type} document for ${item.entityName}.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to approve document.';
      toast.error(msg);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;

    if (rejectionReason.trim().length < MIN_REJECTION_REASON_LENGTH) {
      toast.error(
        `Rejection reason must be at least ${MIN_REJECTION_REASON_LENGTH} characters.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await reviewDocument({
        entityType: rejectingItem.entityType,
        entityId: rejectingItem.entityId,
        docId: rejectingItem.document.id,
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
      });
      toast.success(
        `Rejected ${rejectingItem.document.type} for ${rejectingItem.entityName}.`,
      );
      setRejectingItem(null);
      setRejectionReason('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reject document.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Permission alert if actor lacks VERIFY_DOCUMENTS */}
      {!canVerify && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold">Verification Actions Restricted</h4>
            <p className="mt-0.5">
              Your active role or delegation does not include the &ldquo;Verify Documents&rdquo; permission.
              Pending documents are shown for visibility, but Approve / Reject actions are disabled.
            </p>
          </div>
        </div>
      )}

      {/* Main Queue Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden min-w-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Document Verification Queue</span>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {pendingItems.length} Pending
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Review and certify compliance documents submitted by fleet operators in your subtree.
              </p>
            </div>
          </div>
        </div>

        {pendingItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">Queue is Clear</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are no pending documents requiring verification in your subtree right now.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]" aria-label="Pending Document Verification Queue">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/75">
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Owner Vendor</th>
                  <th className="py-3 px-4">Doc Type</th>
                  <th className="py-3 px-4">File Details</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pendingItems.map((item) => (
                  <tr key={item.document.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Entity */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {item.entityType === 'VEHICLE' ? (
                          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600" title="Vehicle">
                            <Car className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600" title="Driver">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="font-semibold text-slate-800">{item.entityName}</span>
                      </div>
                    </td>

                    {/* Owner Vendor */}
                    <td className="py-3 px-4 text-slate-600">
                      {item.ownerVendorName}
                    </td>

                    {/* Doc Type */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {item.document.type}
                      </span>
                    </td>

                    {/* File info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[140px]" title={item.document.fileName}>
                          {item.document.fileName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({(item.document.fileSize / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                    </td>

                    {/* Expiry Date */}
                    <td className="py-3 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.document.expiryDate.slice(0, 10)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApprove(item)}
                          disabled={!canVerify}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors select-none ${
                            canVerify
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          }`}
                          title={canVerify ? 'Approve document' : 'Requires VERIFY_DOCUMENTS'}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRejectingItem(item);
                            setRejectionReason('');
                          }}
                          disabled={!canVerify}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors select-none ${
                            canVerify
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 cursor-pointer'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                          }`}
                          title={canVerify ? 'Reject document with reason' : 'Requires VERIFY_DOCUMENTS'}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-doc-title"
        >
          <button
            type="button"
            className="fixed inset-0 bg-black/40 backdrop-blur-xs w-full h-full border-none cursor-default"
            onClick={() => setRejectingItem(null)}
            aria-label="Close dialog backdrop"
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 id="reject-doc-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Reject {rejectingItem.document.type} Document</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Provide a specific reason for rejecting the {rejectingItem.document.type} document submitted for &ldquo;{rejectingItem.entityName}&rdquo;.
              </p>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="rejection-reason-input" className="block text-xs font-semibold text-slate-700">
                  Rejection Reason <span className="text-rose-500">*</span> (min {MIN_REJECTION_REASON_LENGTH} characters)
                </label>
                <textarea
                  id="rejection-reason-input"
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Image is blurry / Expiry date mismatch / Document expired"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  required
                />
                <p className="text-[10px] text-slate-400">
                  {rejectionReason.trim().length} / {MIN_REJECTION_REASON_LENGTH} characters minimum
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectionReason.trim().length < MIN_REJECTION_REASON_LENGTH || isSubmitting}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer ${
                    rejectionReason.trim().length >= MIN_REJECTION_REASON_LENGTH && !isSubmitting
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-2xs'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
