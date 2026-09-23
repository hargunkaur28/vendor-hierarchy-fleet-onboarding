import React from 'react';
import { History, UserCheck, Clock } from 'lucide-react';
import type { AuditEntry } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { RoleBadge } from '@/components/common/RoleBadge';

interface AuditTableProps {
  logs: AuditEntry[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore?: boolean;
}

export const AuditTable: React.FC<AuditTableProps> = ({
  logs,
  hasMore,
  onLoadMore,
  isLoadingMore = false,
}) => {
  const vendorsById = useAppStore((s) => s.vendorsById);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'MOVE_PROFILE':
      case 'CHANGE_ROLE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SUSPEND_VENDOR':
      case 'BLOCK_VEHICLE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'REACTIVATE_VENDOR':
      case 'UNBLOCK_VEHICLE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CREATE_DELEGATION':
      case 'REVOKE_DELEGATION':
      case 'UPDATE_DELEGATION_SCOPE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'UPLOAD_DOCUMENT':
      case 'REVIEW_DOCUMENT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden min-w-0">
      {logs.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <History className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">No Audit Logs Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            No entries match your search or filter criteria.
          </p>
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]" aria-label="Audit Log Entries">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/75">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((entry) => {
                  const actor = vendorsById[entry.actorId];
                  const delegator = entry.onBehalfOfId ? vendorsById[entry.onBehalfOfId] : null;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{entry.at ? new Date(entry.at).toLocaleString() : 'Just now'}</span>
                        </div>
                      </td>

                      {/* Actor + Delegation Attribution */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-medium text-slate-900">
                            <span>{actor?.name ?? entry.actorId}</span>
                            {actor && <RoleBadge role={actor.role} />}
                          </div>

                          {/* Delegation Attribution Badge */}
                          {delegator && (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                              <UserCheck className="w-3 h-3 text-blue-600" />
                              <span>acting for {delegator.name}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border tracking-wide uppercase ${getActionBadge(
                            entry.action,
                          )}`}
                        >
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Target */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 text-[11px]">
                            {entry.targetType}: <span className="font-mono text-slate-600">{entry.targetId}</span>
                          </div>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="py-3 px-4">
                        <div className="text-[11px] text-slate-600 max-w-xs truncate" title={JSON.stringify(entry.details)}>
                          {entry.details && Object.keys(entry.details).length > 0 ? (
                            Object.entries(entry.details)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cursor pagination: Load More Button */}
          {hasMore && (
            <div className="p-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="px-4 py-1.5 text-xs font-semibold text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoadingMore ? 'Loading older entries...' : 'Load More Entries'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
