import { describe, it, expect } from 'vitest';
import type { Vendor } from '@/types';
import {
  buildChildrenIndex,
  getAncestors,
  isDescendantOf,
  getDescendantIds,
  wouldCreateCycle,
  getValidParents,
  reparent,
  assertTreeInvariants,
} from './tree';
import type { VendorMap, ChildrenIndex } from './tree';

// ─── Helpers ───────────────────────────────────────────────────────

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
 * Builds a small test tree:
 *   admin (ADMIN)
 *     ├─ sa1 (SITE_ADMIN)
 *     │   ├─ gv1 (GROUP_VENDOR)
 *     │   │   ├─ sv1 (SUB_VENDOR)
 *     │   │   │   └─ da1 (DEPLOYMENT_ASSOCIATE)
 *     │   │   └─ sv2 (SUB_VENDOR)
 *     │   └─ gv2 (GROUP_VENDOR)
 *     └─ sa2 (SITE_ADMIN)
 */
function buildTestTree(): { byId: VendorMap; index: ChildrenIndex } {
  const byId: VendorMap = {
    admin: makeVendor({ id: 'admin', role: 'ADMIN', parentId: null }),
    sa1: makeVendor({ id: 'sa1', role: 'SITE_ADMIN', parentId: 'admin' }),
    sa2: makeVendor({ id: 'sa2', role: 'SITE_ADMIN', parentId: 'admin' }),
    gv1: makeVendor({ id: 'gv1', role: 'GROUP_VENDOR', parentId: 'sa1' }),
    gv2: makeVendor({ id: 'gv2', role: 'GROUP_VENDOR', parentId: 'sa1' }),
    sv1: makeVendor({ id: 'sv1', role: 'SUB_VENDOR', parentId: 'gv1' }),
    sv2: makeVendor({ id: 'sv2', role: 'SUB_VENDOR', parentId: 'gv1' }),
    da1: makeVendor({ id: 'da1', role: 'DEPLOYMENT_ASSOCIATE', parentId: 'sv1' }),
  };
  const index = buildChildrenIndex(byId);
  return { byId, index };
}

// ─── buildChildrenIndex ────────────────────────────────────────────

describe('buildChildrenIndex', () => {
  it('builds correct parent→children mapping', () => {
    const { index } = buildTestTree();
    expect(index['admin']).toEqual(expect.arrayContaining(['sa1', 'sa2']));
    expect(index['sa1']).toEqual(expect.arrayContaining(['gv1', 'gv2']));
    expect(index['gv1']).toEqual(expect.arrayContaining(['sv1', 'sv2']));
    expect(index['sv1']).toEqual(['da1']);
    expect(index['da1']).toEqual([]);
    expect(index['sa2']).toEqual([]);
  });

  it('every vendor has an entry even if no children', () => {
    const { byId, index } = buildTestTree();
    for (const id of Object.keys(byId)) {
      expect(index[id]).toBeDefined();
    }
  });
});

// ─── getAncestors ──────────────────────────────────────────────────

describe('getAncestors', () => {
  it('returns empty for root', () => {
    const { byId } = buildTestTree();
    expect(getAncestors('admin', byId)).toEqual([]);
  });

  it('returns correct chain for deep node', () => {
    const { byId } = buildTestTree();
    const ancestors = getAncestors('da1', byId);
    expect(ancestors.map((a) => a.id)).toEqual(['sv1', 'gv1', 'sa1', 'admin']);
  });

  it('returns parent only for depth-1 node', () => {
    const { byId } = buildTestTree();
    const ancestors = getAncestors('sa1', byId);
    expect(ancestors.map((a) => a.id)).toEqual(['admin']);
  });
});

// ─── isDescendantOf ────────────────────────────────────────────────

describe('isDescendantOf', () => {
  it('direct child is descendant', () => {
    const { byId } = buildTestTree();
    expect(isDescendantOf('sa1', 'admin', byId)).toBe(true);
  });

  it('deep node is descendant', () => {
    const { byId } = buildTestTree();
    expect(isDescendantOf('da1', 'admin', byId)).toBe(true);
    expect(isDescendantOf('da1', 'sa1', byId)).toBe(true);
    expect(isDescendantOf('da1', 'gv1', byId)).toBe(true);
    expect(isDescendantOf('da1', 'sv1', byId)).toBe(true);
  });

  it('not descendant of sibling', () => {
    const { byId } = buildTestTree();
    expect(isDescendantOf('sv1', 'gv2', byId)).toBe(false);
    expect(isDescendantOf('sa1', 'sa2', byId)).toBe(false);
  });

  it('root is not descendant of anyone', () => {
    const { byId } = buildTestTree();
    expect(isDescendantOf('admin', 'sa1', byId)).toBe(false);
  });

  it('not a descendant of self', () => {
    const { byId } = buildTestTree();
    expect(isDescendantOf('gv1', 'gv1', byId)).toBe(false);
  });
});

// ─── getDescendantIds ──────────────────────────────────────────────

describe('getDescendantIds', () => {
  it('returns all descendants', () => {
    const { index } = buildTestTree();
    const desc = getDescendantIds('sa1', index);
    expect(new Set(desc)).toEqual(new Set(['gv1', 'gv2', 'sv1', 'sv2', 'da1']));
  });

  it('returns empty for leaf', () => {
    const { index } = buildTestTree();
    expect(getDescendantIds('da1', index)).toEqual([]);
  });

  it('handles deep chain of 10,000 nodes without stack overflow', () => {
    const byId: VendorMap = {
      root: makeVendor({ id: 'root', role: 'ADMIN', parentId: null }),
    };
    // Build a linear chain: root → n1 → n2 → ... → n10000
    let prevId = 'root';
    for (let i = 1; i <= 10000; i++) {
      const id = `n${i}`;
      byId[id] = makeVendor({ id, role: 'SUB_VENDOR', parentId: prevId });
      prevId = id;
    }
    const index = buildChildrenIndex(byId);
    const desc = getDescendantIds('root', index);
    expect(desc.length).toBe(10000);
  });
});

// ─── wouldCreateCycle ──────────────────────────────────────────────

describe('wouldCreateCycle', () => {
  it('moving under self is a cycle', () => {
    const { byId } = buildTestTree();
    expect(wouldCreateCycle('gv1', 'gv1', byId)).toBe(true);
  });

  it('moving under own child is a cycle', () => {
    const { byId } = buildTestTree();
    expect(wouldCreateCycle('gv1', 'sv1', byId)).toBe(true);
  });

  it('moving under own grandchild is a cycle', () => {
    const { byId } = buildTestTree();
    expect(wouldCreateCycle('gv1', 'da1', byId)).toBe(true);
  });

  it('moving under unrelated node is not a cycle', () => {
    const { byId } = buildTestTree();
    expect(wouldCreateCycle('gv1', 'sa2', byId)).toBe(false);
  });

  it('moving under sibling is not a cycle', () => {
    const { byId } = buildTestTree();
    expect(wouldCreateCycle('sv1', 'sv2', byId)).toBe(false);
  });

  it('moving under parent (ancestor) is not a cycle', () => {
    const { byId } = buildTestTree();
    expect(wouldCreateCycle('sv1', 'sa1', byId)).toBe(false);
  });
});

// ─── reparent ──────────────────────────────────────────────────────

describe('reparent', () => {
  it('successfully moves a node and updates index', () => {
    const { byId, index } = buildTestTree();
    const result = reparent(byId, index, 'gv1', 'sa2');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.previousParentId).toBe('sa1');
      expect(byId['gv1']!.parentId).toBe('sa2');
      // Old parent no longer has gv1
      expect(index['sa1']).not.toContain('gv1');
      // New parent has gv1
      expect(index['sa2']).toContain('gv1');
    }
  });

  it('descendants move implicitly (parentId unchanged)', () => {
    const { byId, index } = buildTestTree();
    reparent(byId, index, 'gv1', 'sa2');
    // sv1, sv2, da1 still point to gv1
    expect(byId['sv1']!.parentId).toBe('gv1');
    expect(byId['da1']!.parentId).toBe('sv1');
    // And they're reachable under sa2 now
    const sa2Descendants = getDescendantIds('sa2', index);
    expect(sa2Descendants).toContain('gv1');
    expect(sa2Descendants).toContain('sv1');
    expect(sa2Descendants).toContain('da1');
  });

  it('index stays consistent after move', () => {
    const { byId, index } = buildTestTree();
    reparent(byId, index, 'gv1', 'sa2');
    expect(() => assertTreeInvariants(byId, index)).not.toThrow();
  });

  it('rejects same parent', () => {
    const { byId, index } = buildTestTree();
    const result = reparent(byId, index, 'gv1', 'sa1');
    expect(result).toEqual(
      expect.objectContaining({ success: false, code: 'SAME_PARENT' }),
    );
  });

  it('rejects cycle (move under own descendant)', () => {
    const { byId, index } = buildTestTree();
    const result = reparent(byId, index, 'sa1', 'da1');
    expect(result).toEqual(
      expect.objectContaining({ success: false, code: 'CYCLE_DETECTED' }),
    );
  });

  it('rejects invalid role pairing', () => {
    const { byId, index } = buildTestTree();
    // Try to put a SITE_ADMIN under a SUB_VENDOR
    const result = reparent(byId, index, 'sa2', 'sv1');
    expect(result).toEqual(
      expect.objectContaining({ success: false, code: 'INVALID_PARENT_ROLE' }),
    );
  });

  it('rejects not-found node', () => {
    const { byId, index } = buildTestTree();
    const result = reparent(byId, index, 'nonexistent', 'sa1');
    expect(result).toEqual(
      expect.objectContaining({ success: false, code: 'NOT_FOUND' }),
    );
  });
});

// ─── getValidParents ───────────────────────────────────────────────

describe('getValidParents', () => {
  it('excludes self', () => {
    const { byId, index } = buildTestTree();
    const gv1 = byId['gv1']!;
    const valid = getValidParents(gv1, { actorId: 'admin', byId, index });
    expect(valid).not.toContain('gv1');
  });

  it('excludes current parent', () => {
    const { byId, index } = buildTestTree();
    const gv1 = byId['gv1']!;
    const valid = getValidParents(gv1, { actorId: 'admin', byId, index });
    expect(valid).not.toContain('sa1');
  });

  it('excludes own descendants', () => {
    const { byId, index } = buildTestTree();
    const gv1 = byId['gv1']!;
    const valid = getValidParents(gv1, { actorId: 'admin', byId, index });
    expect(valid).not.toContain('sv1');
    expect(valid).not.toContain('sv2');
    expect(valid).not.toContain('da1');
  });

  it('excludes role-invalid parents', () => {
    const { byId, index } = buildTestTree();
    // GROUP_VENDOR can only go under SITE_ADMIN
    const gv1 = byId['gv1']!;
    const valid = getValidParents(gv1, { actorId: 'admin', byId, index });
    // admin is ADMIN whose allowedChildRoles = [SITE_ADMIN], not GROUP_VENDOR
    expect(valid).not.toContain('admin');
  });

  it('includes valid targets', () => {
    const { byId, index } = buildTestTree();
    const gv1 = byId['gv1']!;
    const valid = getValidParents(gv1, { actorId: 'admin', byId, index });
    // sa2 is a SITE_ADMIN and can accept GROUP_VENDOR
    expect(valid).toContain('sa2');
  });

  it('excludes suspended vendors', () => {
    const { byId, index } = buildTestTree();
    byId['sa2']!.status = 'SUSPENDED';
    const gv1 = byId['gv1']!;
    const valid = getValidParents(gv1, { actorId: 'admin', byId, index });
    expect(valid).not.toContain('sa2');
  });

  it('scopes to actor subtree for non-admin actors', () => {
    const { byId, index } = buildTestTree();
    // da1 is a DA under sv1 — as actor sa1, should still see gv2 area
    // but sv1 (SUB_VENDOR) looking at da1, da1 can go under SUB_VENDORs
    const da1 = byId['da1']!;
    const validFromSv1 = getValidParents(da1, { actorId: 'sv1', byId, index });
    // sv1 only sees its own subtree — da1's current parent is sv1 (excluded),
    // and no other SUB_VENDORs exist in sv1's subtree
    expect(validFromSv1).not.toContain('gv1');
    expect(validFromSv1).not.toContain('sa1');
  });
});

// ─── assertTreeInvariants ──────────────────────────────────────────

describe('assertTreeInvariants', () => {
  it('passes for a valid tree', () => {
    const { byId, index } = buildTestTree();
    expect(() => assertTreeInvariants(byId, index)).not.toThrow();
  });

  it('fails for multiple roots', () => {
    const { byId, index } = buildTestTree();
    byId['sa1']!.parentId = null;
    expect(() => assertTreeInvariants(byId, index)).toThrow(/Expected 1 root/);
  });

  it('fails for broken parent ref', () => {
    const { byId, index } = buildTestTree();
    byId['sa1']!.parentId = 'nonexistent';
    expect(() => assertTreeInvariants(byId, index)).toThrow(/Broken parent ref/);
  });

  it('holds after random sequence of 500 valid moves on 200-node tree', () => {
    // Build a 200-node tree with valid role hierarchy
    const byId: VendorMap = {};
    byId['admin'] = makeVendor({ id: 'admin', role: 'ADMIN', parentId: null });

    // 10 site admins
    for (let i = 0; i < 10; i++) {
      byId[`sa${i}`] = makeVendor({ id: `sa${i}`, role: 'SITE_ADMIN', parentId: 'admin' });
    }
    // 40 group vendors (4 per site admin)
    for (let i = 0; i < 40; i++) {
      byId[`gv${i}`] = makeVendor({
        id: `gv${i}`,
        role: 'GROUP_VENDOR',
        parentId: `sa${i % 10}`,
      });
    }
    // 100 sub vendors
    for (let i = 0; i < 100; i++) {
      byId[`sv${i}`] = makeVendor({
        id: `sv${i}`,
        role: 'SUB_VENDOR',
        parentId: `gv${i % 40}`,
      });
    }
    // 49 deployment associates
    for (let i = 0; i < 49; i++) {
      byId[`da${i}`] = makeVendor({
        id: `da${i}`,
        role: 'DEPLOYMENT_ASSOCIATE',
        parentId: `sv${i % 100}`,
      });
    }

    let index = buildChildrenIndex(byId);

    // Perform 500 random valid moves
    const ids = Object.keys(byId);
    let seed = 42;
    const prng = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return seed / 2147483647;
    };

    let moveCount = 0;
    let attempts = 0;
    while (moveCount < 500 && attempts < 5000) {
      attempts++;
      const nodeId = ids[Math.floor(prng() * ids.length)]!;
      const node = byId[nodeId]!;
      if (node.role === 'ADMIN') continue; // can't move root

      const validParents = getValidParents(node, { actorId: 'admin', byId, index });
      if (validParents.length === 0) continue;

      const newParentId = validParents[Math.floor(prng() * validParents.length)]!;
      const result = reparent(byId, index, nodeId, newParentId);
      if (result.success) moveCount++;
    }

    expect(moveCount).toBeGreaterThanOrEqual(100); // sanity: we did a meaningful number
    expect(() => assertTreeInvariants(byId, index)).not.toThrow();
  });
});
