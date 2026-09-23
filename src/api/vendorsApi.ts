import type { Vendor, RoleKey, PermissionKey } from '@/types';
import { simulateNetwork, recordAudit } from './client';
import { AppError } from './errors';
import { isRoleAllowedUnder } from '@/config/roles';
import { wouldCreateCycle, buildChildrenIndex } from '@/lib/tree';
import { authorize, canGrant } from '@/lib/permissions';
import { canActorOverrideOrReactivate } from '@/lib/seniority';

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
      if (!vendor) throw new AppError('NOT_FOUND', 'Vendor not found.');
      return vendor;
    });
  },

  async moveVendor({ vendorId, newParentId, actorId }: MoveVendorParams): Promise<Vendor> {
    return simulateNetwork((db) => {
      const vendor = db.vendors[vendorId];
      if (!vendor) throw new AppError('NOT_FOUND', 'Vendor not found.');

      if (vendor.role === 'ADMIN' || vendor.parentId === null) {
        throw new AppError('PERMISSION_DENIED', 'Root vendor cannot be moved, suspended, or modified.');
      }

      if (vendor.parentId === newParentId) {
        throw new AppError('SAME_PARENT');
      }

      const newParent = db.vendors[newParentId];
      if (!newParent) {
        throw new AppError('NOT_FOUND', 'Selected parent vendor does not exist.');
      }

      if (newParent.status === 'SUSPENDED') {
        throw new AppError('ACCOUNT_SUSPENDED', 'Cannot move under a suspended parent vendor.');
      }

      if (wouldCreateCycle(vendorId, newParentId, db.vendors)) {
        throw new AppError('CYCLE_DETECTED');
      }

      if (!isRoleAllowedUnder(vendor.role, newParent.role)) {
        throw new AppError('INVALID_PARENT_ROLE');
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
          throw new AppError('ACCOUNT_SUSPENDED', auth.message);
        }
        if (auth.code === 'OUT_OF_SCOPE') {
          throw new AppError('OUT_OF_SCOPE', auth.message);
        }
        throw new AppError('PERMISSION_DENIED', auth.message);
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
      if (!vendor) throw new AppError('NOT_FOUND', 'Vendor not found.');
      if (vendor.role === 'ADMIN') {
        throw new AppError('PERMISSION_DENIED', 'Root vendor cannot be moved, suspended, or modified.');
      }

      if (vendor.parentId) {
        const parent = db.vendors[vendor.parentId];
        if (parent && !isRoleAllowedUnder(newRole, parent.role)) {
          throw new AppError('INVALID_PARENT_ROLE');
        }
      }

      // Check all children are valid under new role
      const childrenIndex = buildChildrenIndex(db.vendors);
      const childIds = childrenIndex[vendorId] ?? [];
      for (const childId of childIds) {
        const child = db.vendors[childId];
        if (child && !isRoleAllowedUnder(child.role, newRole)) {
          throw new AppError(
            'ROLE_CHANGE_CONFLICT',
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
      if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);

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
        if (!parent) throw new AppError('NOT_FOUND', 'Parent vendor does not exist.');
        if (!isRoleAllowedUnder(vendor.role, parent.role)) {
          throw new AppError('INVALID_PARENT_ROLE');
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
      if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);

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
      if (!vendor) throw new AppError('NOT_FOUND', 'Vendor not found.');

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
      if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);

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
      if (!vendor) throw new AppError('NOT_FOUND', 'Vendor not found.');
      if (vendor.role === 'ADMIN') {
        throw new AppError('PERMISSION_DENIED', 'Root vendor cannot be moved, suspended, or modified.');
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
      if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);

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
      if (!vendor) throw new AppError('NOT_FOUND', 'Vendor not found.');

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
      if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);

      // Section 8.4 seniority check: only original suspender or more senior ancestor can reactivate
      if (vendor.suspendedBy) {
        const seniority = canActorOverrideOrReactivate(actorId, vendor.suspendedBy.vendorId, db.vendors);
        if (!seniority.allowed) {
          throw new AppError('PERMISSION_DENIED', seniority.reason ?? 'Insufficient seniority to reactivate vendor.');
        }
      }

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
      if (!vendor) throw new AppError('NOT_FOUND', 'Vendor not found.');

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
      if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);

      for (const perm of permissions) {
        if (!canGrant(actorId, perm, db.vendors)) {
          throw new AppError(
            'PERMISSION_DENIED',
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
