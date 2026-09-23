import React from 'react';
import { Shield, Info, AlertTriangle, Check, Lock } from 'lucide-react';
import type { Vendor, PermissionKey } from '@/types';
import { ALL_PERMISSIONS, PERMISSION_CONFIG } from '@/config/permissions';
import { useAppStore } from '@/store/useAppStore';
import { getEffectivePermissions, findPermissionBlocker } from '@/lib/permissions';
import { Avatar } from '@/components/common/Avatar';
import { RoleBadge } from '@/components/common/RoleBadge';
import { toast } from 'sonner';

export const PermissionMatrix: React.FC = () => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const childrenIndex = useAppStore((s) => s.childrenIndex);
  const updateGrantedPermissions = useAppStore((s) => s.updateGrantedPermissions);

  const currentUser = vendorsById[currentUserId];
  // Direct sub-vendors under current user
  const childIds = childrenIndex[currentUserId] || [];
  const subVendors = childIds.map((id) => vendorsById[id]!).filter(Boolean);

  // Actor's effective permissions (cannot grant what actor doesn't hold)
  const actorEffectivePerms = new Set(getEffectivePermissions(currentUserId, vendorsById));

  const handleToggle = async (
    vendor: Vendor,
    permission: PermissionKey,
    currentGranted: boolean,
  ) => {
    // Escalate guard (defense in depth)
    if (!actorEffectivePerms.has(permission) && !currentGranted) {
      toast.error(`You do not hold the ${PERMISSION_CONFIG[permission].label} permission.`);
      return;
    }

    const nextPerms = currentGranted
      ? vendor.grantedPermissions.filter((p) => p !== permission)
      : [...vendor.grantedPermissions, permission];

    try {
      await updateGrantedPermissions(vendor.id, nextPerms);
      toast.success(
        `${currentGranted ? 'Revoked' : 'Granted'} "${PERMISSION_CONFIG[permission].label}" for ${vendor.name}.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update permissions.';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header controls & scope summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            <span>Permission Grant Matrix (F4)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Grant or restrict operational permissions for direct sub-vendors of {currentUser?.name}. Ancestor grants clamp effective rights.
          </p>
        </div>
      </div>

      {/* Empty State */}
      {subVendors.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">No Direct Sub-Vendors</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {currentUser?.name ?? 'This vendor'} currently has no direct team members to grant permissions to.
          </p>
        </div>
      ) : (
        /* Matrix Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4 min-w-[220px]">Sub-Vendor</th>
                  {ALL_PERMISSIONS.map((perm) => (
                    <th key={perm} className="py-3 px-3 text-center min-w-[110px]" title={PERMISSION_CONFIG[perm].description}>
                      <span className="block leading-tight">{PERMISSION_CONFIG[perm].label}</span>
                    </th>
                  ))}
                  <th className="py-3 px-4 min-w-[220px]">Effective Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subVendors.map((vendor) => {
                  const effectiveList = getEffectivePermissions(vendor.id, vendorsById);
                  const effectiveSet = new Set(effectiveList);

                  return (
                    <tr key={vendor.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Vendor Identity Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={vendor.name} role={vendor.role} size="md" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{vendor.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{vendor.email}</p>
                            <div className="mt-1">
                              <RoleBadge role={vendor.role} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 6 Permission Toggle Cells */}
                      {ALL_PERMISSIONS.map((perm) => {
                        const isGranted = vendor.grantedPermissions.includes(perm);
                        const isEffective = effectiveSet.has(perm);
                        const actorHasPerm = actorEffectivePerms.has(perm);
                        const isBlockedByAncestor = isGranted && !isEffective;
                        const blocker = isBlockedByAncestor
                          ? findPermissionBlocker(vendor.id, perm, vendorsById)
                          : null;

                        // Tooltip text
                        let tooltipText = PERMISSION_CONFIG[perm].description;
                        if (!actorHasPerm) {
                          tooltipText = "You don't have this permission (cannot grant what you don't hold)";
                        } else if (isBlockedByAncestor && blocker) {
                          tooltipText = `Blocked by ancestor: ${blocker.name} does not hold this permission`;
                        } else if (isGranted && isEffective) {
                          tooltipText = `Granted and active for ${vendor.name}`;
                        }

                        return (
                          <td key={perm} className="py-3 px-3 text-center align-middle">
                            <div className="inline-flex flex-col items-center justify-center gap-1" title={tooltipText}>
                              {/* Toggle switch button */}
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isGranted}
                                aria-label={`${PERMISSION_CONFIG[perm].label} for ${vendor.name}`}
                                disabled={!actorHasPerm}
                                onClick={() => handleToggle(vendor, perm, isGranted)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 select-none ${
                                  !actorHasPerm
                                    ? 'bg-slate-200 opacity-50 cursor-not-allowed'
                                    : isBlockedByAncestor
                                      ? 'bg-amber-400 border border-amber-500/60'
                                      : isGranted
                                        ? 'bg-indigo-600'
                                        : 'bg-slate-200 hover:bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out mt-0.5 ${
                                    isGranted ? 'translate-x-4.5' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>

                              {/* Inherited-blocked indicator or lock badge */}
                              {isBlockedByAncestor ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-1 py-0.2 rounded-xs">
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                  <span>Blocked</span>
                                </span>
                              ) : !actorHasPerm ? (
                                <span className="inline-flex items-center text-[10px] text-slate-400">
                                  <Lock className="w-2.5 h-2.5" />
                                </span>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}

                      {/* Effective Permissions Column (Real-time chips) */}
                      <td className="py-3 px-4">
                        {effectiveList.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">No effective permissions</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {effectiveList.map((perm) => (
                              <span
                                key={perm}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200/80"
                                title={PERMISSION_CONFIG[perm].description}
                              >
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                {PERMISSION_CONFIG[perm].label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Matrix Footer Legend */}
          <div className="p-3 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                <span>Granted & Effective</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500 inline-block" />
                <span>Inherited-Blocked (Ancestor Lacks Perm)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-200 inline-block" />
                <span>Revoked / Disabled</span>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              <span>Changes take effect immediately and are logged in audit history.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
