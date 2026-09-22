import type { Delegation, PermissionKey } from '@/types';
import { simulateNetwork, recordAudit } from './client';
import { AppError } from './errors';
import { authorize } from '@/lib/permissions';

export interface CreateDelegationParams {
  delegatorId: string;
  delegateId: string;
  scope: PermissionKey[];
  actorId: string;
  expiresAt?: string;
  scopeVendorIds?: string[];
}

export const delegationApi = {
  async listDelegations(filter?: { delegatorId?: string; delegateId?: string }): Promise<Delegation[]> {
    return simulateNetwork((db) => {
      let list = Object.values(db.delegations);
      if (filter?.delegatorId) {
        list = list.filter((d) => d.delegatorId === filter.delegatorId);
      }
      if (filter?.delegateId) {
        list = list.filter((d) => d.delegateId === filter.delegateId);
      }
      return list;
    });
  },

  async createDelegation({
    delegatorId,
    delegateId,
    scope,
    actorId,
  }: CreateDelegationParams): Promise<Delegation> {
    return simulateNetwork((db) => {
      if (actorId !== delegatorId) {
        const delegations = Object.values(db.delegations);
        const auth = authorize(
          {
            actorId,
            permission: 'MANAGE_TEAM',
            targetVendorId: delegatorId,
          },
          db.vendors,
          delegations,
        );
        if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);
      }

      if (!db.vendors[delegatorId] || !db.vendors[delegateId]) {
        throw new AppError('NOT_FOUND', 'Vendor not found.');
      }

      const id = `del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const newDelegation: Delegation = {
        id,
        delegatorId,
        delegateId,
        scope,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };

      db.delegations[id] = newDelegation;

      recordAudit(db, {
        actorId,
        action: 'CREATE_DELEGATION',
        targetType: 'DELEGATION',
        targetId: id,
        details: { delegatorId, delegateId, scope },
      });

      return newDelegation;
    });
  },

  async toggleDelegation({
    delegationId,
    enabled,
    actorId,
  }: {
    delegationId: string;
    enabled: boolean;
    actorId: string;
  }): Promise<Delegation> {
    return simulateNetwork((db) => {
      const delegation = db.delegations[delegationId];
      if (!delegation) throw new AppError('NOT_FOUND', 'Delegation record not found.');

      if (actorId !== delegation.delegatorId) {
        const delegations = Object.values(db.delegations);
        const auth = authorize(
          {
            actorId,
            permission: 'MANAGE_TEAM',
            targetVendorId: delegation.delegatorId,
          },
          db.vendors,
          delegations,
        );
        if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);
      }

      delegation.enabled = enabled;
      delegation.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'TOGGLE_DELEGATION',
        targetType: 'DELEGATION',
        targetId: delegationId,
        details: { enabled },
      });

      return delegation;
    });
  },

  async updateDelegationScope({
    delegationId,
    scope,
    actorId,
  }: {
    delegationId: string;
    scope: PermissionKey[];
    actorId: string;
  }): Promise<Delegation> {
    return simulateNetwork((db) => {
      const delegation = db.delegations[delegationId];
      if (!delegation) throw new AppError('NOT_FOUND', 'Delegation record not found.');

      if (actorId !== delegation.delegatorId) {
        const delegations = Object.values(db.delegations);
        const auth = authorize(
          {
            actorId,
            permission: 'MANAGE_TEAM',
            targetVendorId: delegation.delegatorId,
          },
          db.vendors,
          delegations,
        );
        if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);
      }

      delegation.scope = scope;
      delegation.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'UPDATE_DELEGATION_SCOPE',
        targetType: 'DELEGATION',
        targetId: delegationId,
        details: { scope },
      });

      return delegation;
    });
  },

  async deleteDelegation({
    delegationId,
    actorId,
  }: {
    delegationId: string;
    actorId: string;
  }): Promise<{ id: string }> {
    return simulateNetwork((db) => {
      const delegation = db.delegations[delegationId];
      if (!delegation) throw new AppError('NOT_FOUND', 'Delegation record not found.');

      if (actorId !== delegation.delegatorId) {
        const delegations = Object.values(db.delegations);
        const auth = authorize(
          {
            actorId,
            permission: 'MANAGE_TEAM',
            targetVendorId: delegation.delegatorId,
          },
          db.vendors,
          delegations,
        );
        if (!auth.allowed) throw new AppError('PERMISSION_DENIED', auth.message);
      }

      delete db.delegations[delegationId];

      recordAudit(db, {
        actorId,
        action: 'DELETE_DELEGATION',
        targetType: 'DELEGATION',
        targetId: delegationId,
      });

      return { id: delegationId };
    });
  },
};
