import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Car,
  Edit,
} from 'lucide-react';
import type { Driver } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { selectSubtreeVendorIds } from '@/store/selectors';
import { authorize } from '@/lib/permissions';
import { isDriverCompliant, getDocumentStatus } from '@/lib/compliance';
import { DocumentStatusChip } from '@/components/documents/DocumentStatusChip';
import { DriverFormDialog } from '@/components/drivers/DriverFormDialog';
import { RoleBadge } from '@/components/common/RoleBadge';
import { toast } from 'sonner';

export const DriversPage: React.FC = () => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const delegationsById = useAppStore((s) => s.delegationsById);
  const vehiclesById = useAppStore((s) => s.vehiclesById);
  const driversById = useAppStore((s) => s.driversById);
  const toggleDriverStatus = useAppStore((s) => s.toggleDriverStatus);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY'>('ALL');
  const [complianceFilter, setComplianceFilter] = useState<'ALL' | 'COMPLIANT' | 'NON_COMPLIANT'>('ALL');

  // Permission check
  const delegationsList = Object.values(delegationsById);
  const canOnboard = authorize(
    { actorId: currentUserId, permission: 'ONBOARD_DRIVERS', targetVendorId: currentUserId },
    vendorsById,
    delegationsList,
  ).allowed;

  // Subtree drivers
  const allSubtreeDrivers = useMemo(() => {
    const vendorIds = new Set(selectSubtreeVendorIds(useAppStore.getState(), currentUserId));
    return Object.values(driversById).filter((d) => vendorIds.has(d.ownerVendorId));
  }, [currentUserId, driversById]);

  // Filtered drivers
  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSubtreeDrivers.filter((driver) => {
      // Search
      if (q) {
        const owner = vendorsById[driver.ownerVendorId]?.name.toLowerCase() || '';
        const match =
          driver.name.toLowerCase().includes(q) ||
          driver.phone.includes(q) ||
          driver.licenseNumber.toLowerCase().includes(q) ||
          owner.includes(q);
        if (!match) return false;
      }

      // Availability filter
      if (availabilityFilter !== 'ALL' && driver.availability !== availabilityFilter) {
        return false;
      }

      // Compliance filter
      if (complianceFilter !== 'ALL') {
        const comp = isDriverCompliant(driver);
        if (complianceFilter === 'COMPLIANT' && !comp.compliant) return false;
        if (complianceFilter === 'NON_COMPLIANT' && comp.compliant) return false;
      }

      return true;
    });
  }, [allSubtreeDrivers, search, availabilityFilter, complianceFilter, vendorsById]);

  const handleToggleAvailability = async (driver: Driver) => {
    if (!canOnboard) {
      toast.error("You don't have permission to update driver status.");
      return;
    }

    try {
      await toggleDriverStatus(driver.id);
      const nextStatus = driver.availability === 'AVAILABLE' ? 'OFF_DUTY' : 'AVAILABLE';
      toast.success(`Driver "${driver.name}" availability changed to ${nextStatus}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update driver status.';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <span>Driver Management (F6)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {allSubtreeDrivers.length} drivers
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage driver profiles, driving license compliance verification, and vehicle pairings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!canOnboard) {
              toast.error("You don't have permission to onboard drivers.");
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
          title={canOnboard ? 'Onboard new driver' : 'Requires ONBOARD_DRIVERS permission'}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Driver</span>
        </button>
      </div>

      {/* Toolbar: Search and Filters */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search driver by name, phone, license, or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        {/* Availability Filter */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <label htmlFor="filter-avail" className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Status:
          </label>
          <select
            id="filter-avail"
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as typeof availabilityFilter)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">All Availability</option>
            <option value="AVAILABLE">Available</option>
            <option value="ON_TRIP">On Trip</option>
            <option value="OFF_DUTY">Off Duty</option>
          </select>
        </div>

        {/* Compliance Filter */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <label htmlFor="filter-comp" className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Compliance:
          </label>
          <select
            id="filter-comp"
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value as typeof complianceFilter)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium text-slate-700"
          >
            <option value="ALL">All Compliance</option>
            <option value="COMPLIANT">Compliant</option>
            <option value="NON_COMPLIANT">Non-Compliant</option>
          </select>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden min-w-0">
        {filteredDrivers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <UserCheck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No Drivers Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {allSubtreeDrivers.length === 0
                ? 'No drivers registered in this subtree yet.'
                : 'No drivers match your current search and filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]" aria-label="Drivers Table">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/75">
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Driving License (DL)</th>
                  <th className="py-3 px-4">Owner Vendor</th>
                  <th className="py-3 px-4">Assigned Vehicle</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4">Compliance Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDrivers.map((driver) => {
                  const owner = vendorsById[driver.ownerVendorId];
                  const vehicle = driver.assignedVehicleId ? vehiclesById[driver.assignedVehicleId] : null;
                  const dlDoc = driver.documents.find((d) => d.type === 'DL');
                  const dlStatus = dlDoc ? getDocumentStatus(dlDoc) : 'MISSING';
                  const compliance = isDriverCompliant(driver);

                  let availBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  if (driver.availability === 'ON_TRIP') {
                    availBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                  } else if (driver.availability === 'OFF_DUTY') {
                    availBadge = 'bg-slate-100 text-slate-600 border-slate-200';
                  }

                  return (
                    <tr key={driver.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Phone */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {driver.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 leading-tight">
                              {driver.name}
                            </div>
                            <div className="text-[11px] text-slate-400">{driver.phone}</div>
                          </div>
                        </div>
                      </td>

                      {/* License */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-medium text-slate-800">
                            {driver.licenseNumber}
                          </span>
                          <DocumentStatusChip status={dlStatus} size="xs" />
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {dlDoc ? `Exp: ${dlDoc.expiryDate.slice(0, 10)}` : 'No document uploaded'}
                        </div>
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

                      {/* Assigned Vehicle */}
                      <td className="py-3 px-4">
                        {vehicle ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Car className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold">{vehicle.regNo}</span>
                            <span className="text-[11px] text-slate-400">({vehicle.model})</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Availability */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(driver)}
                          disabled={!canOnboard}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full border transition-colors select-none ${availBadge} ${
                            canOnboard ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
                          }`}
                          title={canOnboard ? 'Click to toggle availability' : 'Availability status'}
                        >
                          {driver.availability.replace('_', ' ')}
                        </button>
                      </td>

                      {/* Compliance */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <DocumentStatusChip
                            status={compliance.compliant ? 'COMPLIANT' : 'NON_COMPLIANT'}
                            size="sm"
                          />
                          {!compliance.compliant && compliance.reasons.length > 0 && (
                            <p className="text-[10px] text-rose-600 truncate max-w-[150px]" title={compliance.reasons.map((r) => r.detail).join(', ')}>
                              {compliance.reasons.map((r) => r.detail).join(', ')}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingDriver(driver)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="Edit Driver & License"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Driver Modal */}
      {isAddOpen && (
        <DriverFormDialog
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
        />
      )}

      {editingDriver && (
        <DriverFormDialog
          isOpen={Boolean(editingDriver)}
          onClose={() => setEditingDriver(null)}
          editingDriver={editingDriver}
        />
      )}
    </div>
  );
};
