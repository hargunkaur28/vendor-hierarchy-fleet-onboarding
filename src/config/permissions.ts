import type { PermissionKey } from '@/types';

export interface PermissionConfig {
  label: string;
  description: string;
}

export const PERMISSION_CONFIG: Record<PermissionKey, PermissionConfig> = {
  MANAGE_TEAM: {
    label: 'Manage Team',
    description: 'Move profiles, change roles, add/remove sub-vendors',
  },
  ONBOARD_FLEET: {
    label: 'Onboard Fleet',
    description: 'Create and edit vehicles',
  },
  ONBOARD_DRIVERS: {
    label: 'Onboard Drivers',
    description: 'Create and edit drivers, assign to vehicles',
  },
  VERIFY_DOCUMENTS: {
    label: 'Verify Documents',
    description: 'Approve/reject documents, compliance tracking',
  },
  MANAGE_BOOKINGS: {
    label: 'Manage Bookings',
    description: 'View and manage ride bookings',
  },
  MANAGE_PAYMENTS: {
    label: 'Manage Payments',
    description: 'View and manage payment records',
  },
};

export const ALL_PERMISSIONS: PermissionKey[] = Object.keys(
  PERMISSION_CONFIG,
) as PermissionKey[];
