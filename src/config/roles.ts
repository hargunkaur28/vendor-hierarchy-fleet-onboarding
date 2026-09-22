import type { RoleKey, PermissionKey } from '@/types';

export interface RoleConfig {
  label: string;
  /** Tailwind color class prefix, e.g. 'role-admin' → bg-role-admin */
  colorToken: string;
  /** Hex value for programmatic use (avatars, canvas) */
  colorHex: string;
  /** Lower = more senior. Used for rank comparisons, not hierarchy depth. */
  rank: number;
  /** Roles that may be direct children of this role */
  allowedChildRoles: RoleKey[];
  /** Whether the "Move Profile" button shows on this role's card */
  movable: boolean;
  /** Label for the parent role in modal copy, e.g. "site admin" */
  parentRoleLabel: string | null;
  /** Default permissions granted when a vendor of this role is created */
  defaultPermissions: PermissionKey[];
}

export const ROLE_CONFIG: Record<RoleKey, RoleConfig> = {
  ADMIN: {
    label: 'Admin',
    colorToken: 'role-admin',
    colorHex: '#6D4AFF',
    rank: 0,
    allowedChildRoles: ['SITE_ADMIN'],
    movable: false,
    parentRoleLabel: null,
    defaultPermissions: [
      'MANAGE_TEAM',
      'ONBOARD_FLEET',
      'ONBOARD_DRIVERS',
      'VERIFY_DOCUMENTS',
      'MANAGE_BOOKINGS',
      'MANAGE_PAYMENTS',
    ],
  },
  SITE_ADMIN: {
    label: 'Site Admin',
    colorToken: 'role-site-admin',
    colorHex: '#F04E23',
    rank: 1,
    allowedChildRoles: ['GROUP_VENDOR', 'SUB_VENDOR'],
    movable: false,
    parentRoleLabel: 'admin',
    defaultPermissions: [
      'MANAGE_TEAM',
      'ONBOARD_FLEET',
      'ONBOARD_DRIVERS',
      'VERIFY_DOCUMENTS',
      'MANAGE_BOOKINGS',
      'MANAGE_PAYMENTS',
    ],
  },
  GROUP_VENDOR: {
    label: 'Group Vendor',
    colorToken: 'role-group-vendor',
    colorHex: '#0EA5A0',
    rank: 2,
    allowedChildRoles: ['SUB_VENDOR', 'DEPLOYMENT_ASSOCIATE'],
    movable: true,
    parentRoleLabel: 'site admin',
    defaultPermissions: [
      'MANAGE_TEAM',
      'ONBOARD_FLEET',
      'ONBOARD_DRIVERS',
      'VERIFY_DOCUMENTS',
      'MANAGE_BOOKINGS',
    ],
  },
  SUB_VENDOR: {
    label: 'Sub Vendor',
    colorToken: 'role-sub-vendor',
    colorHex: '#E0389B',
    rank: 3,
    allowedChildRoles: ['SUB_VENDOR', 'DEPLOYMENT_ASSOCIATE'],
    movable: true,
    parentRoleLabel: 'group vendor',
    defaultPermissions: [
      'ONBOARD_FLEET',
      'ONBOARD_DRIVERS',
      'VERIFY_DOCUMENTS',
    ],
  },
  DEPLOYMENT_ASSOCIATE: {
    label: 'Deployment Associate',
    colorToken: 'role-deployment-assoc',
    colorHex: '#8B1E3F',
    rank: 4,
    allowedChildRoles: [],
    movable: true,
    parentRoleLabel: 'sub vendor',
    defaultPermissions: ['ONBOARD_DRIVERS'],
  },
};

/** All role keys in rank order */
export const ROLE_KEYS: RoleKey[] = [
  'ADMIN',
  'SITE_ADMIN',
  'GROUP_VENDOR',
  'SUB_VENDOR',
  'DEPLOYMENT_ASSOCIATE',
];

/**
 * Returns roles whose `allowedChildRoles` include the given role.
 * Used to determine valid parents for a vendor of a given role.
 * @complexity O(R) where R = number of roles (5, constant)
 */
export function getValidParentRoles(role: RoleKey): RoleKey[] {
  return ROLE_KEYS.filter((r) => ROLE_CONFIG[r].allowedChildRoles.includes(role));
}

/**
 * Checks whether `childRole` is a valid direct child of `parentRole`.
 * @complexity O(C) where C = allowedChildRoles.length (≤ 2, constant)
 */
export function isRoleAllowedUnder(childRole: RoleKey, parentRole: RoleKey): boolean {
  return ROLE_CONFIG[parentRole].allowedChildRoles.includes(childRole);
}
