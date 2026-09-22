import type { AppState } from './useAppStore';
import type { Vendor, Vehicle, Driver, PermissionKey } from '@/types';
import { getDescendantIds, getAncestors } from '@/lib/tree';
import { getEffectivePermissions } from '@/lib/permissions';
import { isVehicleCompliant, isDriverCompliant, getDocumentStatus } from '@/lib/compliance';
import { searchTree, buildAllSearchKeys } from '@/lib/search';

/**
 * Returns the currently logged in vendor actor.
 */
export function selectCurrentUser(state: AppState): Vendor | undefined {
  return state.vendorsById[state.currentUserId];
}

/**
 * Returns the currently selected vendor in the UI.
 */
export function selectSelectedVendor(state: AppState): Vendor | undefined {
  if (!state.selectedVendorId) return undefined;
  return state.vendorsById[state.selectedVendorId];
}

/**
 * Returns all vendor IDs belonging to the vendor's subtree (including self).
 */
export function selectSubtreeVendorIds(state: AppState, rootId: string): string[] {
  const descendants = getDescendantIds(rootId, state.childrenIndex);
  return [rootId, ...descendants];
}

/**
 * Returns all vehicles owned by any vendor within the specified subtree.
 */
export function selectSubtreeVehicles(state: AppState, rootId: string): Vehicle[] {
  const vendorIds = new Set(selectSubtreeVendorIds(state, rootId));
  return Object.values(state.vehiclesById).filter((v) => vendorIds.has(v.ownerVendorId));
}

/**
 * Returns all drivers affiliated with any vendor within the specified subtree.
 */
export function selectSubtreeDrivers(state: AppState, rootId: string): Driver[] {
  const vendorIds = new Set(selectSubtreeVendorIds(state, rootId));
  return Object.values(state.driversById).filter((d) => vendorIds.has(d.ownerVendorId));
}

export interface SubtreeStats {
  vendorCount: number;
  totalVehicles: number;
  activeVehicles: number;
  compliantVehicles: number;
  nonCompliantVehicles: number;
  totalDrivers: number;
  activeDrivers: number;
  compliantDrivers: number;
  complianceRate: number; // 0 - 100
}

/**
 * Computes aggregated statistics for a vendor's entire subtree.
 */
export function selectSubtreeStats(state: AppState, rootId: string): SubtreeStats {
  const vendorIds = selectSubtreeVendorIds(state, rootId);
  const vehicles = selectSubtreeVehicles(state, rootId);
  const drivers = selectSubtreeDrivers(state, rootId);

  let compliantVehicles = 0;
  let activeVehicles = 0;
  for (const v of vehicles) {
    if (v.status === 'ACTIVE') activeVehicles++;
    if (isVehicleCompliant(v).compliant) compliantVehicles++;
  }

  let compliantDrivers = 0;
  let activeDrivers = 0;
  for (const d of drivers) {
    if (d.availability === 'AVAILABLE') activeDrivers++;
    if (isDriverCompliant(d).compliant) compliantDrivers++;
  }

  const nonCompliantVehicles = vehicles.length - compliantVehicles;
  const complianceRate =
    vehicles.length > 0 ? Math.round((compliantVehicles / vehicles.length) * 100) : 100;

  return {
    vendorCount: vendorIds.length,
    totalVehicles: vehicles.length,
    activeVehicles,
    compliantVehicles,
    nonCompliantVehicles,
    totalDrivers: drivers.length,
    activeDrivers,
    compliantDrivers,
    complianceRate,
  };
}

/**
 * Returns effective permissions for a vendor, considering delegation and ancestor suspension.
 */
export function selectEffectivePermissions(
  state: AppState,
  vendorId: string,
): Set<PermissionKey> {
  return new Set(getEffectivePermissions(vendorId, state.vendorsById));
}

/**
 * Evaluates visible vendors based on current search query, tags, and role filters.
 */
export function selectVisibleTree(state: AppState): {
  visibleIds: Set<string>;
  matchIds: Set<string>;
  hasFilter: boolean;
} {
  const hasFilter =
    Boolean(state.searchFilters.search.trim()) ||
    state.searchFilters.tags.length > 0 ||
    state.searchFilters.roles.length > 0 ||
    state.statusFilter !== 'ALL';

  if (!hasFilter) {
    const all = new Set(Object.keys(state.vendorsById));
    return { visibleIds: all, matchIds: all, hasFilter: false };
  }

  const searchKeys = buildAllSearchKeys(state.vendorsById);
  const result = searchTree(state.searchFilters, state.vendorsById, searchKeys);
  const matchIds = new Set(result.matchIds);
  const visibleIds = new Set(result.visibleIds);

  // Apply status filter if active
  if (state.statusFilter !== 'ALL') {
    for (const id of Array.from(matchIds)) {
      const vendor = state.vendorsById[id];
      if (vendor && vendor.status !== state.statusFilter) {
        matchIds.delete(id);
      }
    }
    // Recompute visible (matches + ancestors of matches)
    visibleIds.clear();
    for (const matchId of matchIds) {
      visibleIds.add(matchId);
      const ancestors = getAncestors(matchId, state.vendorsById);
      for (const a of ancestors) {
        visibleIds.add(a.id);
      }
    }
  }

  return { visibleIds, matchIds, hasFilter: true };
}

/**
 * Returns all non-compliant vehicles, optionally scoped to a vendor subtree.
 */
export function selectNonCompliantVehicles(
  state: AppState,
  rootId?: string,
): Array<{ vehicle: Vehicle; reasons: string[] }> {
  const vehicles = rootId
    ? selectSubtreeVehicles(state, rootId)
    : Object.values(state.vehiclesById);

  const results: Array<{ vehicle: Vehicle; reasons: string[] }> = [];
  for (const v of vehicles) {
    const check = isVehicleCompliant(v);
    if (!check.compliant) {
      results.push({
        vehicle: v,
        reasons: check.reasons.map((r) => r.detail),
      });
    }
  }
  return results;
}

/**
 * Returns documents that are expiring within the next N days across all vehicles and drivers.
 */
export function selectExpiringDocuments(
  state: AppState,
  now = new Date(),
): Array<{
  entityType: 'VEHICLE' | 'DRIVER';
  entityId: string;
  entityName: string;
  docType: string;
  expiryDate: string;
  status: string;
}> {
  const items: Array<{
    entityType: 'VEHICLE' | 'DRIVER';
    entityId: string;
    entityName: string;
    docType: string;
    expiryDate: string;
    status: string;
  }> = [];

  for (const vehicle of Object.values(state.vehiclesById)) {
    for (const doc of vehicle.documents) {
      const status = getDocumentStatus(doc, now);
      if (status === 'EXPIRING_SOON' || status === 'EXPIRED') {
        items.push({
          entityType: 'VEHICLE',
          entityId: vehicle.id,
          entityName: vehicle.regNo,
          docType: doc.type,
          expiryDate: doc.expiryDate,
          status,
        });
      }
    }
  }

  for (const driver of Object.values(state.driversById)) {
    for (const doc of driver.documents) {
      const status = getDocumentStatus(doc, now);
      if (status === 'EXPIRING_SOON' || status === 'EXPIRED') {
        items.push({
          entityType: 'DRIVER',
          entityId: driver.id,
          entityName: driver.name,
          docType: doc.type,
          expiryDate: doc.expiryDate,
          status,
        });
      }
    }
  }

  return items;
}
