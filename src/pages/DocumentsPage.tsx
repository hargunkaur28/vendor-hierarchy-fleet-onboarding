import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  FileText,
  Search,
  Car,
  User,
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

  const [activeTab, setActiveTab] = useState<'queue' | 'all'>('queue');
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
          onClick={() => setActiveTab('queue')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'queue'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Verification Queue ({pendingCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'all'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          All Fleet Documents ({allDocuments.length})
        </button>
      </div>

      {/* Tab 1: Verification Queue */}
      {activeTab === 'queue' ? (
        <VerificationQueue />
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
