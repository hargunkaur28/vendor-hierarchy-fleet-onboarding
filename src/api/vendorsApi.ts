import type { Vendor, RoleKey, PermissionKey } from '@/types';
import { simulateNetwork, recordAudit } from './client';
import { AppError } from './errors';
import { isRoleAllowedUnder } from '@/config/roles';
import { wouldCreateCycle, buildChildrenIndex } from '@/lib/tree';
import { authorize, canGrant } from '@/lib/permissions';

export interface MoveVendorParams {
  vendorId: string;
  newParentId: string;
  actorId: string;
}

export interface ChangeRoleParams {
  vendorId: string;
  newRole: RoleKey;
  actorId: string;
}

export interface CreateVendorParams {
  vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>;
  actorId: string;
}

export interface UpdateVendorParams {
  vendorId: string;
  updates: Partial<Pick<Vendor, 'name' | 'email' | 'phone' | 'tags'>>;
  actorId: string;
}

export interface SuspendVendorParams {
  vendorId: string;
  reason: string;
  actorId: string;
}

export const vendorsApi = {
  async listVendors(): Promise<Vendor[]> {
    return simulateNetwork((db) => Object.values(db.vendors));
  },

  async getVendor(id: string): Promise<Vendor> {
    return simulateNetwork((db) => {
      const vendor = db.vendors[id];
      if (!vendor) throw new AppError('VENDOR_NOT_FOUND');
      return vendor;
    });
  },

  async moveVendor({ vendorId, newParentId, actorId }: MoveVendorParams): Promise<Vendor> {
    return simulateNetwork((db) => {
      const vendor = db.vendors[vendorId];
      if (!vendor) throw new AppError('VENDOR_NOT_FOUND');

      if (vendor.role === 'ADMIN' || vendor.parentId === null) {
        throw new AppError('ROOT_VENDOR_IMMUTABLE');
      }

      if (vendor.parentId === newParentId) {
        return vendor; // no-op
      }

      const newParent = db.vendors[newParentId];
      if (!newParent) {
        throw new AppError('PARENT_NOT_FOUND');
      }

      if (newParent.status === 'SUSPENDED') {
        throw new AppError('SUSPENDED_PARENT');
      }

      if (wouldCreateCycle(vendorId, newParentId, db.vendors)) {
        throw new AppError('CYCLE_DETECTED');
      }

      if (!isRoleAllowedUnder(vendor.role, newParent.role)) {
        throw new AppError('ROLE_RESTRICTION');
      }

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'MANAGE_TEAM',
          targetVendorId: vendorId,
        },
        db.vendors,
        delegations,
      );

      if (!auth.allowed) {
        if (auth.code === 'ACCOUNT_SUSPENDED') {
          throw new AppError('SUSPENDED_ANCESTOR', auth.message);
        }
        if (auth.code === 'OUT_OF_SCOPE') {
          throw new AppError('OUT_OF_SCOPE', auth.message);
        }
        throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);
      }

      const oldParentId = vendor.parentId;
      vendor.parentId = newParentId;
      vendor.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'MOVE_VENDOR',
        targetType: 'VENDOR',
        targetId: vendorId,
        details: { oldParentId, newParentId },
      });

      return vendor;
    });
  },

  async changeRole({ vendorId, newRole, actorId }: ChangeRoleParams): Promise<Vendor> {
    return simulateNetwork((db) => {
      const vendor = db.vendors[vendorId];
      if (!vendor) throw new AppError('VENDOR_NOT_FOUND');
      if (vendor.role === 'ADMIN') throw new AppError('ROOT_VENDOR_IMMUTABLE');

      if (vendor.parentId) {
        const parent = db.vendors[vendor.parentId];
        if (parent && !isRoleAllowedUnder(newRole, parent.role)) {
          throw new AppError('ROLE_RESTRICTION');
        }
      }

      // Check all children are valid under new role
      const childrenIndex = buildChildrenIndex(db.vendors);
      const childIds = childrenIndex[vendorId] ?? [];
      for (const childId of childIds) {
        const child = db.vendors[childId];
        if (child && !isRoleAllowedUnder(child.role, newRole)) {
          throw new AppError(
            'ROLE_RESTRICTION',
            `Cannot change role: child ${child.name} (${child.role}) cannot report to ${newRole}`,
          );
        }
      }

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'MANAGE_TEAM',
          targetVendorId: vendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      const oldRole = vendor.role;
      vendor.role = newRole;
      vendor.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'CHANGE_ROLE',
        targetType: 'VENDOR',
        targetId: vendorId,
        details: { oldRole, newRole },
      });

      return vendor;
    });
  },

  async createVendor({ vendor, actorId }: CreateVendorParams): Promise<Vendor> {
    return simulateNetwork((db) => {
      if (vendor.parentId) {
        const parent = db.vendors[vendor.parentId];
        if (!parent) throw new AppError('PARENT_NOT_FOUND');
        if (!isRoleAllowedUnder(vendor.role, parent.role)) {
          throw new AppError('ROLE_RESTRICTION');
        }
      }

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'MANAGE_TEAM',
          targetVendorId: vendor.parentId ?? actorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      const id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const newVendor: Vendor = {
        ...vendor,
        id,
        createdAt: now,
        updatedAt: now,
      };

      db.vendors[id] = newVendor;

      recordAudit(db, {
        actorId,
        action: 'CREATE_VENDOR',
        targetType: 'VENDOR',
        targetId: id,
        details: { name: newVendor.name, role: newVendor.role, parentId: newVendor.parentId },
      });

      return newVendor;
    });
  },

  async updateVendor({ vendorId, updates, actorId }: UpdateVendorParams): Promise<Vendor> {
    return simulateNetwork((db) => {
      const vendor = db.vendors[vendorId];
      if (!vendor) throw new AppError('VENDOR_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'MANAGE_TEAM',
          targetVendorId: vendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      Object.assign(vendor, updates);
      vendor.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'UPDATE_VENDOR',
        targetType: 'VENDOR',
        targetId: vendorId,
        details: updates,
      });

      return vendor;
    });
  },

  async suspendVendor({ vendorId, reason, actorId }: SuspendVendorParams): Promise<Vendor> {
    return simulateNetwork((db) => {
      const vendor = db.vendors[vendorId];
      if (!vendor) throw new AppError('VENDOR_NOT_FOUND');
      if (vendor.role === 'ADMIN') throw new AppError('ROOT_VENDOR_IMMUTABLE');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'MANAGE_TEAM',
          targetVendorId: vendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      vendor.status = 'SUSPENDED';
      vendor.suspendedBy = {
        vendorId: actorId,
        at: new Date().toISOString(),
        reason,
      };
      vendor.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'SUSPEND_VENDOR',
        targetType: 'VENDOR',
        targetId: vendorId,
        details: { reason },
      });

      return vendor;
    });
  },

  async reactivateVendor({ vendorId, actorId }: { vendorId: string; actorId: string }): Promise<Vendor> {
    return simulateNetwork((db) => {
      const vendor = db.vendors[vendorId];
      if (!vendor) throw new AppError('VENDOR_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'MANAGE_TEAM',
          targetVendorId: vendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      vendor.status = 'ACTIVE';
      delete vendor.suspendedBy;
      vendor.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'REACTIVATE_VENDOR',
        targetType: 'VENDOR',
        targetId: vendorId,
      });

      return vendor;
    });
  },

  async updateGrantedPermissions({
    vendorId,
    permissions,
    actorId,
  }: {
    vendorId: string;
    permissions: PermissionKey[];
    actorId: string;
  }): Promise<Vendor> {
    return simulateNetwork((db) => {
      const vendor = db.vendors[vendorId];
      if (!vendor) throw new AppError('VENDOR_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'MANAGE_TEAM',
          targetVendorId: vendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      for (const perm of permissions) {
        if (!canGrant(actorId, perm, db.vendors)) {
          throw new AppError(
            'INSUFFICIENT_PERMISSIONS',
            'Cannot grant permissions you do not effectively hold.',
          );
        }
      }

      vendor.grantedPermissions = permissions;
      vendor.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'UPDATE_PERMISSIONS',
        targetType: 'VENDOR',
        targetId: vendorId,
        details: { permissions },
      });

      return vendor;
    });
  },
};
