import React, { useState, useMemo } from 'react';
import {
  X,
  UserCheck,
  Search,
  UserX,
  AlertCircle,
  Car,
} from 'lucide-react';
import type { Vehicle, Driver } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { selectSubtreeDrivers } from '@/store/selectors';
import { isDriverCompliant, isVehicleCompliant } from '@/lib/compliance';
import { DocumentStatusChip } from '@/components/documents/DocumentStatusChip';
import { toast } from 'sonner';

interface AssignDriverDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
}

export const AssignDriverDialog: React.FC<AssignDriverDialogProps> = ({
  isOpen,
  onClose,
  vehicle,
}) => {
  const driversById = useAppStore((s) => s.driversById);
  const assignDriver = useAppStore((s) => s.assignDriver);
  const unassignDriver = useAppStore((s) => s.unassignDriver);

  const [search, setSearch] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isConfirmingUnassign, setIsConfirmingUnassign] = useState<boolean>(false);

  // Check vehicle compliance
  const vehicleCompliance = useMemo(() => isVehicleCompliant(vehicle), [vehicle]);
  const isVehicleAssignable = vehicleCompliance.compliant && !vehicle.blocked;

  const currentAssignedDriver = vehicle.assignedDriverId
    ? driversById[vehicle.assignedDriverId]
    : null;

  // Subtree drivers
  const subtreeDrivers = useMemo(() => {
    return selectSubtreeDrivers(useAppStore.getState(), vehicle.ownerVendorId);
  }, [vehicle.ownerVendorId]);

  // Filter available drivers matching search
  const availableDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subtreeDrivers.filter((d) => {
      // Must not be currently assigned to this vehicle
      if (d.id === vehicle.assignedDriverId) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        d.licenseNumber.toLowerCase().includes(q)
      );
    });
  }, [subtreeDrivers, vehicle.assignedDriverId, search]);

  if (!isOpen) return null;

  const handleAssign = async (driver: Driver) => {
    // Check driver compliance
    const { compliant, reasons } = isDriverCompliant(driver);
    if (!compliant) {
      toast.error(
        `Driver cannot be assigned: ${reasons.map((r) => r.detail).join(', ')}.`,
      );
      return;
    }

    // Check vehicle compliance
    if (!isVehicleAssignable) {
      toast.error(
        vehicle.blocked
          ? `Vehicle is blocked: ${vehicle.blocked.reason}`
          : `Vehicle is non-compliant: ${vehicleCompliance.reasons.map((r) => r.detail).join(', ')}.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await assignDriver(vehicle.id, driver.id);
      toast.success(`Driver "${driver.name}" assigned to vehicle "${vehicle.regNo}".`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to assign driver.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    setIsSubmitting(true);
    try {
      await unassignDriver(vehicle.id);
      toast.success(`Unassigned driver from vehicle "${vehicle.regNo}".`);
      setIsConfirmingUnassign(false);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to unassign driver.';
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
      aria-labelledby="assign-driver-title"
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
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="assign-driver-title" className="text-base font-bold text-slate-900 tracking-tight">
                Pair Driver with {vehicle.regNo}
              </h2>
              <p className="text-xs text-slate-500">
                {vehicle.model} ({vehicle.fuelType}) &bull; {vehicle.seatingCapacity} Seats
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

        {/* Vehicle Ineligibility Warning */}
        {!isVehicleAssignable && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <h4 className="font-bold">Vehicle Cannot Be Assigned to Any Driver</h4>
              <p className="mt-0.5">
                {vehicle.blocked
                  ? `Blocked: ${vehicle.blocked.reason}`
                  : `Non-compliant: ${vehicleCompliance.reasons.map((r) => r.detail).join(', ')}`}
              </p>
            </div>
          </div>
        )}

        {/* Current Assigned Driver block */}
        {currentAssignedDriver ? (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                {currentAssignedDriver.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Currently Assigned: {currentAssignedDriver.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  Phone: {currentAssignedDriver.phone} &bull; DL: {currentAssignedDriver.licenseNumber}
                </p>
              </div>
            </div>

            {isConfirmingUnassign ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUnassign}
                  disabled={isSubmitting}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-rose-600 text-white rounded-md hover:bg-rose-700 cursor-pointer"
                >
                  Confirm Unassign
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingUnassign(false)}
                  className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingUnassign(true)}
                className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Unassign</span>
              </button>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
            <Car className="w-4 h-4 text-slate-400" />
            <span>This vehicle does not currently have an assigned driver.</span>
          </div>
        )}

        {/* Search Input for Available Drivers */}
        <div className="space-y-1.5">
          <label htmlFor="driver-search-input" className="block text-xs font-semibold text-slate-700">
            Select Driver to Assign
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="driver-search-input"
              type="text"
              placeholder="Search driver by name, phone, or license..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Drivers List */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
          {availableDrivers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching drivers found in this subtree.
            </div>
          ) : (
            availableDrivers.map((driver) => {
              const driverComp = isDriverCompliant(driver);
              const isAssignedElsewhere = Boolean(driver.assignedVehicleId);
              const canAssignThisDriver =
                isVehicleAssignable && driverComp.compliant && !isAssignedElsewhere;

              return (
                <div
                  key={driver.id}
                  className="pt-2 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 truncate">
                        {driver.name}
                      </span>
                      <DocumentStatusChip
                        status={driverComp.compliant ? 'COMPLIANT' : 'NON_COMPLIANT'}
                        size="sm"
                      />
                      {isAssignedElsewhere && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                          Paired with another cab
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Phone: {driver.phone} &bull; DL: {driver.licenseNumber}
                    </p>
                    {!driverComp.compliant && (
                      <p className="text-[10px] text-rose-600 mt-0.5">
                        {driverComp.reasons.map((r) => r.detail).join(', ')}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAssign(driver)}
                    disabled={!canAssignThisDriver || isSubmitting}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0 transition-colors select-none ${
                      canAssignThisDriver
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs cursor-pointer'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    }`}
                    title={
                      !isVehicleAssignable
                        ? 'Vehicle is non-compliant or blocked'
                        : !driverComp.compliant
                          ? 'Driver DL is missing/expired/rejected'
                          : isAssignedElsewhere
                            ? 'Driver is already assigned to another vehicle'
                            : 'Assign to this vehicle'
                    }
                  >
                    <span>Assign</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
