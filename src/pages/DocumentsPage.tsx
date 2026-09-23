import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileCheck2,
  FileText,
  Search,
  Car,
  User,
  Clock,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type { DocType, DocumentStatus, DocumentRecord } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { selectSubtreeVendorIds } from '@/store/selectors';
import { getDocumentStatus } from '@/lib/compliance';
import { DocumentStatusChip } from '@/components/documents/DocumentStatusChip';
import { VerificationQueue } from '@/components/documents/VerificationQueue';

export const DocumentsPage: React.FC = () => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const vehiclesById = useAppStore((s) => s.vehiclesById);
  const driversById = useAppStore((s) => s.driversById);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: 'queue' | 'all' | 'expiries' =
    tabParam === 'expiries' || tabParam === 'all' || tabParam === 'queue'
      ? tabParam
      : 'queue';

  const setActiveTab = (tab: 'queue' | 'all' | 'expiries') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'queue') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    });
  };

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'ALL'>('ALL');

  // Subtree data
  const vehicles = useMemo(() => {
    const vendorIds = new Set(selectSubtreeVendorIds(useAppStore.getState(), currentUserId));
    return Object.values(vehiclesById).filter((v) => vendorIds.has(v.ownerVendorId));
  }, [currentUserId, vehiclesById]);

  const drivers = useMemo(() => {
    const vendorIds = new Set(selectSubtreeVendorIds(useAppStore.getState(), currentUserId));
    return Object.values(driversById).filter((d) => vendorIds.has(d.ownerVendorId));
  }, [currentUserId, driversById]);

  // Aggregate all documents
  interface DocSummaryItem {
    id: string;
    entityType: 'VEHICLE' | 'DRIVER';
    entityName: string;
    ownerVendorName: string;
    type: DocType;
    document: DocumentRecord;
    status: DocumentStatus;
  }

  const allDocuments = useMemo(() => {
    const list: DocSummaryItem[] = [];

    for (const v of vehicles) {
      const owner = vendorsById[v.ownerVendorId]?.name || v.ownerVendorId;
      for (const d of v.documents) {
        list.push({
          id: d.id,
          entityType: 'VEHICLE',
          entityName: `${v.regNo} (${v.model})`,
          ownerVendorName: owner,
          type: d.type,
          document: d,
          status: getDocumentStatus(d),
        });
      }
    }

    for (const d of drivers) {
      const owner = vendorsById[d.ownerVendorId]?.name || d.ownerVendorId;
      for (const doc of d.documents) {
        list.push({
          id: doc.id,
          entityType: 'DRIVER',
          entityName: `${d.name} (${d.phone})`,
          ownerVendorName: owner,
          type: doc.type,
          document: doc,
          status: getDocumentStatus(doc),
        });
      }
    }

    return list;
  }, [vehicles, drivers, vendorsById]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allDocuments.filter((item) => {
      if (q) {
        const match =
          item.entityName.toLowerCase().includes(q) ||
          item.ownerVendorName.toLowerCase().includes(q) ||
          item.document.fileName.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (typeFilter !== 'ALL' && item.type !== typeFilter) {
        return false;
      }

      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [allDocuments, search, typeFilter, statusFilter]);

  const pendingCount = allDocuments.filter((d) => d.status === 'PENDING').length;
  const expiredCount = allDocuments.filter((d) => d.status === 'EXPIRED').length;
  const expiringCount = allDocuments.filter((d) => d.status === 'EXPIRING_SOON').length;

  const expiringDocuments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allDocuments
      .map((item) => {
        const expDate = new Date(item.document.expiryDate);
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...item,
          daysRemaining,
        };
      })
      .filter((item) => item.daysRemaining <= 30)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [allDocuments]);

  const urgentExpired = expiringDocuments.filter((d) => d.daysRemaining < 0).length;
  const urgent7d = expiringDocuments.filter((d) => d.daysRemaining >= 0 && d.daysRemaining <= 7).length;
  const urgent15d = expiringDocuments.filter((d) => d.daysRemaining > 7 && d.daysRemaining <= 15).length;
  const urgent30d = expiringDocuments.filter((d) => d.daysRemaining > 15 && d.daysRemaining <= 30).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-indigo-600" />
            <span>Compliance Documents (F7)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit compliance certification for cabs (RC, Permit, PUC, Insurance) and drivers (DL).
          </p>
        </div>

        {/* Quick summary badges */}
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              {pendingCount} Pending Review
            </span>
          )}
          {expiringCount > 0 && (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-50 text-orange-800 border border-orange-200">
              {expiringCount} Expiring Soon
            </span>
          )}
          {expiredCount > 0 && (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
              {expiredCount} Expired
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('queue');
            setSearchParams({ tab: 'queue' });
          }}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'queue'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Verification Queue ({pendingCount})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setSearchParams({ tab: 'all' });
          }}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'all'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          All Fleet Documents ({allDocuments.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('expiries');
            setSearchParams({ tab: 'expiries' });
          }}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'expiries'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Expiry Reminders ({expiringDocuments.length})
        </button>
      </div>

      {/* Tab 1: Verification Queue */}
      {activeTab === 'queue' ? (
        <VerificationQueue />
      ) : activeTab === 'expiries' ? (
        /* Tab 3: Expiry Reminders Panel */
        <div className="space-y-4 min-w-0">
          {/* Urgency Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-rose-600 font-semibold mb-1">
                <span>Already Expired</span>
                <AlertCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl font-bold text-rose-700">{urgentExpired}</div>
              <div className="text-[10px] text-rose-500 mt-0.5">Auto-deactivates vehicles</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-amber-700 font-semibold mb-1">
                <span>Expires in &le; 7d</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-bold text-amber-800">{urgent7d}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">Critical renewal needed</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-orange-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-orange-700 font-semibold mb-1">
                <span>Expires in 8&ndash;15d</span>
                <Calendar className="w-4 h-4 text-orange-600" />
              </div>
              <div className="text-xl font-bold text-orange-800">{urgent15d}</div>
              <div className="text-[10px] text-orange-600 mt-0.5">Notify vendor soon</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
                <span>Expires in 16&ndash;30d</span>
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-xl font-bold text-slate-800">{urgent30d}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Upcoming cycle</div>
            </div>
          </div>

          {/* Expiry Reminders Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden min-w-0">
            {expiringDocuments.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-800">No Upcoming Expiries</h4>
                <p className="text-xs text-slate-500 mt-1">
                  All documents in your subtree are valid for more than 30 days.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left border-collapse min-w-[800px]" aria-label="Expiring Documents Table">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/75">
                      <th className="py-3 px-4">Entity</th>
                      <th className="py-3 px-4">Owner Sub-Vendor</th>
                      <th className="py-3 px-4">Document Type</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4 text-center">Countdown</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {expiringDocuments.map((docItem) => (
                      <tr key={docItem.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {docItem.entityType === 'VEHICLE' ? (
                              <Car className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span className="font-semibold text-slate-800">{docItem.entityName}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {docItem.ownerVendorName}
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {docItem.type}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {docItem.document.expiryDate.slice(0, 10)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {docItem.daysRemaining < 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                              Expired ({Math.abs(docItem.daysRemaining)}d ago)
                            </span>
                          ) : docItem.daysRemaining <= 7 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              {docItem.daysRemaining} days left
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {docItem.daysRemaining} days left
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <DocumentStatusChip status={docItem.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tab 2: All Documents Table */
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search document by entity, file name, or owner vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto">
              <label htmlFor="filter-doctype" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Type:
              </label>
              <select
                id="filter-doctype"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium text-slate-700"
              >
                <option value="ALL">All Types</option>
                <option value="RC">RC</option>
                <option value="PERMIT">Permit</option>
                <option value="PUC">PUC</option>
                <option value="INSURANCE">Insurance</option>
                <option value="DL">DL</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto">
              <label htmlFor="filter-docstatus" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Status:
              </label>
              <select
                id="filter-docstatus"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="EXPIRING_SOON">Expiring Soon</option>
                <option value="EXPIRED">Expired</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden min-w-0">
            {filteredDocuments.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No compliance documents match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]" aria-label="Documents Roster">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/75">
                      <th className="py-3 px-4">Entity</th>
                      <th className="py-3 px-4">Owner Vendor</th>
                      <th className="py-3 px-4">Doc Type</th>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredDocuments.map((docItem) => (
                      <tr key={docItem.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {docItem.entityType === 'VEHICLE' ? (
                              <Car className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span className="font-semibold text-slate-800">{docItem.entityName}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {docItem.ownerVendorName}
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {docItem.type}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]" title={docItem.document.fileName}>
                              {docItem.document.fileName}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600 font-mono">
                          {docItem.document.expiryDate.slice(0, 10)}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <DocumentStatusChip status={docItem.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
