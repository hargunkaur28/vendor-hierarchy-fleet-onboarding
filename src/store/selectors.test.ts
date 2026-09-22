import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';
import {
  selectCurrentUser,
  selectSelectedVendor,
  selectSubtreeVendorIds,
  selectSubtreeStats,
  selectEffectivePermissions,
  selectVisibleTree,
  selectNonCompliantVehicles,
  selectExpiringDocuments,
} from './selectors';
import { resetDb } from '@/api/client';

describe('Store Selectors', () => {
  beforeEach(async () => {
    resetDb();
    await useAppStore.getState().initApp();
  });

  it('selects current user and selected vendor', () => {
    const state = useAppStore.getState();
    const user = selectCurrentUser(state);
    expect(user).toBeDefined();
    expect(user?.role).toBe('ADMIN');

    const selected = selectSelectedVendor(state);
    expect(selected).toBeDefined();
    expect(selected?.id).toBe('admin');
  });

  it('selects subtree vendor IDs correctly', () => {
    const state = useAppStore.getState();
    const ids = selectSubtreeVendorIds(state, 'gv-regional-ops');
    expect(ids).toContain('gv-regional-ops');
    expect(ids).toContain('sv-regional');
    expect(ids).toContain('sv-city');
    expect(ids).toContain('sv-local');
  });

  it('computes subtree stats accurately', () => {
    const state = useAppStore.getState();
    const stats = selectSubtreeStats(state, 'admin');
    expect(stats.vendorCount).toBeGreaterThan(20);
    expect(stats.totalVehicles).toBeGreaterThan(0);
    expect(stats.totalDrivers).toBeGreaterThan(0);
    expect(stats.complianceRate).toBeGreaterThanOrEqual(0);
    expect(stats.complianceRate).toBeLessThanOrEqual(100);
  });

  it('selects effective permissions for vendor', () => {
    const state = useAppStore.getState();
    const adminPerms = selectEffectivePermissions(state, 'admin');
    expect(adminPerms.has('MANAGE_TEAM')).toBe(true);
    expect(adminPerms.has('ONBOARD_FLEET')).toBe(true);
    expect(adminPerms.has('VERIFY_DOCUMENTS')).toBe(true);
  });

  it('filters visible tree by search text', () => {
    useAppStore.getState().setSearchFilters({ search: 'Regional' });
    const { matchIds, visibleIds, hasFilter } = selectVisibleTree(useAppStore.getState());

    expect(hasFilter).toBe(true);
    expect(matchIds.has('gv-regional-ops') || matchIds.has('sv-regional')).toBe(true);
    // Ancestors should be in visible set
    expect(visibleIds.has('admin')).toBe(true);
  });

  it('filters by vendor status', () => {
    useAppStore.getState().setStatusFilter('SUSPENDED');
    const { hasFilter } = selectVisibleTree(useAppStore.getState());
    expect(hasFilter).toBe(true);
  });

  it('selects non-compliant vehicles', () => {
    const state = useAppStore.getState();
    const nonCompliant = selectNonCompliantVehicles(state);
    expect(Array.isArray(nonCompliant)).toBe(true);
  });

  it('selects expiring documents within window', () => {
    const state = useAppStore.getState();
    const expiring = selectExpiringDocuments(state);
    expect(Array.isArray(expiring)).toBe(true);
  });
});
