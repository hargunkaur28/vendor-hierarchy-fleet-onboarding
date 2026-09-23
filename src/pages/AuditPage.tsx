import React, { useState, useEffect, useMemo } from 'react';
import { History, Download, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { AuditFilters } from '@/components/audit/AuditFilters';
import { AuditTable } from '@/components/audit/AuditTable';
import { toast } from 'sonner';

export const AuditPage: React.FC = () => {
  const auditLogsInStore = useAppStore((s) => s.auditLogs);
  const loadAuditLogs = useAppStore((s) => s.loadAuditLogs);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [targetTypeFilter, setTargetTypeFilter] = useState('ALL');

  // Pagination state
  const [visibleCount, setVisibleCount] = useState(25);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Combined & filtered entries
  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return auditLogsInStore.filter((log) => {
      // Action filter
      if (actionFilter !== 'ALL' && log.action !== actionFilter) {
        return false;
      }

      // Target type filter
      if (targetTypeFilter !== 'ALL' && log.targetType !== targetTypeFilter) {
        return false;
      }

      // Search query filter (actor, targetId, details)
      if (q) {
        const detailsStr = JSON.stringify(log.details ?? {}).toLowerCase();
        const match =
          log.actorId.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.targetId.toLowerCase().includes(q) ||
          detailsStr.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [auditLogsInStore, search, actionFilter, targetTypeFilter]);

  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  const hasMore = visibleCount < filteredLogs.length;

  const handleLoadMore = () => {
    setIsLoading(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + 25);
      setIsLoading(false);
    }, 200);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await loadAuditLogs();
      toast.success('Audit trail refreshed.');
    } catch {
      toast.error('Failed to refresh audit logs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Actor ID', 'On Behalf Of', 'Action', 'Target Type', 'Target ID', 'Details'];
    const rows = filteredLogs.map((log) => [
      `"${log.at}"`,
      `"${log.actorId}"`,
      log.onBehalfOfId ? `"${log.onBehalfOfId}"` : '""',
      log.action,
      log.targetType,
      `"${log.targetId}"`,
      `"${JSON.stringify(log.details ?? {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Audit logs exported successfully.');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <span>Audit Trail (F10)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {filteredLogs.length} events
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable chronological ledger of profile moves, role changes, overrides, and compliance actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <AuditFilters
        search={search}
        onSearchChange={setSearch}
        actionFilter={actionFilter}
        onActionFilterChange={setActionFilter}
        targetTypeFilter={targetTypeFilter}
        onTargetTypeFilterChange={setTargetTypeFilter}
      />

      {/* Audit Table */}
      <AuditTable
        logs={visibleLogs}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoading}
      />
    </div>
  );
};
