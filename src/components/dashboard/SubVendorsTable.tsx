import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  ArrowUpDown,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { SubVendorRowMetric } from '@/lib/dashboard';
import type { Vendor } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { RoleBadge } from '@/components/common/RoleBadge';
import { SuspendVendorDialog } from '@/components/vendors/SuspendVendorDialog';
import { ReactivateVendorDialog } from '@/components/vendors/ReactivateVendorDialog';

interface SubVendorsTableProps {
  subVendors: SubVendorRowMetric[];
}

type SortField = 'name' | 'vehicles' | 'compliance' | 'risk';

export const SubVendorsTable: React.FC<SubVendorsTableProps> = ({ subVendors }) => {
  const switchUser = useAppStore((s) => s.switchUser);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Dialog states for overrides
  const [suspendingVendor, setSuspendingVendor] = useState<Vendor | null>(null);
  const [reactivatingVendor, setReactivatingVendor] = useState<Vendor | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = subVendors.filter((row) => {
      if (!q) return true;
      return (
        row.vendor.name.toLowerCase().includes(q) ||
        row.vendor.email.toLowerCase().includes(q) ||
        row.vendor.role.toLowerCase().includes(q)
      );
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.vendor.name.localeCompare(b.vendor.name);
          break;
        case 'vehicles':
          cmp = a.totalVehicles - b.totalVehicles;
          break;
        case 'compliance':
          cmp = a.complianceRate - b.complianceRate;
          break;
        case 'risk': {
          const rank = { HIGH_RISK: 3, MEDIUM_RISK: 2, CLEAN: 1 };
          cmp = rank[b.riskLevel] - rank[a.riskLevel];
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [subVendors, search, sortField, sortAsc]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden min-w-0">
      {/* Table Header & Search Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 min-w-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Direct Sub-Vendors</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                {subVendors.length} total
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Fleet breakdown, compliance health, and override actions for your direct reporting vendors.
            </p>
          </div>
        </div>

        {/* Scroll indicator & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs whitespace-nowrap">
            <span>Scroll table</span>
            <span aria-hidden="true">&rarr;</span>
          </span>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search sub-vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredAndSorted.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400">
          {subVendors.length === 0
            ? 'No direct sub-vendors in this subtree yet.'
            : 'No sub-vendors match your search filter.'}
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto min-w-0 w-full table-scroll-container">
            <table className="w-full text-left border-collapse min-w-[960px]" aria-label="Sub-Vendors Table">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/75">
                  <th className="py-3 px-4 whitespace-nowrap min-w-[190px]">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-slate-700 cursor-pointer"
                    >
                      <span>Vendor</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[90px]">Status</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap min-w-[130px]">
                    <button
                      type="button"
                      onClick={() => handleSort('vehicles')}
                      className="inline-flex items-center gap-1 hover:text-slate-700 cursor-pointer"
                    >
                      <span>Fleet (Active/Tot)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-center whitespace-nowrap min-w-[110px]">Drivers Avail.</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap min-w-[110px]">Pending Docs</th>
                  <th className="py-3 px-4 whitespace-nowrap min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => handleSort('compliance')}
                      className="inline-flex items-center gap-1 hover:text-slate-700 cursor-pointer"
                    >
                      <span>Compliance %</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-center whitespace-nowrap min-w-[130px]">
                    <button
                      type="button"
                      onClick={() => handleSort('risk')}
                      className="inline-flex items-center gap-1 hover:text-slate-700 cursor-pointer"
                    >
                      <span className="whitespace-nowrap">Risk Level</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right whitespace-nowrap min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAndSorted.map((row) => {
                  const isSuspended = row.vendor.status === 'SUSPENDED';

                  return (
                    <tr key={row.vendor.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Role */}
                      <td className="py-3 px-4 whitespace-nowrap min-w-[190px]">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-bold text-slate-900 tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                              <span>{row.vendor.name}</span>
                              <RoleBadge role={row.vendor.role} />
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {row.vendor.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap min-w-[90px]">
                        {isSuspended ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Fleet */}
                      <td className="py-3 px-4 text-center whitespace-nowrap min-w-[130px]">
                        <span className="font-semibold text-slate-800">
                          {row.activeVehicles}
                        </span>
                        <span className="text-slate-400"> / {row.totalVehicles}</span>
                      </td>

                      {/* Available Drivers */}
                      <td className="py-3 px-4 text-center whitespace-nowrap min-w-[110px]">
                        <span className="font-semibold text-emerald-600">
                          {row.availableDrivers}
                        </span>
                        <span className="text-slate-400"> / {row.totalDrivers}</span>
                      </td>

                      {/* Pending Docs */}
                      <td className="py-3 px-4 text-center whitespace-nowrap min-w-[110px]">
                        {row.pendingDocsCount > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                            {row.pendingDocsCount}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>

                      {/* Compliance Progress Bar */}
                      <td className="py-3 px-4 whitespace-nowrap min-w-[140px]">
                        <div className="space-y-1 min-w-[120px]">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                            <span>{row.complianceRate}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                row.complianceRate >= 90
                                  ? 'bg-emerald-500'
                                  : row.complianceRate >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                              }`}
                              style={{ width: `${row.complianceRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Risk Badge */}
                      <td className="py-3 px-4 text-center whitespace-nowrap min-w-[130px]">
                        {row.riskLevel === 'HIGH_RISK' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                            High Risk
                          </span>
                        ) : row.riskLevel === 'MEDIUM_RISK' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                            Medium Risk
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                            Clean
                          </span>
                        )}
                      </td>

                      {/* Actions: View As & Suspend/Reactivate */}
                      <td className="py-3 px-4 text-right whitespace-nowrap min-w-[140px]">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => switchUser(row.vendor.id)}
                            className="px-2.5 py-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            title={`Switch view to ${row.vendor.name}`}
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="whitespace-nowrap">View As</span>
                          </button>

                          {isSuspended ? (
                            <button
                              type="button"
                              onClick={() => setReactivatingVendor(row.vendor)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors shrink-0 cursor-pointer"
                              title="Reactivate Vendor (F9 Override)"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSuspendingVendor(row.vendor)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shrink-0 cursor-pointer"
                              title="Suspend Sub-Vendor (F9 Override)"
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

          {/* Table Footer with metrics count and scroll hint */}
          <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 min-w-0">
            <span>Showing {filteredAndSorted.length} of {subVendors.length} reporting vendors</span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-flex items-center gap-1">
              <span>Scroll horizontally for full metrics</span>
              <span aria-hidden="true">&rarr;</span>
            </span>
          </div>
        </div>
      )}

      {/* Suspend Vendor Override Dialog */}
      {suspendingVendor && (
        <SuspendVendorDialog
          vendor={suspendingVendor}
          isOpen={Boolean(suspendingVendor)}
          onClose={() => setSuspendingVendor(null)}
        />
      )}

      {/* Reactivate Vendor Override Dialog */}
      {reactivatingVendor && (
        <ReactivateVendorDialog
          vendor={reactivatingVendor}
          isOpen={Boolean(reactivatingVendor)}
          onClose={() => setReactivatingVendor(null)}
        />
      )}
    </div>
  );
};
