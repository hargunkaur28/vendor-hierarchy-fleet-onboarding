import type { Vendor } from '@/types';
import { ROLE_CONFIG } from '@/config/roles';
import { isDescendantOf } from './tree';

export interface SeniorityCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Checks whether an actor has sufficient seniority to override/unblock/reactivate
 * an action performed by blockerVendorId.
 *
 * Rules per Spec Section 8.4:
 * 1. An actor can always undo their own override (actorId === blockerVendorId).
 * 2. An actor can undo an override if they are an ancestor of the blocker in the hierarchy.
 * 3. An actor can undo an override if their role rank is strictly lower (more senior)
 *    than the blocker's role rank (ROLE_CONFIG[actor.role].rank < ROLE_CONFIG[blocker.role].rank).
 *
 * @complexity O(d) where d is tree depth for ancestor walk
 */
export function canActorOverrideOrReactivate(
  actorId: string,
  blockerVendorId: string,
  vendorsById: Record<string, Vendor>,
): SeniorityCheckResult {
  if (actorId === blockerVendorId) {
    return { allowed: true };
  }

  const actor = vendorsById[actorId];
  const blocker = vendorsById[blockerVendorId];

  if (!actor) {
    return { allowed: false, reason: 'Actor not found.' };
  }

  // If blocker no longer exists or wasn't recorded, root admin can always unblock
  if (!blocker) {
    if (actor.role === 'ADMIN') return { allowed: true };
    return { allowed: false, reason: 'Original supervisor not found.' };
  }

  // Admin can always override any lower role
  if (actor.role === 'ADMIN') {
    return { allowed: true };
  }

  // Check if actor is an ancestor of the blocker in the hierarchy
  if (isDescendantOf(blockerVendorId, actorId, vendorsById)) {
    return { allowed: true };
  }

  // Check role rank seniority (lower number = more senior: Admin:0, Site Admin:1, Group Vendor:2, Sub Vendor:3, DA:4)
  const actorRank = ROLE_CONFIG[actor.role]?.rank ?? 99;
  const blockerRank = ROLE_CONFIG[blocker.role]?.rank ?? 99;

  if (actorRank < blockerRank) {
    return { allowed: true };
  }

  const blockerLabel = blocker.name
    ? `${blocker.name} (${ROLE_CONFIG[blocker.role]?.label ?? blocker.role})`
    : 'a senior supervisor';

  return {
    allowed: false,
    reason: `Only ${blockerLabel} or a more senior supervisor can undo this override.`,
  };
}
