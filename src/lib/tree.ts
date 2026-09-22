import type { Vendor } from '@/types';
import { isRoleAllowedUnder } from '@/config/roles';

// ─── Types ─────────────────────────────────────────────────────────

export type VendorMap = Record<string, Vendor>;
export type ChildrenIndex = Record<string, string[]>;

// ─── Index Building ────────────────────────────────────────────────

/**
 * Builds a parentId → childIds[] adjacency index from a flat vendor map.
 * Every parent key is guaranteed to exist (even if empty array).
 * @complexity Time O(n), Space O(n) where n = number of vendors
 */
export function buildChildrenIndex(byId: VendorMap): ChildrenIndex {
  const index: ChildrenIndex = {};
  for (const id of Object.keys(byId)) {
    index[id] = [];
  }
  for (const vendor of Object.values(byId)) {
    if (vendor.parentId !== null) {
      const siblings = index[vendor.parentId];
      if (siblings) {
        siblings.push(vendor.id);
      }
    }
  }
  return index;
}

// ─── Traversal ─────────────────────────────────────────────────────

/**
 * Returns the ancestor chain from `id` to root (exclusive of `id`, inclusive of root).
 * @complexity Time O(d), Space O(d) where d = tree depth
 */
export function getAncestors(id: string, byId: VendorMap): Vendor[] {
  const ancestors: Vendor[] = [];
  let current = byId[id];
  while (current?.parentId !== null && current?.parentId !== undefined) {
    const parent = byId[current.parentId];
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }
  return ancestors;
}

/**
 * Checks if `candidateId` is a descendant of `ancestorId`.
 * Walks up from candidate — O(d) time, O(1) space.
 */
export function isDescendantOf(
  candidateId: string,
  ancestorId: string,
  byId: VendorMap,
): boolean {
  let current = byId[candidateId];
  while (current?.parentId !== null && current?.parentId !== undefined) {
    if (current.parentId === ancestorId) return true;
    current = byId[current.parentId];
  }
  return false;
}

/**
 * Returns all descendant IDs of `id` using iterative BFS.
 * Iterative to avoid stack overflow on deep trees (tested with 10k depth).
 * @complexity Time O(k), Space O(k) where k = subtree size
 */
export function getDescendantIds(id: string, index: ChildrenIndex): string[] {
  const result: string[] = [];
  const stack = index[id]?.slice() ?? [];
  while (stack.length > 0) {
    const childId = stack.pop()!;
    result.push(childId);
    const grandchildren = index[childId];
    if (grandchildren) {
      for (const gc of grandchildren) {
        stack.push(gc);
      }
    }
  }
  return result;
}

// ─── Cycle Detection ───────────────────────────────────────────────

/**
 * Returns true if moving `nodeId` under `newParentId` would create a cycle.
 * A cycle exists if newParentId === nodeId OR nodeId is an ancestor of newParentId.
 *
 * Walks up from newParentId checking if we hit nodeId — O(d) time, O(1) space.
 * This is the shared check used by both UI (to disable invalid targets) and
 * the API layer (defense in depth). Fix this function, not each call site.
 */
export function wouldCreateCycle(
  nodeId: string,
  newParentId: string,
  byId: VendorMap,
): boolean {
  if (newParentId === nodeId) return true;
  // Walk up from newParentId. If we hit nodeId, it's a cycle.
  let current = byId[newParentId];
  while (current?.parentId !== null && current?.parentId !== undefined) {
    if (current.parentId === nodeId) return true;
    current = byId[current.parentId];
  }
  return false;
}

// ─── Valid Parents ─────────────────────────────────────────────────

export interface GetValidParentsContext {
  actorId: string;
  byId: VendorMap;
  index: ChildrenIndex;
}

/**
 * Returns vendor IDs that are valid new parents for `node`.
 * Excludes: self, current parent, own descendants, role-invalid, suspended,
 * and vendors outside the actor's authority (not in actor's subtree).
 *
 * Uses one pass over candidates + a precomputed descendant Set.
 * @complexity Time O(n), Space O(k) where k = node's subtree size
 */
export function getValidParents(
  node: Vendor,
  ctx: GetValidParentsContext,
): string[] {
  // Precompute descendants of the node being moved (they can't be parents)
  const descendantSet = new Set(getDescendantIds(node.id, ctx.index));

  // Determine actor's scope: admin sees all, others see own subtree
  const actorScope = getActorScope(ctx.actorId, ctx.byId, ctx.index);

  const valid: string[] = [];
  for (const candidate of Object.values(ctx.byId)) {
    // Skip self
    if (candidate.id === node.id) continue;
    // Skip current parent (SAME_PARENT)
    if (candidate.id === node.parentId) continue;
    // Skip own descendants (would create cycle)
    if (descendantSet.has(candidate.id)) continue;
    // Skip if candidate's role doesn't allow this node's role as child
    if (!isRoleAllowedUnder(node.role, candidate.role)) continue;
    // Skip suspended vendors
    if (candidate.status === 'SUSPENDED') continue;
    // Skip if candidate is outside actor's scope
    if (actorScope !== null && !actorScope.has(candidate.id)) continue;

    valid.push(candidate.id);
  }

  return valid;
}

/**
 * Returns the set of vendor IDs in the actor's subtree (including actor),
 * or null if actor is ADMIN (sees everything).
 */
function getActorScope(
  actorId: string,
  byId: VendorMap,
  index: ChildrenIndex,
): Set<string> | null {
  const actor = byId[actorId];
  if (!actor || actor.role === 'ADMIN') return null;
  const descendants = getDescendantIds(actorId, index);
  return new Set([actorId, ...descendants]);
}

// ─── Reparent ──────────────────────────────────────────────────────

export interface ReparentResult {
  success: true;
  previousParentId: string;
  descendantCount: number;
}

export interface ReparentError {
  success: false;
  code: 'CYCLE_DETECTED' | 'INVALID_PARENT_ROLE' | 'SAME_PARENT' | 'NOT_FOUND';
  message: string;
}

/**
 * Validates and performs a reparent operation, mutating `byId` and `index` in place.
 *
 * Key insight: descendants move implicitly because they reference their parent by id.
 * Moving a subtree is one pointer change — no per-descendant rewrite needed.
 *
 * @complexity Validation O(d), array patch O(c) where c = old parent's child count
 */
export function reparent(
  byId: VendorMap,
  index: ChildrenIndex,
  nodeId: string,
  newParentId: string,
): ReparentResult | ReparentError {
  const node = byId[nodeId];
  const newParent = byId[newParentId];

  if (!node) return { success: false, code: 'NOT_FOUND', message: `Vendor ${nodeId} not found` };
  if (!newParent) return { success: false, code: 'NOT_FOUND', message: `Parent ${newParentId} not found` };

  if (node.parentId === newParentId) {
    return { success: false, code: 'SAME_PARENT', message: `${node.name} is already under ${newParent.name}` };
  }

  if (wouldCreateCycle(nodeId, newParentId, byId)) {
    return { success: false, code: 'CYCLE_DETECTED', message: "A vendor can't be moved under itself or one of its own team members." };
  }

  if (!isRoleAllowedUnder(node.role, newParent.role)) {
    return { success: false, code: 'INVALID_PARENT_ROLE', message: `A ${node.role} can only be placed under a ${newParent.role}` };
  }

  const previousParentId = node.parentId!;
  const descendantCount = getDescendantIds(nodeId, index).length;

  // Remove from old parent's children
  const oldSiblings = index[previousParentId];
  if (oldSiblings) {
    const idx = oldSiblings.indexOf(nodeId);
    if (idx !== -1) oldSiblings.splice(idx, 1);
  }

  // Add to new parent's children
  if (!index[newParentId]) index[newParentId] = [];
  index[newParentId]!.push(nodeId);

  // Update the node's parentId
  node.parentId = newParentId;

  return { success: true, previousParentId, descendantCount };
}

// ─── Invariant Checker (dev/test only) ─────────────────────────────

/**
 * Asserts structural invariants of the tree:
 * 1. Exactly one root (parentId === null)
 * 2. Every parentId references an existing vendor
 * 3. childrenIndex is in sync with parentId pointers
 * 4. No cycles (every walk-to-root terminates)
 * 5. Every vendor is reachable from the root
 *
 * @throws Error with specific invariant violation message
 * @complexity O(n·d) worst case (n walks of depth d)
 */
export function assertTreeInvariants(byId: VendorMap, index: ChildrenIndex): void {
  const ids = Object.keys(byId);
  const roots: string[] = [];

  // Check 1 & 2: single root, valid parentId refs
  for (const vendor of Object.values(byId)) {
    if (vendor.parentId === null) {
      roots.push(vendor.id);
    } else if (!byId[vendor.parentId]) {
      throw new Error(`Broken parent ref: ${vendor.id} → ${vendor.parentId} (not found)`);
    }
  }

  if (roots.length !== 1) {
    throw new Error(`Expected 1 root, found ${roots.length}: [${roots.join(', ')}]`);
  }

  // Check 3: index in sync
  for (const [parentId, childIds] of Object.entries(index)) {
    for (const childId of childIds) {
      const child = byId[childId];
      if (!child) throw new Error(`Index references missing vendor: ${childId}`);
      if (child.parentId !== parentId) {
        throw new Error(`Index says ${childId} is child of ${parentId}, but parentId = ${child.parentId}`);
      }
    }
  }

  // Reverse check: every vendor with a parentId appears in their parent's children
  for (const vendor of Object.values(byId)) {
    if (vendor.parentId !== null) {
      const siblings = index[vendor.parentId];
      if (!siblings?.includes(vendor.id)) {
        throw new Error(`${vendor.id} has parentId=${vendor.parentId} but is not in parent's children index`);
      }
    }
  }

  // Check 4: no cycles (every vendor reaches root in ≤ n steps)
  const maxSteps = ids.length;
  for (const vendor of Object.values(byId)) {
    let current: Vendor | undefined = vendor;
    let steps = 0;
    while (current?.parentId !== null && current?.parentId !== undefined) {
      steps++;
      if (steps > maxSteps) {
        throw new Error(`Cycle detected: walk from ${vendor.id} did not reach root in ${maxSteps} steps`);
      }
      current = byId[current.parentId];
    }
  }

  // Check 5: all reachable from root
  const rootId = roots[0]!;
  const reachable = new Set([rootId, ...getDescendantIds(rootId, index)]);
  for (const id of ids) {
    if (!reachable.has(id)) {
      throw new Error(`Vendor ${id} is not reachable from root ${rootId}`);
    }
  }
}
