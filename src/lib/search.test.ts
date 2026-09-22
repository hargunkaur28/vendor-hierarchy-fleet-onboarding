import { describe, it, expect } from 'vitest';
import type { Vendor } from '@/types';
import type { VendorMap } from './tree';
import { searchTree, buildAllSearchKeys } from './search';

function makeVendor(overrides: Partial<Vendor> & { id: string }): Vendor {
  return {
    name: overrides.id,
    email: `${overrides.id}@example.com`,
    phone: '9000000000',
    role: 'SUB_VENDOR',
    parentId: null,
    tags: [],
    status: 'ACTIVE',
    grantedPermissions: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function buildSearchTree(): { byId: VendorMap; keys: Record<string, string> } {
  const byId: VendorMap = {
    admin: makeVendor({ id: 'admin', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN', tags: ['North'] }),
    sa1: makeVendor({ id: 'sa1', name: 'Site Admin North', email: 'sa1@example.com', role: 'SITE_ADMIN', parentId: 'admin', tags: ['North', 'Premium'] }),
    sa2: makeVendor({ id: 'sa2', name: 'Site Admin South', email: 'sa2@example.com', role: 'SITE_ADMIN', parentId: 'admin', tags: ['South'] }),
    gv1: makeVendor({ id: 'gv1', name: 'Deepak Testing', email: 'deepak@example.com', phone: '9876543210', role: 'GROUP_VENDOR', parentId: 'sa1' }),
    sv1: makeVendor({ id: 'sv1', name: 'Demo Sub Vendor', email: 'demo@example.com', role: 'SUB_VENDOR', parentId: 'gv1', tags: ['Pilot'] }),
  };
  const keys = buildAllSearchKeys(byId);
  return { byId, keys };
}

describe('searchTree', () => {
  it('returns all visible with no filters', () => {
    const { byId, keys } = buildSearchTree();
    const result = searchTree({ search: '', tags: [], roles: [] }, byId, keys);
    expect(result.visibleIds.size).toBe(5);
    expect(result.matchIds.size).toBe(0); // no search = no highlight
  });

  it('matches by name (case-insensitive)', () => {
    const { byId, keys } = buildSearchTree();
    const result = searchTree({ search: 'deepak', tags: [], roles: [] }, byId, keys);
    expect(result.matchIds.has('gv1')).toBe(true);
    expect(result.matchIds.size).toBe(1);
  });

  it('matches by email', () => {
    const { byId, keys } = buildSearchTree();
    const result = searchTree({ search: 'demo@', tags: [], roles: [] }, byId, keys);
    expect(result.matchIds.has('sv1')).toBe(true);
  });

  it('matches by phone', () => {
    const { byId, keys } = buildSearchTree();
    const result = searchTree({ search: '9876543210', tags: [], roles: [] }, byId, keys);
    expect(result.matchIds.has('gv1')).toBe(true);
  });

  it('includes ancestors of matches in visible set', () => {
    const { byId, keys } = buildSearchTree();
    const result = searchTree({ search: 'demo sub', tags: [], roles: [] }, byId, keys);
    // sv1 matches, ancestors are gv1, sa1, admin
    expect(result.visibleIds.has('sv1')).toBe(true);
    expect(result.visibleIds.has('gv1')).toBe(true);
    expect(result.visibleIds.has('sa1')).toBe(true);
    expect(result.visibleIds.has('admin')).toBe(true);
    // sa2 is not visible
    expect(result.visibleIds.has('sa2')).toBe(false);
  });

  it('filters by tag (ANY-match)', () => {
    const { byId, keys } = buildSearchTree();
    const result = searchTree({ search: '', tags: ['Pilot'], roles: [] }, byId, keys);
    expect(result.matchIds.has('sv1')).toBe(true);
    expect(result.matchIds.size).toBe(1);
  });

  it('combines text search AND tag filter', () => {
    const { byId, keys } = buildSearchTree();
    // "admin" matches admin AND sa1 AND sa2 (all have "admin" in name/email)
    // But only sa1 has "North" tag, and admin also has "North"
    const result = searchTree({ search: 'admin', tags: ['North'], roles: [] }, byId, keys);
    expect(result.matchIds.has('admin')).toBe(true);
    expect(result.matchIds.has('sa1')).toBe(true);
    expect(result.matchIds.has('sa2')).toBe(false);
  });

  it('filters by role', () => {
    const { byId, keys } = buildSearchTree();
    const result = searchTree({ search: '', tags: [], roles: ['GROUP_VENDOR'] }, byId, keys);
    expect(result.matchIds.has('gv1')).toBe(true);
    expect(result.matchIds.size).toBe(1);
  });

  it('returns empty match set for no results', () => {
    const { byId, keys } = buildSearchTree();
    const result = searchTree({ search: 'zzzzzzz', tags: [], roles: [] }, byId, keys);
    expect(result.matchIds.size).toBe(0);
    expect(result.visibleIds.size).toBe(0);
  });
});
