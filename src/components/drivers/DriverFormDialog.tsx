import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, UserPlus, AlertCircle, FileText } from 'lucide-react';
import type { Driver } from '@/types';
import { driverFormSchema, zodResolver } from '@/lib/validators';
import { useAppStore } from '@/store/useAppStore';
import { selectSubtreeVendorIds } from '@/store/selectors';
import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { toast } from 'sonner';

interface DriverFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingDriver?: Driver | null;
}

interface DriverFormData {
  name: string;
  phone: string;
  licenseNumber: string;
  ownerVendorId: string;
}

export const DriverFormDialog: React.FC<DriverFormDialogProps> = ({
  isOpen,
  onClose,
  editingDriver,
}) => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const createDriver = useAppStore((s) => s.createDriver);
  const updateDriver = useAppStore((s) => s.updateDriver);
  const uploadDocument = useAppStore((s) => s.uploadDocument);

  // Eligible owner vendors in subtree
  const descendantIds = selectSubtreeVendorIds(useAppStore.getState(), currentUserId);
  const eligibleOwners = descendantIds
    .map((id) => vendorsById[id]!)
    .filter((v) => Boolean(v) && v.status === 'ACTIVE');

  const [stagedDl, setStagedDl] = useState<{
    fileName: string;
    fileSize: number;
    mimeType: string;
    expiryDate: string;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DriverFormData>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: editingDriver?.name || '',
      phone: editingDriver?.phone || '',
      licenseNumber: editingDriver?.licenseNumber || '',
      ownerVendorId: editingDriver?.ownerVendorId || currentUserId,
    },
  });

  if (!isOpen) return null;

  const handleDlSuccess = (data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    expiryDate: string;
  }) => {
    setStagedDl(data);
  };

  const onSubmit = async (data: DriverFormData) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingDriver) {
        // Update driver
        await updateDriver(editingDriver.id, {
          name: data.name,
          phone: data.phone,
          licenseNumber: data.licenseNumber,
        });

        // Upload new DL if attached
        if (stagedDl) {
          await uploadDocument({
            entityType: 'DRIVER',
            entityId: editingDriver.id,
            type: 'DL',
            fileName: stagedDl.fileName,
            fileSize: stagedDl.fileSize,
            mimeType: stagedDl.mimeType,
            expiryDate: stagedDl.expiryDate,
          });
        }

        toast.success(`Driver "${editingDriver.name}" updated successfully.`);
      } else {
        // Create new driver
        const newDriver = await createDriver({
          name: data.name,
          phone: data.phone,
          licenseNumber: data.licenseNumber,
          ownerVendorId: data.ownerVendorId,
          availability: 'AVAILABLE',
          assignedVehicleId: null,
        });

        // Upload DL if attached
        if (stagedDl) {
          await uploadDocument({
            entityType: 'DRIVER',
            entityId: newDriver.id,
            type: 'DL',
            fileName: stagedDl.fileName,
            fileSize: stagedDl.fileSize,
            mimeType: stagedDl.mimeType,
            expiryDate: stagedDl.expiryDate,
          });
        }

        toast.success(`Driver "${newDriver.name}" onboarded successfully.`);
      }

      reset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save driver.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const existingDl = editingDriver?.documents.find((d) => d.type === 'DL');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-dialog-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs w-full h-full border-none cursor-default"
        onClick={onClose}
        aria-label="Close dialog backdrop"
      />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="driver-dialog-title" className="text-base font-bold text-slate-900 tracking-tight">
                {editingDriver ? `Edit Driver (${editingDriver.name})` : 'Onboard New Driver (F6)'}
              </h2>
              <p className="text-xs text-slate-500">
                Register driver credentials and upload Driving License (DL) for compliance verification.
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

        {formError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <p>{formError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Driver Name */}
          <div className="space-y-1">
            <label htmlFor="driver-name" className="block text-xs font-semibold text-slate-700">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="driver-name"
              type="text"
              placeholder="e.g. Rajesh Kumar"
              disabled={isSubmitting}
              {...register('name')}
              className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:border-indigo-500 ${
                errors.name ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
              }`}
            />
            {errors.name && (
              <p className="text-[10px] text-rose-600 font-medium">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone */}
            <div className="space-y-1">
              <label htmlFor="driver-phone" className="block text-xs font-semibold text-slate-700">
                Mobile Phone <span className="text-rose-500">*</span>
              </label>
              <input
                id="driver-phone"
                type="text"
                placeholder="10-digit mobile, e.g. 9876543210"
                disabled={isSubmitting}
                {...register('phone')}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:border-indigo-500 ${
                  errors.phone ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                }`}
              />
              {errors.phone && (
                <p className="text-[10px] text-rose-600 font-medium">{errors.phone.message}</p>
              )}
            </div>

            {/* License Number */}
            <div className="space-y-1">
              <label htmlFor="driver-license" className="block text-xs font-semibold text-slate-700">
                Driving License (DL) No. <span className="text-rose-500">*</span>
              </label>
              <input
                id="driver-license"
                type="text"
                placeholder="e.g. DL1420240000001"
                disabled={isSubmitting}
                {...register('licenseNumber')}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:border-indigo-500 uppercase ${
                  errors.licenseNumber ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                }`}
              />
              {errors.licenseNumber && (
                <p className="text-[10px] text-rose-600 font-medium">
                  {errors.licenseNumber.message}
                </p>
              )}
            </div>
          </div>

          {/* Owner Vendor */}
          <div className="space-y-1">
            <label htmlFor="driver-owner" className="block text-xs font-semibold text-slate-700">
              Affiliated Sub-Vendor <span className="text-rose-500">*</span>
            </label>
            <select
              id="driver-owner"
              disabled={Boolean(editingDriver) || isSubmitting}
              {...register('ownerVendorId')}
              className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:border-indigo-500 ${
                errors.ownerVendorId ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
              } ${editingDriver ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
            >
              {eligibleOwners.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.role}) — {v.email}
                </option>
              ))}
            </select>
            {errors.ownerVendorId && (
              <p className="text-[10px] text-rose-600 font-medium">
                {errors.ownerVendorId.message}
              </p>
            )}
          </div>

          {/* DL Document Upload Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Driving License Document (F7)</span>
            </h4>
            <DocumentUploader
              docType="DL"
              label="Driving License (DL) Certificate"
              initialExpiry={existingDl?.expiryDate?.slice(0, 10) || ''}
              initialFileName={existingDl?.fileName || ''}
              onUploadSuccess={handleDlSuccess}
              disabled={isSubmitting}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving Driver...' : editingDriver ? 'Update Driver' : 'Save & Onboard Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
