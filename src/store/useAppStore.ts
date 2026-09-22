import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type {
  Vendor,
  Vehicle,
  Driver,
  Delegation,
  AuditEntry,
  RoleKey,
  PermissionKey,
} from '@/types';
import { buildChildrenIndex, reparent, assertTreeInvariants } from '@/lib/tree';
import { vendorsApi } from '@/api/vendorsApi';
import { fleetApi } from '@/api/fleetApi';
import { documentsApi } from '@/api/documentsApi';
import type { UploadDocumentParams, ReviewDocumentParams } from '@/api/documentsApi';
import { delegationApi } from '@/api/delegationApi';
import type { CreateDelegationParams } from '@/api/delegationApi';
import { auditApi } from '@/api/auditApi';
import { devApiConfig, resetDb, loadDb } from '@/api/client';
import type { SearchFilters } from '@/lib/search';

enableMapSet();

export interface AppState {
  // ─── Status ───────────────────────────────────────────────────────
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // ─── Session ──────────────────────────────────────────────────────
  currentUserId: string;
  switchUser: (vendorId: string) => void;

  // ─── Vendors ──────────────────────────────────────────────────────
  vendorsById: Record<string, Vendor>;
  childrenIndex: Record<string, string[]>;
  loadVendors: () => Promise<void>;
  moveVendor: (vendorId: string, newParentId: string) => Promise<void>;
  changeRole: (vendorId: string, newRole: RoleKey) => Promise<void>;
  createVendor: (data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Vendor>;
  updateVendor: (vendorId: string, updates: Partial<Vendor>) => Promise<void>;
  suspendVendor: (vendorId: string, reason: string) => Promise<void>;
  reactivateVendor: (vendorId: string) => Promise<void>;
  updateGrantedPermissions: (vendorId: string, perms: PermissionKey[]) => Promise<void>;

  // ─── Fleet ────────────────────────────────────────────────────────
  vehiclesById: Record<string, Vehicle>;
  driversById: Record<string, Driver>;
  loadFleet: () => Promise<void>;
  createVehicle: (data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'documents'>) => Promise<Vehicle>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  toggleVehicleStatus: (id: string) => Promise<void>;
  blockVehicle: (id: string, reason: string) => Promise<void>;
  unblockVehicle: (id: string) => Promise<void>;
  createDriver: (data: Omit<Driver, 'id' | 'createdAt' | 'updatedAt' | 'documents'>) => Promise<Driver>;
  updateDriver: (id: string, updates: Partial<Driver>) => Promise<void>;
  toggleDriverStatus: (id: string) => Promise<void>;
  assignDriver: (vehicleId: string, driverId: string) => Promise<void>;
  unassignDriver: (vehicleId: string) => Promise<void>;
  uploadDocument: (params: Omit<UploadDocumentParams, 'actorId'>) => Promise<void>;
  reviewDocument: (params: Omit<ReviewDocumentParams, 'actorId'>) => Promise<void>;

  // ─── Delegations ──────────────────────────────────────────────────
  delegationsById: Record<string, Delegation>;
  loadDelegations: () => Promise<void>;
  createDelegation: (data: Omit<CreateDelegationParams, 'actorId'>) => Promise<Delegation>;
  toggleDelegation: (id: string, enabled: boolean) => Promise<void>;
  deleteDelegation: (id: string) => Promise<void>;

  // ─── Audit ────────────────────────────────────────────────────────
  auditLogs: AuditEntry[];
  loadAuditLogs: () => Promise<void>;

  // ─── UI ───────────────────────────────────────────────────────────
  selectedVendorId: string | null;
  setSelectedVendorId: (id: string | null) => void;
  viewMode: 'tree' | 'horizontal' | 'compact';
  setViewMode: (mode: 'tree' | 'horizontal' | 'compact') => void;
  searchFilters: SearchFilters;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  statusFilter: 'ALL' | 'ACTIVE' | 'SUSPENDED';
  setStatusFilter: (filter: 'ALL' | 'ACTIVE' | 'SUSPENDED') => void;

  // ─── Dev Tools ────────────────────────────────────────────────────
  failureRate: number;
  autoFailNext: boolean;
  setFailureRate: (rate: number) => void;
  setAutoFailNext: (fail: boolean) => void;
  resetDatabase: (stress?: boolean) => Promise<void>;
  initApp: () => Promise<void>;
}

const initialDb = loadDb();
const initialChildren = buildChildrenIndex(initialDb.vendors);

export const useAppStore = create<AppState>()(
  immer((set, get) => ({
    isInitialized: true,
    isLoading: false,
    error: null,

    // Session
    currentUserId: 'admin',
    switchUser: (vendorId: string) => {
      set((state) => {
        state.currentUserId = vendorId;
        // Auto-select self when switching perspective
        state.selectedVendorId = vendorId;
      });
    },

    // Vendors state
    vendorsById: initialDb.vendors,
    childrenIndex: initialChildren,

    loadVendors: async () => {
      const vendors = await vendorsApi.listVendors();
      set((state) => {
        const byId: Record<string, Vendor> = {};
        for (const v of vendors) {
          byId[v.id] = v;
        }
        state.vendorsById = byId;
        state.childrenIndex = buildChildrenIndex(byId);
      });
    },

    moveVendor: async (vendorId: string, newParentId: string) => {
      const actorId = get().currentUserId;
      const prevVendors = { ...get().vendorsById };
      const prevIndex = { ...get().childrenIndex };

      // 1. Optimistic update
      set((state) => {
        const vendor = state.vendorsById[vendorId];
        if (vendor) {
          reparent(state.vendorsById, state.childrenIndex, vendorId, newParentId);
        }
      });

      // Assert tree invariants in dev mode
      if (import.meta.env?.DEV) {
        assertTreeInvariants(get().vendorsById, get().childrenIndex);
      }

      // 2. Perform API call; rollback on failure
      try {
        await vendorsApi.moveVendor({ vendorId, newParentId, actorId });
        await get().loadAuditLogs();
      } catch (err) {
        // Rollback
        set((state) => {
          state.vendorsById = prevVendors;
          state.childrenIndex = prevIndex;
        });
        throw err;
      }
    },

    changeRole: async (vendorId: string, newRole: RoleKey) => {
      const actorId = get().currentUserId;
      const updated = await vendorsApi.changeRole({ vendorId, newRole, actorId });
      set((state) => {
        state.vendorsById[vendorId] = updated;
      });
      await get().loadAuditLogs();
    },

    createVendor: async (data) => {
      const actorId = get().currentUserId;
      const created = await vendorsApi.createVendor({ vendor: data, actorId });
      set((state) => {
        state.vendorsById[created.id] = created;
        state.childrenIndex = buildChildrenIndex(state.vendorsById);
        if (created.parentId) {
          state.expandedIds.add(created.parentId);
        }
      });
      await get().loadAuditLogs();
      return created;
    },

    updateVendor: async (vendorId, updates) => {
      const actorId = get().currentUserId;
      const updated = await vendorsApi.updateVendor({ vendorId, updates, actorId });
      set((state) => {
        state.vendorsById[vendorId] = updated;
      });
      await get().loadAuditLogs();
    },

    suspendVendor: async (vendorId, reason) => {
      const actorId = get().currentUserId;
      const updated = await vendorsApi.suspendVendor({ vendorId, reason, actorId });
      set((state) => {
        state.vendorsById[vendorId] = updated;
      });
      await get().loadAuditLogs();
    },

    reactivateVendor: async (vendorId) => {
      const actorId = get().currentUserId;
      const updated = await vendorsApi.reactivateVendor({ vendorId, actorId });
      set((state) => {
        state.vendorsById[vendorId] = updated;
      });
      await get().loadAuditLogs();
    },

    updateGrantedPermissions: async (vendorId, perms) => {
      const actorId = get().currentUserId;
      const updated = await vendorsApi.updateGrantedPermissions({
        vendorId,
        permissions: perms,
        actorId,
      });
      set((state) => {
        state.vendorsById[vendorId] = updated;
      });
      await get().loadAuditLogs();
    },

    // Fleet state
    vehiclesById: initialDb.vehicles,
    driversById: initialDb.drivers,

    loadFleet: async () => {
      const [vehicles, drivers] = await Promise.all([
        fleetApi.listVehicles(),
        fleetApi.listDrivers(),
      ]);
      set((state) => {
        const vMap: Record<string, Vehicle> = {};
        for (const v of vehicles) vMap[v.id] = v;
        const dMap: Record<string, Driver> = {};
        for (const d of drivers) dMap[d.id] = d;
        state.vehiclesById = vMap;
        state.driversById = dMap;
      });
    },

    createVehicle: async (data) => {
      const actorId = get().currentUserId;
      const created = await fleetApi.createVehicle({ vehicle: data, actorId });
      set((state) => {
        state.vehiclesById[created.id] = created;
      });
      await get().loadAuditLogs();
      return created;
    },

    updateVehicle: async (id, updates) => {
      const actorId = get().currentUserId;
      const updated = await fleetApi.updateVehicle({ vehicleId: id, updates, actorId });
      set((state) => {
        state.vehiclesById[id] = updated;
      });
      await get().loadAuditLogs();
    },

    toggleVehicleStatus: async (id) => {
      const actorId = get().currentUserId;
      const vehicle = get().vehiclesById[id];
      if (!vehicle) return;
      const prev = { ...vehicle };

      // Optimistic update
      const nextStatus = prev.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      set((state) => {
        const v = state.vehiclesById[id];
        if (v) v.status = nextStatus;
      });

      try {
        const updated = await fleetApi.toggleVehicleStatus({ vehicleId: id, actorId });
        set((state) => {
          state.vehiclesById[id] = updated;
        });
        await get().loadAuditLogs();
      } catch (err) {
        // Rollback
        set((state) => {
          state.vehiclesById[id] = prev;
        });
        throw err;
      }
    },

    blockVehicle: async (id, reason) => {
      const actorId = get().currentUserId;
      const updated = await fleetApi.blockVehicle({ vehicleId: id, reason, actorId });
      set((state) => {
        state.vehiclesById[id] = updated;
      });
      await get().loadAuditLogs();
    },

    unblockVehicle: async (id) => {
      const actorId = get().currentUserId;
      const updated = await fleetApi.unblockVehicle({ vehicleId: id, actorId });
      set((state) => {
        state.vehiclesById[id] = updated;
      });
      await get().loadAuditLogs();
    },

    createDriver: async (data) => {
      const actorId = get().currentUserId;
      const created = await fleetApi.createDriver({ driver: data, actorId });
      set((state) => {
        state.driversById[created.id] = created;
      });
      await get().loadAuditLogs();
      return created;
    },

    updateDriver: async (id, updates) => {
      const actorId = get().currentUserId;
      const updated = await fleetApi.updateDriver({ driverId: id, updates, actorId });
      set((state) => {
        state.driversById[id] = updated;
      });
      await get().loadAuditLogs();
    },

    toggleDriverStatus: async (id) => {
      const actorId = get().currentUserId;
      const updated = await fleetApi.toggleDriverStatus({ driverId: id, actorId });
      set((state) => {
        state.driversById[id] = updated;
      });
      await get().loadAuditLogs();
    },

    assignDriver: async (vehicleId, driverId) => {
      const actorId = get().currentUserId;
      const { vehicle, driver } = await fleetApi.assignDriver({ vehicleId, driverId, actorId });
      set((state) => {
        state.vehiclesById[vehicle.id] = vehicle;
        state.driversById[driver.id] = driver;
      });
      await get().loadAuditLogs();
    },

    unassignDriver: async (vehicleId) => {
      const actorId = get().currentUserId;
      const vehicle = await fleetApi.unassignDriver({ vehicleId, actorId });
      set((state) => {
        state.vehiclesById[vehicleId] = vehicle;
      });
      await get().loadAuditLogs();
    },

    uploadDocument: async (params) => {
      const actorId = get().currentUserId;
      const doc = await documentsApi.uploadDocument({ ...params, actorId });
      set((state) => {
        const entity =
          params.entityType === 'VEHICLE'
            ? state.vehiclesById[params.entityId]
            : state.driversById[params.entityId];
        if (entity) {
          const idx = entity.documents.findIndex((d) => d.type === doc.type);
          if (idx >= 0) {
            entity.documents[idx] = doc;
          } else {
            entity.documents.push(doc);
          }
        }
      });
      await get().loadAuditLogs();
    },

    reviewDocument: async (params) => {
      const actorId = get().currentUserId;
      const doc = await documentsApi.reviewDocument({ ...params, actorId });
      set((state) => {
        const entity =
          params.entityType === 'VEHICLE'
            ? state.vehiclesById[params.entityId]
            : state.driversById[params.entityId];
        if (entity) {
          const target = entity.documents.find((d) => d.id === doc.id);
          if (target) {
            target.verification = doc.verification;
          }
        }
      });
      await get().loadAuditLogs();
    },

    // Delegations
    delegationsById: initialDb.delegations,

    loadDelegations: async () => {
      const list = await delegationApi.listDelegations();
      set((state) => {
        const dMap: Record<string, Delegation> = {};
        for (const d of list) dMap[d.id] = d;
        state.delegationsById = dMap;
      });
    },

    createDelegation: async (data) => {
      const actorId = get().currentUserId;
      const created = await delegationApi.createDelegation({ ...data, actorId });
      set((state) => {
        state.delegationsById[created.id] = created;
      });
      await get().loadAuditLogs();
      return created;
    },

    toggleDelegation: async (id, enabled) => {
      const actorId = get().currentUserId;
      const delegation = get().delegationsById[id];
      if (!delegation) return;
      const prev = { ...delegation };

      // Optimistic update
      set((state) => {
        const d = state.delegationsById[id];
        if (d) d.enabled = enabled;
      });

      try {
        const updated = await delegationApi.toggleDelegation({
          delegationId: id,
          enabled,
          actorId,
        });
        set((state) => {
          state.delegationsById[id] = updated;
        });
        await get().loadAuditLogs();
      } catch (err) {
        set((state) => {
          state.delegationsById[id] = prev;
        });
        throw err;
      }
    },

    deleteDelegation: async (id) => {
      const actorId = get().currentUserId;
      await delegationApi.deleteDelegation({ delegationId: id, actorId });
      set((state) => {
        delete state.delegationsById[id];
      });
      await get().loadAuditLogs();
    },

    // Audit
    auditLogs: initialDb.auditLogs,

    loadAuditLogs: async () => {
      const res = await auditApi.listAuditLogs({ limit: 100 });
      set((state) => {
        state.auditLogs = res.items;
      });
    },

    // UI state
    selectedVendorId: 'admin',
    setSelectedVendorId: (id) => {
      set((state) => {
        state.selectedVendorId = id;
      });
    },
    viewMode: 'tree',
    setViewMode: (mode) => {
      set((state) => {
        state.viewMode = mode;
      });
    },
    searchFilters: {
      search: '',
      tags: [],
      roles: [],
    },
    setSearchFilters: (filters) => {
      set((state) => {
        state.searchFilters = { ...state.searchFilters, ...filters };
      });
    },
    expandedIds: new Set(['admin', 'sa-deepalitesting', 'gv-demo-group-vendor']),
    toggleExpanded: (id) => {
      set((state) => {
        if (state.expandedIds.has(id)) {
          state.expandedIds.delete(id);
        } else {
          state.expandedIds.add(id);
        }
      });
    },
    setExpanded: (id, expanded) => {
      set((state) => {
        if (expanded) {
          state.expandedIds.add(id);
        } else {
          state.expandedIds.delete(id);
        }
      });
    },
    expandAll: () => {
      set((state) => {
        for (const id of Object.keys(state.vendorsById)) {
          state.expandedIds.add(id);
        }
      });
    },
    collapseAll: () => {
      set((state) => {
        state.expandedIds.clear();
      });
    },
    statusFilter: 'ALL',
    setStatusFilter: (filter) => {
      set((state) => {
        state.statusFilter = filter;
      });
    },

    // Dev tools
    failureRate: 0,
    autoFailNext: false,
    setFailureRate: (rate) => {
      devApiConfig.failureRate = rate;
      set((state) => {
        state.failureRate = rate;
      });
    },
    setAutoFailNext: (fail) => {
      devApiConfig.forceFailNext = fail;
      set((state) => {
        state.autoFailNext = fail;
      });
    },

    resetDatabase: async (stress = false) => {
      set((state) => {
        state.isLoading = true;
      });
      resetDb(stress);
      await get().initApp();
      set((state) => {
        state.isLoading = false;
      });
    },

    initApp: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });
      try {
        const db = loadDb();
        const byId = db.vendors;
        const children = buildChildrenIndex(byId);

        set((state) => {
          state.vendorsById = byId;
          state.childrenIndex = children;
          state.vehiclesById = db.vehicles;
          state.driversById = db.drivers;
          state.delegationsById = db.delegations;
          state.auditLogs = db.auditLogs;
          state.searchFilters = { search: '', tags: [], roles: [] };
          state.selectedVendorId = 'admin';
          state.isInitialized = true;
          state.isLoading = false;
        });
      } catch (err) {
        set((state) => {
          state.error = err instanceof Error ? err.message : 'Failed to initialize app';
          state.isLoading = false;
        });
      }
    },
  })),
);
