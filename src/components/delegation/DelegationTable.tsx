import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  ShieldCheck,
  Edit,
  Trash2,
  UserCheck,
  Clock,
  ArrowRight,
  LogOut,
  Plus,
} from 'lucide-react';
import type { Delegation } from '@/types';
import { PERMISSION_CONFIG } from '@/config/permissions';
import { useAppStore } from '@/store/useAppStore';
import { Avatar } from '@/components/common/Avatar';
import { RoleBadge } from '@/components/common/RoleBadge';
import { EditScopeDialog } from './EditScopeDialog';
import { RevokeConfirmDialog } from './RevokeConfirmDialog';
import { toast } from 'sonner';

interface DelegationTableProps {
  onOpenCreate: () => void;
}

export const DelegationTable: React.FC<DelegationTableProps> = ({ onOpenCreate }) => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const delegationsById = useAppStore((s) => s.delegationsById);
  const toggleDelegation = useAppStore((s) => s.toggleDelegation);
  const actingOnBehalfOf = useAppStore((s) => s.actingOnBehalfOf);
  const setActingOnBehalfOf = useAppStore((s) => s.setActingOnBehalfOf);

  const effectiveVendorId = actingOnBehalfOf || currentUserId;
  const effectiveVendor = vendorsById[effectiveVendorId];

  const [editingDelegation, setEditingDelegation] = useState<Delegation | null>(null);
  const [revokingDelegation, setRevokingDelegation] = useState<Delegation | null>(null);

  // Delegations created by the current user or acted-as delegator
  const delegationsCreated = Object.values(delegationsById).filter(
    (d) => d.delegatorId === effectiveVendorId,
  );

  // Delegations granted to the current user by senior vendors
  const delegationsReceived = Object.values(delegationsById).filter(
    (d) => d.delegateId === currentUserId,
  );

  const handleToggle = async (d: Delegation) => {
    try {
      await toggleDelegation(d.id, !d.enabled);
      toast.success(
        `Delegation for ${vendorsById[d.delegateId]?.name ?? 'delegate'} ${
          !d.enabled ? 'enabled' : 'disabled'
        }.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update delegation status.';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Section 1: Delegations Granted to You (Acting on Behalf controls) ─── */}
      {delegationsReceived.length > 0 && (
        <div className="bg-white rounded-xl border border-blue-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Authority Delegated to You (F5)
                </h3>
                <p className="text-xs text-slate-500">
                  Senior team members have delegated authority to your account.
                </p>
              </div>
            </div>
            {actingOnBehalfOf && (
              <button
                type="button"
                onClick={() => {
                  setActingOnBehalfOf(null);
                  toast.info('Stopped acting on behalf. Back to direct perspective.');
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer select-none"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit Acting Mode</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {delegationsReceived.map((d) => {
              const delegator = vendorsById[d.delegatorId];
              const isCurrentlyActive = actingOnBehalfOf === d.delegatorId;

              return (
                <div
                  key={d.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrentlyActive
                      ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                      : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={delegator?.name ?? 'Delegator'} role={delegator?.role ?? 'ADMIN'} size="md" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {delegator?.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{delegator?.email}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider shrink-0 ${
                        d.enabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {d.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                    <p className="text-[11px] font-medium text-slate-500">Delegated Scope:</p>
                    <div className="flex flex-wrap gap-1">
                      {d.scope.map((perm) => (
                        <span
                          key={perm}
                          className="px-2 py-0.5 text-[10px] font-medium bg-white text-slate-700 border border-slate-200 rounded-md"
                        >
                          {PERMISSION_CONFIG[perm]?.label ?? perm}
                        </span>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Granted {format(new Date(d.createdAt), 'MMM d, yyyy')}
                      </span>
                      {d.enabled ? (
                        isCurrentlyActive ? (
                          <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                            <span>Currently Acting</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActingOnBehalfOf(d.delegatorId);
                              toast.success(`Now acting on behalf of ${delegator?.name}.`);
                            }}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 shadow-2xs transition-colors cursor-pointer select-none"
                          >
                            <span>Act on Behalf</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Delegation disabled by delegator</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Section 2: Delegations You Created ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Header */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Delegated Authority Roster</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {actingOnBehalfOf ? (
                <span>
                  Active and disabled delegations issued by <strong className="text-slate-700">{effectiveVendor?.name}</strong> (acting authority).
                </span>
              ) : (
                <span>Active and disabled delegations issued by {effectiveVendor?.name}.</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer select-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Delegate Authority</span>
          </button>
        </div>

        {delegationsCreated.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No Delegations Created</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              You haven&apos;t delegated authority to any team member yet. Use &ldquo;Delegate Authority&rdquo; to assign scoped rights to a descendant.
            </p>
            <button
              type="button"
              onClick={onOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer select-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Delegation</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4 min-w-[220px]">Delegate</th>
                  <th className="py-3 px-4 min-w-[260px]">Delegated Scope</th>
                  <th className="py-3 px-3 text-center min-w-[100px]">Status</th>
                  <th className="py-3 px-4 min-w-[140px]">Created Date</th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {delegationsCreated.map((d) => {
                  const delegate = vendorsById[d.delegateId];

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Delegate Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={delegate?.name ?? 'Unknown'}
                            role={delegate?.role ?? 'SUB_VENDOR'}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {delegate?.name ?? d.delegateId}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {delegate?.email}
                            </p>
                            {delegate && (
                              <div className="mt-1">
                                <RoleBadge role={delegate.role} />
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Scope Chips */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {d.scope.map((perm) => (
                            <span
                              key={perm}
                              className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-md"
                              title={PERMISSION_CONFIG[perm]?.description}
                            >
                              {PERMISSION_CONFIG[perm]?.label ?? perm}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Status Toggle Switch */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={d.enabled}
                          aria-label={`Toggle delegation for ${delegate?.name}`}
                          onClick={() => handleToggle(d)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 select-none ${
                            d.enabled ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out mt-0.5 ${
                              d.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-slate-500">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{format(new Date(d.createdAt), 'MMM d, yyyy')}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingDelegation(d)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Scope"
                            aria-label={`Edit scope for ${delegate?.name}`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevokingDelegation(d)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Revoke Delegation"
                            aria-label={`Revoke delegation for ${delegate?.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Edit Scope Modal */}
      <EditScopeDialog
        delegation={editingDelegation}
        isOpen={editingDelegation !== null}
        onClose={() => setEditingDelegation(null)}
      />

      {/* Revoke Confirm Dialog */}
      <RevokeConfirmDialog
        delegation={revokingDelegation}
        isOpen={revokingDelegation !== null}
        onClose={() => setRevokingDelegation(null)}
      />
    </div>
  );
};
