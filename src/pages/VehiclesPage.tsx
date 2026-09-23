import React, { useState, useMemo } from 'react';
import {
  Car,
  Plus,
  Search,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  Edit,
} from 'lucide-react';
import type { Vehicle, FuelType } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { selectSubtreeVendorIds } from '@/store/selectors';
import { authorize } from '@/lib/permissions';
import { isVehicleCompliant, getEffectiveVehicleStatus } from '@/lib/compliance';
import { canActorOverrideOrReactivate } from '@/lib/seniority';
import { DocumentStatusChip } from '@/components/documents/DocumentStatusChip';
import { DocumentHealthIcons } from '@/components/documents/DocumentHealthIcons';
import { VehicleFormDialog } from '@/components/fleet/VehicleFormDialog';
import { AssignDriverDialog } from '@/components/fleet/AssignDriverDialog';
import { VehicleBlockDialog } from '@/components/fleet/VehicleBlockDialog';
import { RoleBadge } from '@/components/common/RoleBadge';
import { toast } from 'sonner';

export const VehiclesPage: React.FC = () => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const delegationsById = useAppStore((s) => s.delegationsById);
  const driversById = useAppStore((s) => s.driversById);
  const vehiclesById = useAppStore((s) => s.vehiclesById);
  const toggleVehicleStatus = useAppStore((s) => s.toggleVehicleStatus);
  const unblockVehicle = useAppStore((s) => s.unblockVehicle);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [pairingVehicle, setPairingVehicle] = useState<Vehicle | null>(null);
  const [blockingVehicle, setBlockingVehicle] = useState<Vehicle | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPERATIONAL' | 'INACTIVE' | 'BLOCKED' | 'NON_COMPLIANT'>('ALL');
  const [fuelFilter, setFuelFilter] = useState<FuelType | 'ALL'>('ALL');

  // Permission checks
  const delegationsList = Object.values(delegationsById);
  const canOnboard = authorize(
    { actorId: currentUserId, permission: 'ONBOARD_FLEET', targetVendorId: currentUserId },
    vendorsById,
    delegationsList,
  ).allowed;

  // Retrieve subtree vehicles
  const allSubtreeVehicles = useMemo(() => {
    const vendorIds = new Set(selectSubtreeVendorIds(useAppStore.getState(), currentUserId));
    return Object.values(vehiclesById).filter((v) => vendorIds.has(v.ownerVendorId));
  }, [currentUserId, vehiclesById]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSubtreeVehicles.filter((v) => {
      // Search
      if (q) {
        const owner = vendorsById[v.ownerVendorId]?.name.toLowerCase() || '';
        const driver = v.assignedDriverId ? driversById[v.assignedDriverId]?.name.toLowerCase() || '' : '';
        const match =
          v.regNo.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          owner.includes(q) ||
          driver.includes(q);
        if (!match) return false;
      }

      // Fuel filter
      if (fuelFilter !== 'ALL' && v.fuelType !== fuelFilter) {
        return false;
      }

      // Operational status filter (derived live per Section 14 F7)
      if (statusFilter !== 'ALL') {
        const effectiveStatus = getEffectiveVehicleStatus(v);
        if (effectiveStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [allSubtreeVehicles, search, fuelFilter, statusFilter, vendorsById, driversById]);

  const handleToggleStatus = async (v: Vehicle) => {
    if (!canOnboard) {
      toast.error("You don't have permission to modify fleet status.");
      return;
    }

    if (v.blocked) {
      toast.error(`Vehicle is blocked: ${v.blocked.reason}. Unblock it first.`);
      return;
    }

    // Check compliance before activating
    if (v.status !== 'ACTIVE') {
      const { compliant, reasons } = isVehicleCompliant(v);
      if (!compliant) {
        toast.error(`Cannot activate: ${reasons.map((r) => r.detail).join(', ')}. Upload valid documents first.`);
        return;
      }
    }

    try {
      await toggleVehicleStatus(v.id);
      toast.success(`Vehicle "${v.regNo}" set to ${v.status === 'ACTIVE' ? 'Inactive' : 'Active'}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update vehicle status.';
      toast.error(msg);
    }
  };

  const handleUnblock = async (v: Vehicle) => {
    if (v.blocked?.byVendorId) {
      const seniority = canActorOverrideOrReactivate(currentUserId, v.blocked.byVendorId, vendorsById);
      if (!seniority.allowed) {
        toast.error(seniority.reason ?? 'Insufficient seniority to unblock vehicle.');
        return;
      }
    }

    try {
      await unblockVehicle(v.id);
      toast.success(`Vehicle "${v.regNo}" unblocked.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to unblock vehicle.';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Car className="w-5 h-5 text-indigo-600" />
            <span>Fleet & Vehicles (F6)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {allSubtreeVehicles.length} total
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage cabs, document verification compliance, and driver assignments across your fleet.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!canOnboard) {
              toast.error("You don't have permission to onboard vehicles.");
              return;
            }
            setIsAddOpen(true);
          }}
          disabled={!canOnboard}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors shadow-2xs select-none ${
            canOnboard
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
          title={canOnboard ? 'Onboard new vehicle' : 'Requires ONBOARD_FLEET permission'}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Vehicle</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by reg no, model, owner vendor, or driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <label htmlFor="filter-status" className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Status:
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPERATIONAL">Operational</option>
            <option value="INACTIVE">Inactive</option>
            <option value="NON_COMPLIANT">Non-Compliant</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>

        {/* Fuel Filter */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <label htmlFor="filter-fuel" className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Fuel:
          </label>
          <select
            id="filter-fuel"
            value={fuelFilter}
            onChange={(e) => setFuelFilter(e.target.value as typeof fuelFilter)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">All Fuel Types</option>
            <option value="PETROL">Petrol</option>
            <option value="DIESEL">Diesel</option>
            <option value="CNG">CNG</option>
            <option value="EV">Electric (EV)</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden min-w-0">
        {filteredVehicles.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Car className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No Vehicles Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {allSubtreeVehicles.length === 0
                ? 'No vehicles onboarded in this subtree yet.'
                : 'No vehicles match your active search and filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]" aria-label="Vehicles List">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/75">
                  <th className="py-3 px-4">Registration No.</th>
                  <th className="py-3 px-4">Model & Capacity</th>
                  <th className="py-3 px-4">Owner Sub-Vendor</th>
                  <th className="py-3 px-4">Assigned Driver</th>
                  <th className="py-3 px-4">Documents (F7)</th>
                  <th className="py-3 px-4">Operational Status</th>
                  <th className="py-3 px-4 text-center">Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVehicles.map((vehicle) => {
                  const owner = vendorsById[vehicle.ownerVendorId];
                  const driver = vehicle.assignedDriverId ? driversById[vehicle.assignedDriverId] : null;
                  const { compliant, reasons } = isVehicleCompliant(vehicle);
                  const effectiveStatus = getEffectiveVehicleStatus(vehicle);

                  // Toggle logic:
                  // - Deactivating (ACTIVE → INACTIVE): always allowed if has permission and not blocked
                  // - Activating (INACTIVE → ACTIVE): requires compliance
                  // - Non-compliant vehicles can NEVER be active — force toggle off visually
                  const isNonCompliantActive = !compliant && vehicle.status === 'ACTIVE';
                  const canDeactivate = canOnboard && !vehicle.blocked && vehicle.status === 'ACTIVE';
                  const canActivate = canOnboard && !vehicle.blocked && vehicle.status !== 'ACTIVE' && compliant;
                  const canToggle = canDeactivate || canActivate;

                  // Build specific tooltip reason per Section 15 error-handling
                  let toggleTooltip = '';
                  if (!canOnboard) {
                    toggleTooltip = 'Requires ONBOARD_FLEET permission';
                  } else if (vehicle.blocked) {
                    toggleTooltip = `Vehicle is blocked: ${vehicle.blocked.reason}`;
                  } else if (vehicle.status !== 'ACTIVE' && !compliant) {
                    toggleTooltip = `Cannot activate: ${reasons.map((r) => r.detail).join(', ')}`;
                  } else if (isNonCompliantActive) {
                    toggleTooltip = `Non-compliant — auto-deactivated: ${reasons.map((r) => r.detail).join(', ')}`;
                  } else {
                    toggleTooltip = vehicle.status === 'ACTIVE' ? 'Click to deactivate' : 'Click to activate';
                  }

                  // Visual state: non-compliant active vehicles show toggle as OFF
                  const toggleChecked = vehicle.status === 'ACTIVE' && compliant;

                  return (
                    <tr key={vehicle.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Reg No */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 tracking-tight">
                          {vehicle.regNo}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-medium">
                          {vehicle.fuelType}
                        </div>
                      </td>

                      {/* Model & Capacity */}
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-medium">{vehicle.model}</div>
                        <div className="text-[11px] text-slate-400">{vehicle.seatingCapacity} Seater</div>
                      </td>

                      {/* Owner Vendor */}
                      <td className="py-3 px-4">
                        {owner ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800">{owner.name}</span>
                            <RoleBadge role={owner.role} />
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unknown</span>
                        )}
                      </td>

                      {/* Assigned Driver */}
                      <td className="py-3 px-4">
                        {driver ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                              {driver.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 leading-tight">{driver.name}</div>
                              <div className="text-[10px] text-slate-400">{driver.phone}</div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPairingVehicle(vehicle)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors cursor-pointer"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Assign Driver</span>
                          </button>
                        )}
                      </td>

                      {/* Document Health Icons (RC, PERMIT, PUC, INSURANCE) */}
                      <td className="py-3 px-4">
                        <DocumentHealthIcons
                          documents={vehicle.documents}
                          onUploadClick={() => setEditingVehicle(vehicle)}
                        />
                      </td>

                      {/* Operational Status (Derived Live) */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <DocumentStatusChip status={effectiveStatus} size="sm" />
                          {!compliant && reasons.length > 0 && (
                            <p className="text-[10px] text-rose-600 max-w-[170px] truncate" title={reasons.map((r) => r.detail).join(', ')}>
                              {reasons.map((r) => r.detail).join(', ')}
                            </p>
                          )}
                          {vehicle.blocked && (
                            <p className="text-[10px] text-rose-700 font-medium truncate max-w-[170px]" title={vehicle.blocked.reason}>
                              {vehicle.blocked.reason}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Active Status Toggle */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center justify-center" title={toggleTooltip}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={toggleChecked}
                            disabled={!canToggle}
                            onClick={() => handleToggleStatus(vehicle)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                              !canToggle
                                ? 'opacity-40 cursor-not-allowed bg-slate-300'
                                : toggleChecked
                                  ? 'bg-emerald-600 cursor-pointer'
                                  : 'bg-slate-300 hover:bg-slate-400 cursor-pointer'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                toggleChecked ? 'translate-x-4.5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingVehicle(vehicle)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Edit Vehicle & Docs"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setPairingVehicle(vehicle)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Pair / Change Driver"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>

                          {vehicle.blocked ? (() => {
                            const unblockSeniority = vehicle.blocked.byVendorId
                              ? canActorOverrideOrReactivate(currentUserId, vehicle.blocked.byVendorId, vendorsById)
                              : { allowed: true };
                            return (
                              <button
                                type="button"
                                onClick={() => handleUnblock(vehicle)}
                                disabled={!unblockSeniority.allowed}
                                className={`p-1.5 rounded-md transition-colors ${
                                  unblockSeniority.allowed
                                    ? 'text-emerald-600 hover:bg-emerald-50 cursor-pointer'
                                    : 'text-slate-300 cursor-not-allowed opacity-50'
                                }`}
                                title={
                                  unblockSeniority.allowed
                                    ? 'Unblock Vehicle (Seniority Confirmed)'
                                    : unblockSeniority.reason ?? 'Insufficient seniority to unblock'
                                }
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>
                            );
                          })() : (
                            <button
                              type="button"
                              onClick={() => setBlockingVehicle(vehicle)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Block Vehicle (Super Vendor Action)"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Vehicle Modal */}
      {isAddOpen && (
        <VehicleFormDialog
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
        />
      )}

      {editingVehicle && (
        <VehicleFormDialog
          isOpen={Boolean(editingVehicle)}
          onClose={() => setEditingVehicle(null)}
          editingVehicle={editingVehicle}
        />
      )}

      {/* Assign Driver Dialog */}
      {pairingVehicle && (
        <AssignDriverDialog
          isOpen={Boolean(pairingVehicle)}
          onClose={() => setPairingVehicle(null)}
          vehicle={pairingVehicle}
        />
      )}

      {/* Block Vehicle Dialog */}
      {blockingVehicle && (
        <VehicleBlockDialog
          isOpen={Boolean(blockingVehicle)}
          onClose={() => setBlockingVehicle(null)}
          vehicle={blockingVehicle}
        />
      )}
    </div>
  );
};
