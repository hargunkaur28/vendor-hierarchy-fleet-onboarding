import type { Vendor, PermissionKey, AuthResult, Delegation } from '@/types';
import { ALL_PERMISSIONS } from '@/config/permissions';
import { isDescendantOf } from './tree';
import type { VendorMap } from './tree';

/**
 * Computes effective permissions for a vendor by intersecting granted permissions
 * up the ancestor chain: effective(V) = granted(V) ∩ effective(parent(V)),
 * with effective(root) = ALL_PERMISSIONS.
 *
 * This is the shared function — fix here, not at each call site.
 *
 * @complexity O(d·p) where d = depth, p = permission count (6, constant)
 */
export function getEffectivePermissions(
  vendorId: string,
  byId: VendorMap,
): PermissionKey[] {
  const vendor = byId[vendorId];
  if (!vendor) return [];

  // Root has all permissions
  if (vendor.parentId === null) return [...ALL_PERMISSIONS];

  // Walk up, intersecting at each level
  let effective = new Set<PermissionKey>(vendor.grantedPermissions);
  let current = byId[vendor.parentId];

  while (current) {
    if (current.parentId === null) {
      // Root — root has all, so intersection is just `effective` as-is
      break;
    }
    // Intersect with this ancestor's granted set
    const parentGranted = new Set<PermissionKey>(current.grantedPermissions);
    effective = new Set([...effective].filter((p) => parentGranted.has(p)));
    current = byId[current.parentId];
  }

  return [...effective];
}

/**
 * Checks whether `actorId` can grant `permission` to a child vendor.
 * A vendor can only grant permissions it effectively holds (no escalation).
 * @complexity O(d·p) via getEffectivePermissions
 */
export function canGrant(
  actorId: string,
  permission: PermissionKey,
  byId: VendorMap,
): boolean {
  return getEffectivePermissions(actorId, byId).includes(permission);
}

/**
 * Checks if any ancestor of `vendorId` is suspended.
 * A suspended ancestor blocks the entire subtree from acting.
 * @complexity O(d)
 */
export function hasActiveSuspendedAncestor(
  vendorId: string,
  byId: VendorMap,
): { suspended: false } | { suspended: true; by: Vendor } {
  let current = byId[vendorId];
  while (current?.parentId !== null && current?.parentId !== undefined) {
    const parent = byId[current.parentId];
    if (!parent) break;
    if (parent.status === 'SUSPENDED') {
      return { suspended: true, by: parent };
    }
    current = parent;
  }
  return { suspended: false };
}

export interface AuthorizeContext {
  actorId: string;
  permission: PermissionKey;
  targetVendorId: string;
  onBehalfOfId?: string;
}

/**
 * Central authorization function — single source of truth for all permission checks.
 * Both the UI (to hide/disable controls) and the mock API (defense in depth) call this.
 *
 * Rules evaluated in order:
 * 1. Actor exists and is ACTIVE, no suspended ancestor
 * 2. Target in actor's subtree (or self for self-service), ADMIN sees all
 * 3. If onBehalfOfId: valid enabled delegation with permission in scope
 * 4. Otherwise: permission in actor's effective set
 *
 * Fix this function, not each call site.
 *
 * @complexity O(d·p) dominated by getEffectivePermissions and ancestor walks
 */
export function authorize(
  ctx: AuthorizeContext,
  byId: VendorMap,
  delegations: Delegation[],
): AuthResult {
  const actor = byId[ctx.actorId];
  if (!actor) {
    return { allowed: false, code: 'NOT_FOUND', message: 'Actor not found.' };
  }

  // Rule 1: actor must be active, no suspended ancestor
  if (actor.status === 'SUSPENDED') {
    const reason = actor.suspendedBy?.reason ?? 'Unknown reason';
    const byName = actor.suspendedBy?.vendorId
      ? byId[actor.suspendedBy.vendorId]?.name ?? 'Unknown'
      : 'Unknown';
    return {
      allowed: false,
      code: 'ACCOUNT_SUSPENDED',
      message: `This account is suspended by ${byName}. Reason: ${reason}`,
    };
  }

  const suspendedAncestor = hasActiveSuspendedAncestor(ctx.actorId, byId);
  if (suspendedAncestor.suspended) {
    return {
      allowed: false,
      code: 'ACCOUNT_SUSPENDED',
      message: `This account is suspended by ${suspendedAncestor.by.name}. Reason: ${suspendedAncestor.by.suspendedBy?.reason ?? 'Unknown'}`,
    };
  }

  const target = byId[ctx.targetVendorId];
  if (!target) {
    return { allowed: false, code: 'NOT_FOUND', message: 'Target vendor not found.' };
  }

  // Rule 3: delegation path
  if (ctx.onBehalfOfId) {
    const delegator = byId[ctx.onBehalfOfId];
    if (!delegator) {
      return { allowed: false, code: 'DELEGATION_INVALID', message: 'Delegator not found.' };
    }

    // Find an enabled delegation from delegator to actor
    const delegation = delegations.find(
      (d) =>
        d.delegatorId === ctx.onBehalfOfId &&
        d.delegateId === ctx.actorId &&
        d.enabled,
    );
    if (!delegation) {
      return {
        allowed: false,
        code: 'DELEGATION_INVALID',
        message: 'Your delegation for this action is disabled or doesn\'t include it.',
      };
    }

    // Permission must be in delegation scope AND in delegator's effective permissions
    const delegatorEffective = getEffectivePermissions(ctx.onBehalfOfId, byId);
    if (
      !delegation.scope.includes(ctx.permission) ||
      !delegatorEffective.includes(ctx.permission)
    ) {
      return {
        allowed: false,
        code: 'PERMISSION_DENIED',
        message: `You don't have permission to ${ctx.permission.toLowerCase().replace(/_/g, ' ')}.`,
      };
    }

    // Target must be in delegator's subtree
    if (
      ctx.targetVendorId !== ctx.onBehalfOfId &&
      !isDescendantOf(ctx.targetVendorId, ctx.onBehalfOfId, byId)
    ) {
      return {
        allowed: false,
        code: 'OUT_OF_SCOPE',
        message: "That vendor isn't part of your delegator's network.",
      };
    }

    return { allowed: true, via: 'DELEGATION', onBehalfOfId: ctx.onBehalfOfId };
  }

  // Rule 2: target must be in actor's subtree (admin sees all)
  if (actor.role !== 'ADMIN') {
    if (
      ctx.targetVendorId !== ctx.actorId &&
      !isDescendantOf(ctx.targetVendorId, ctx.actorId, byId)
    ) {
      return {
        allowed: false,
        code: 'OUT_OF_SCOPE',
        message: "That vendor isn't part of your network.",
      };
    }
  }

  // Rule 4: permission in actor's effective set
  const effective = getEffectivePermissions(ctx.actorId, byId);
  if (!effective.includes(ctx.permission)) {
    return {
      allowed: false,
      code: 'PERMISSION_DENIED',
      message: `You don't have permission to ${ctx.permission.toLowerCase().replace(/_/g, ' ')}.`,
    };
  }

  return { allowed: true, via: 'OWN' };
}

/**
 * Finds which ancestor is blocking a specific permission for a vendor.
 * Returns the ancestor that doesn't have it in their granted set,
 * or null if no ancestor blocks it.
 * @complexity O(d)
 */
export function findPermissionBlocker(
  vendorId: string,
  permission: PermissionKey,
  byId: VendorMap,
): Vendor | null {
  let current = byId[vendorId];
  while (current?.parentId !== null && current?.parentId !== undefined) {
    const parent = byId[current.parentId];
    if (!parent) break;
    if (parent.parentId !== null && !parent.grantedPermissions.includes(permission)) {
      return parent;
    }
    current = parent;
  }
  return null;
}
