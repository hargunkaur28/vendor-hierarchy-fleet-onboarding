import { describe, it, expect } from 'vitest';
import type { Vendor, Delegation } from '@/types';
import type { VendorMap } from './tree';
import {
  getEffectivePermissions,
  canGrant,
  authorize,
  hasActiveSuspendedAncestor,
  findPermissionBlocker,
} from './permissions';

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

/**
 * 4-level tree for permission testing:
 *   admin (ADMIN, all perms)
 *     └─ sa1 (SITE_ADMIN, granted: all 6)
 *         └─ gv1 (GROUP_VENDOR, granted: MANAGE_TEAM, ONBOARD_FLEET, ONBOARD_DRIVERS, VERIFY_DOCUMENTS)
 *             └─ sv1 (SUB_VENDOR, granted: ONBOARD_FLEET, ONBOARD_DRIVERS)
 */
function buildPermTree(): { byId: VendorMap } {
  const byId: VendorMap = {
    admin: makeVendor({
      id: 'admin',
      role: 'ADMIN',
      parentId: null,
      grantedPermissions: [
        'MANAGE_TEAM',
        'ONBOARD_FLEET',
        'ONBOARD_DRIVERS',
        'VERIFY_DOCUMENTS',
        'MANAGE_BOOKINGS',
        'MANAGE_PAYMENTS',
      ],
    }),
    sa1: makeVendor({
      id: 'sa1',
      role: 'SITE_ADMIN',
      parentId: 'admin',
      grantedPermissions: [
        'MANAGE_TEAM',
        'ONBOARD_FLEET',
        'ONBOARD_DRIVERS',
        'VERIFY_DOCUMENTS',
        'MANAGE_BOOKINGS',
        'MANAGE_PAYMENTS',
      ],
    }),
    gv1: makeVendor({
      id: 'gv1',
      role: 'GROUP_VENDOR',
      parentId: 'sa1',
      grantedPermissions: [
        'MANAGE_TEAM',
        'ONBOARD_FLEET',
        'ONBOARD_DRIVERS',
        'VERIFY_DOCUMENTS',
      ],
    }),
    sv1: makeVendor({
      id: 'sv1',
      role: 'SUB_VENDOR',
      parentId: 'gv1',
      grantedPermissions: ['ONBOARD_FLEET', 'ONBOARD_DRIVERS'],
    }),
  };
  return { byId };
}

// ─── getEffectivePermissions ───────────────────────────────────────

describe('getEffectivePermissions', () => {
  it('root has all permissions', () => {
    const { byId } = buildPermTree();
    const effective = getEffectivePermissions('admin', byId);
    expect(effective).toEqual(
      expect.arrayContaining([
        'MANAGE_TEAM',
        'ONBOARD_FLEET',
        'ONBOARD_DRIVERS',
        'VERIFY_DOCUMENTS',
        'MANAGE_BOOKINGS',
        'MANAGE_PAYMENTS',
      ]),
    );
  });

  it('intersects correctly through 4 levels', () => {
    const { byId } = buildPermTree();
    // sv1 granted: ONBOARD_FLEET, ONBOARD_DRIVERS
    // gv1 granted: MANAGE_TEAM, ONBOARD_FLEET, ONBOARD_DRIVERS, VERIFY_DOCUMENTS
    // intersection = ONBOARD_FLEET, ONBOARD_DRIVERS
    const effective = getEffectivePermissions('sv1', byId);
    expect(new Set(effective)).toEqual(
      new Set(['ONBOARD_FLEET', 'ONBOARD_DRIVERS']),
    );
  });

  it('revoking at parent removes from descendant effective', () => {
    const { byId } = buildPermTree();
    // Remove ONBOARD_FLEET from gv1's grants
    byId['gv1']!.grantedPermissions = ['MANAGE_TEAM', 'ONBOARD_DRIVERS', 'VERIFY_DOCUMENTS'];
    const effective = getEffectivePermissions('sv1', byId);
    expect(effective).not.toContain('ONBOARD_FLEET');
    expect(effective).toContain('ONBOARD_DRIVERS');
  });

  it('returns empty for unknown vendor', () => {
    const { byId } = buildPermTree();
    expect(getEffectivePermissions('nonexistent', byId)).toEqual([]);
  });

  it('child cannot have permission parent lacks (no escalation)', () => {
    const { byId } = buildPermTree();
    // Even if sv1 is granted MANAGE_PAYMENTS, gv1 doesn't have it
    byId['sv1']!.grantedPermissions = [
      'ONBOARD_FLEET',
      'ONBOARD_DRIVERS',
      'MANAGE_PAYMENTS',
    ];
    const effective = getEffectivePermissions('sv1', byId);
    expect(effective).not.toContain('MANAGE_PAYMENTS');
  });
});

// ─── canGrant ──────────────────────────────────────────────────────

describe('canGrant', () => {
  it('admin can grant anything', () => {
    const { byId } = buildPermTree();
    expect(canGrant('admin', 'MANAGE_PAYMENTS', byId)).toBe(true);
  });

  it('sv1 cannot grant what it does not effectively have', () => {
    const { byId } = buildPermTree();
    expect(canGrant('sv1', 'MANAGE_TEAM', byId)).toBe(false);
  });
});

// ─── hasActiveSuspendedAncestor ────────────────────────────────────

describe('hasActiveSuspendedAncestor', () => {
  it('returns false when no ancestor suspended', () => {
    const { byId } = buildPermTree();
    expect(hasActiveSuspendedAncestor('sv1', byId).suspended).toBe(false);
  });

  it('returns true when parent suspended', () => {
    const { byId } = buildPermTree();
    byId['gv1']!.status = 'SUSPENDED';
    byId['gv1']!.suspendedBy = { vendorId: 'sa1', reason: 'Test', at: '2024-01-01T00:00:00Z' };
    const result = hasActiveSuspendedAncestor('sv1', byId);
    expect(result.suspended).toBe(true);
  });
});

// ─── authorize ─────────────────────────────────────────────────────

describe('authorize', () => {
  const noDelegations: Delegation[] = [];

  it('allows action when actor has permission and target in subtree', () => {
    const { byId } = buildPermTree();
    const result = authorize(
      { actorId: 'gv1', permission: 'ONBOARD_FLEET', targetVendorId: 'sv1' },
      byId,
      noDelegations,
    );
    expect(result).toEqual({ allowed: true, via: 'OWN' });
  });

  it('denies when actor lacks permission', () => {
    const { byId } = buildPermTree();
    const result = authorize(
      { actorId: 'sv1', permission: 'MANAGE_TEAM', targetVendorId: 'sv1' },
      byId,
      noDelegations,
    );
    expect(result).toEqual(
      expect.objectContaining({ allowed: false, code: 'PERMISSION_DENIED' }),
    );
  });

  it('denies when target is out of scope', () => {
    const { byId } = buildPermTree();
    const result = authorize(
      { actorId: 'sv1', permission: 'ONBOARD_FLEET', targetVendorId: 'sa1' },
      byId,
      noDelegations,
    );
    expect(result).toEqual(
      expect.objectContaining({ allowed: false, code: 'OUT_OF_SCOPE' }),
    );
  });

  it('admin can access any target', () => {
    const { byId } = buildPermTree();
    const result = authorize(
      { actorId: 'admin', permission: 'MANAGE_TEAM', targetVendorId: 'sv1' },
      byId,
      noDelegations,
    );
    expect(result).toEqual({ allowed: true, via: 'OWN' });
  });

  it('denies suspended actor', () => {
    const { byId } = buildPermTree();
    byId['sv1']!.status = 'SUSPENDED';
    byId['sv1']!.suspendedBy = { vendorId: 'gv1', reason: 'Non-compliant', at: '2024-01-01T00:00:00Z' };
    const result = authorize(
      { actorId: 'sv1', permission: 'ONBOARD_FLEET', targetVendorId: 'sv1' },
      byId,
      noDelegations,
    );
    expect(result).toEqual(
      expect.objectContaining({ allowed: false, code: 'ACCOUNT_SUSPENDED' }),
    );
  });

  it('denies when ancestor is suspended', () => {
    const { byId } = buildPermTree();
    byId['gv1']!.status = 'SUSPENDED';
    byId['gv1']!.suspendedBy = { vendorId: 'sa1', reason: 'Audit', at: '2024-01-01T00:00:00Z' };
    const result = authorize(
      { actorId: 'sv1', permission: 'ONBOARD_FLEET', targetVendorId: 'sv1' },
      byId,
      noDelegations,
    );
    expect(result).toEqual(
      expect.objectContaining({ allowed: false, code: 'ACCOUNT_SUSPENDED' }),
    );
  });

  // ── Delegation tests ──

  it('allows action via valid delegation', () => {
    const { byId } = buildPermTree();
    const delegations: Delegation[] = [
      {
        id: 'd1',
        delegatorId: 'gv1',
        delegateId: 'sv1',
        scope: ['MANAGE_TEAM', 'ONBOARD_FLEET'],
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    const result = authorize(
      {
        actorId: 'sv1',
        permission: 'MANAGE_TEAM',
        targetVendorId: 'sv1',
        onBehalfOfId: 'gv1',
      },
      byId,
      delegations,
    );
    expect(result).toEqual({
      allowed: true,
      via: 'DELEGATION',
      onBehalfOfId: 'gv1',
    });
  });

  it('denies delegation when disabled', () => {
    const { byId } = buildPermTree();
    const delegations: Delegation[] = [
      {
        id: 'd1',
        delegatorId: 'gv1',
        delegateId: 'sv1',
        scope: ['MANAGE_TEAM'],
        enabled: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    const result = authorize(
      {
        actorId: 'sv1',
        permission: 'MANAGE_TEAM',
        targetVendorId: 'sv1',
        onBehalfOfId: 'gv1',
      },
      byId,
      delegations,
    );
    expect(result).toEqual(
      expect.objectContaining({ allowed: false, code: 'DELEGATION_INVALID' }),
    );
  });

  it('denies delegation when permission not in scope', () => {
    const { byId } = buildPermTree();
    const delegations: Delegation[] = [
      {
        id: 'd1',
        delegatorId: 'gv1',
        delegateId: 'sv1',
        scope: ['ONBOARD_FLEET'],
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    const result = authorize(
      {
        actorId: 'sv1',
        permission: 'MANAGE_TEAM',
        targetVendorId: 'sv1',
        onBehalfOfId: 'gv1',
      },
      byId,
      delegations,
    );
    expect(result).toEqual(
      expect.objectContaining({ allowed: false, code: 'PERMISSION_DENIED' }),
    );
  });

  it('denies delegation when target outside delegator subtree', () => {
    const { byId } = buildPermTree();
    const delegations: Delegation[] = [
      {
        id: 'd1',
        delegatorId: 'gv1',
        delegateId: 'sv1',
        scope: ['MANAGE_TEAM'],
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    const result = authorize(
      {
        actorId: 'sv1',
        permission: 'MANAGE_TEAM',
        targetVendorId: 'sa1', // sa1 is above gv1, not in gv1's subtree
        onBehalfOfId: 'gv1',
      },
      byId,
      delegations,
    );
    expect(result).toEqual(
      expect.objectContaining({ allowed: false, code: 'OUT_OF_SCOPE' }),
    );
  });
});

// ─── findPermissionBlocker ─────────────────────────────────────────

describe('findPermissionBlocker', () => {
  it('returns null when no ancestor blocks', () => {
    const { byId } = buildPermTree();
    expect(findPermissionBlocker('sv1', 'ONBOARD_FLEET', byId)).toBeNull();
  });

  it('returns the blocking ancestor', () => {
    const { byId } = buildPermTree();
    // Remove ONBOARD_FLEET from gv1
    byId['gv1']!.grantedPermissions = ['MANAGE_TEAM', 'ONBOARD_DRIVERS', 'VERIFY_DOCUMENTS'];
    const blocker = findPermissionBlocker('sv1', 'ONBOARD_FLEET', byId);
    expect(blocker?.id).toBe('gv1');
  });
});
