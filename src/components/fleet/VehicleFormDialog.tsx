import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Car, AlertCircle, FileText } from 'lucide-react';
import type { Vehicle, FuelType, DocType } from '@/types';
import { REQUIRED_VEHICLE_DOCS } from '@/config/constants';
import { vehicleFormSchema, zodResolver } from '@/lib/validators';
import { useAppStore } from '@/store/useAppStore';
import { selectSubtreeVendorIds } from '@/store/selectors';
import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { toast } from 'sonner';

interface VehicleFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingVehicle?: Vehicle | null;
}

interface VehicleFormData {
  regNo: string;
  model: string;
  seatingCapacity: number;
  fuelType: FuelType;
  ownerVendorId: string;
}

const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'PETROL', label: 'Petrol' },
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'CNG', label: 'CNG' },
  { value: 'EV', label: 'Electric (EV)' },
  { value: 'HYBRID', label: 'Hybrid' },
];

export const VehicleFormDialog: React.FC<VehicleFormDialogProps> = ({
  isOpen,
  onClose,
  editingVehicle,
}) => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const createVehicle = useAppStore((s) => s.createVehicle);
  const updateVehicle = useAppStore((s) => s.updateVehicle);
  const uploadDocument = useAppStore((s) => s.uploadDocument);

  // Collect potential owner vendors in actor's subtree
  const descendantIds = selectSubtreeVendorIds(useAppStore.getState(), currentUserId);
  const eligibleOwners = descendantIds
    .map((id) => vendorsById[id]!)
    .filter((v) => Boolean(v) && v.status === 'ACTIVE');

  // Staged document uploads to commit on vehicle save
  const [stagedDocs, setStagedDocs] = useState<
    Record<
      DocType,
      {
        fileName: string;
        fileSize: number;
        mimeType: string;
        expiryDate: string;
      } | null
    >
  >({
    RC: null,
    PERMIT: null,
    PUC: null,
    INSURANCE: null,
    DL: null,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      regNo: editingVehicle?.regNo || '',
      model: editingVehicle?.model || '',
      seatingCapacity: editingVehicle?.seatingCapacity || 4,
      fuelType: editingVehicle?.fuelType || 'PETROL',
      ownerVendorId: editingVehicle?.ownerVendorId || currentUserId,
    },
  });

  if (!isOpen) return null;

  const handleDocumentSuccess = (
    docType: DocType,
    data: { fileName: string; fileSize: number; mimeType: string; expiryDate: string },
  ) => {
    setStagedDocs((prev) => ({ ...prev, [docType]: data }));
  };

  const onSubmit = async (data: VehicleFormData) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingVehicle) {
        // Update existing vehicle
        await updateVehicle(editingVehicle.id, {
          model: data.model,
          seatingCapacity: Number(data.seatingCapacity),
          fuelType: data.fuelType,
        });

        // Upload any newly attached documents
        for (const type of REQUIRED_VEHICLE_DOCS) {
          const staged = stagedDocs[type];
          if (staged) {
            await uploadDocument({
              entityType: 'VEHICLE',
              entityId: editingVehicle.id,
              type,
              fileName: staged.fileName,
              fileSize: staged.fileSize,
              mimeType: staged.mimeType,
              expiryDate: staged.expiryDate,
            });
          }
        }

        toast.success(`Vehicle "${editingVehicle.regNo}" updated successfully.`);
      } else {
        // Create new vehicle
        const newVehicle = await createVehicle({
          regNo: data.regNo,
          model: data.model,
          seatingCapacity: Number(data.seatingCapacity),
          fuelType: data.fuelType,
          ownerVendorId: data.ownerVendorId,
          status: 'INACTIVE', // default inactive until verified
          assignedDriverId: null,
        });

        // Upload staged documents for the new vehicle
        for (const type of REQUIRED_VEHICLE_DOCS) {
          const staged = stagedDocs[type];
          if (staged) {
            await uploadDocument({
              entityType: 'VEHICLE',
              entityId: newVehicle.id,
              type,
              fileName: staged.fileName,
              fileSize: staged.fileSize,
              mimeType: staged.mimeType,
              expiryDate: staged.expiryDate,
            });
          }
        }

        toast.success(`Vehicle "${newVehicle.regNo}" onboarded successfully.`);
      }

      reset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save vehicle.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehicle-dialog-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs w-full h-full border-none cursor-default"
        onClick={onClose}
        aria-label="Close dialog backdrop"
      />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 id="vehicle-dialog-title" className="text-base font-bold text-slate-900 tracking-tight">
                {editingVehicle ? `Edit Vehicle (${editingVehicle.regNo})` : 'Onboard New Vehicle (F6)'}
              </h2>
              <p className="text-xs text-slate-500">
                {editingVehicle
                  ? 'Update vehicle specifications and upload renewed compliance documents.'
                  : 'Enter vehicle registration details and upload mandatory compliance documents.'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Registration Number */}
            <div className="space-y-1">
              <label htmlFor="regNo" className="block text-xs font-semibold text-slate-700">
                Registration Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="regNo"
                type="text"
                placeholder="e.g. KA01AB1234"
                disabled={Boolean(editingVehicle) || isSubmitting}
                {...register('regNo')}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:border-indigo-500 uppercase ${
                  errors.regNo ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                } ${editingVehicle ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
              />
              {errors.regNo && (
                <p className="text-[10px] text-rose-600 font-medium">{errors.regNo.message}</p>
              )}
            </div>

            {/* Model Name */}
            <div className="space-y-1">
              <label htmlFor="model" className="block text-xs font-semibold text-slate-700">
                Vehicle Model <span className="text-rose-500">*</span>
              </label>
              <input
                id="model"
                type="text"
                placeholder="e.g. Swift Dzire / Toyota Etios"
                disabled={isSubmitting}
                {...register('model')}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:border-indigo-500 ${
                  errors.model ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                }`}
              />
              {errors.model && (
                <p className="text-[10px] text-rose-600 font-medium">{errors.model.message}</p>
              )}
            </div>

            {/* Seating Capacity */}
            <div className="space-y-1">
              <label htmlFor="seatingCapacity" className="block text-xs font-semibold text-slate-700">
                Seating Capacity <span className="text-rose-500">*</span>
              </label>
              <input
                id="seatingCapacity"
                type="number"
                min={2}
                max={60}
                disabled={isSubmitting}
                {...register('seatingCapacity', { valueAsNumber: true })}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:border-indigo-500 ${
                  errors.seatingCapacity ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                }`}
              />
              {errors.seatingCapacity && (
                <p className="text-[10px] text-rose-600 font-medium">
                  {errors.seatingCapacity.message}
                </p>
              )}
            </div>

            {/* Fuel Type */}
            <div className="space-y-1">
              <label htmlFor="fuelType" className="block text-xs font-semibold text-slate-700">
                Fuel Type <span className="text-rose-500">*</span>
              </label>
              <select
                id="fuelType"
                disabled={isSubmitting}
                {...register('fuelType')}
                className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:border-indigo-500 ${
                  errors.fuelType ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                }`}
              >
                {FUEL_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {ft.label}
                  </option>
                ))}
              </select>
              {errors.fuelType && (
                <p className="text-[10px] text-rose-600 font-medium">{errors.fuelType.message}</p>
              )}
            </div>
          </div>

          {/* Owner Vendor */}
          <div className="space-y-1">
            <label htmlFor="ownerVendorId" className="block text-xs font-semibold text-slate-700">
              Affiliated Sub-Vendor Owner <span className="text-rose-500">*</span>
            </label>
            <select
              id="ownerVendorId"
              disabled={Boolean(editingVehicle) || isSubmitting}
              {...register('ownerVendorId')}
              className={`w-full px-3 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:border-indigo-500 ${
                errors.ownerVendorId ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
              } ${editingVehicle ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
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

          {/* Embedded Document Uploaders (RC, PERMIT, PUC, INSURANCE) */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Required Compliance Documents (F7)</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  RC, Permit, PUC, and Insurance are required for operational certification.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REQUIRED_VEHICLE_DOCS.map((docType) => {
                const existingDoc = editingVehicle?.documents.find((d) => d.type === docType);
                return (
                  <DocumentUploader
                    key={docType}
                    docType={docType}
                    label={`${docType} Certificate`}
                    initialExpiry={existingDoc?.expiryDate?.slice(0, 10) || ''}
                    initialFileName={existingDoc?.fileName || ''}
                    onUploadSuccess={(data) => handleDocumentSuccess(docType, data)}
                    disabled={isSubmitting}
                  />
                );
              })}
            </div>
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
              {isSubmitting ? 'Saving Vehicle...' : editingVehicle ? 'Update Vehicle' : 'Save & Onboard Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
