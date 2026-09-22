import { describe, it, expect, beforeEach } from 'vitest';
import { AppError } from './errors';
import { devApiConfig, resetDb, loadDb } from './client';
import { vendorsApi } from './vendorsApi';
import { fleetApi } from './fleetApi';
import { delegationApi } from './delegationApi';
import { documentsApi } from './documentsApi';
import { auditApi } from './auditApi';
import { isDriverCompliant } from '@/lib/compliance';
import { useAppStore } from '@/store/useAppStore';

describe('Mock API & Store', () => {
  beforeEach(() => {
    // Reset DB and dev config before each test
    devApiConfig.latencyMax = 0;
    devApiConfig.latencyMin = 0;
    devApiConfig.failureRate = 0;
    devApiConfig.forceFailNext = false;
    resetDb();
  });

  // ─── Errors ────────────────────────────────────────────────────────
  describe('AppError', () => {
    it('creates error with correct code and default message', () => {
      const err = new AppError('CYCLE_DETECTED');
      expect(err.code).toBe('CYCLE_DETECTED');
      expect(err.message).toContain('cycle');
    });

    it('allows custom override message', () => {
      const err = new AppError('ROOT_VENDOR_IMMUTABLE', 'Custom root message');
      expect(err.message).toBe('Custom root message');
    });
  });

  // ─── Vendors API ───────────────────────────────────────────────────
  describe('vendorsApi', () => {
    it('lists all vendors from seed data', async () => {
      const vendors = await vendorsApi.listVendors();
      expect(vendors.length).toBeGreaterThan(20);
      expect(vendors.some((v) => v.id === 'admin')).toBe(true);
    });

    it('prevents moving root admin', async () => {
      await expect(
        vendorsApi.moveVendor({ vendorId: 'admin', newParentId: 'sa-site-admin', actorId: 'admin' }),
      ).rejects.toThrow(/Root vendor cannot be moved/);
    });

    it('rejects cycle creation when moving node under descendant', async () => {
      // gv-regional-ops is ancestor of sv-regional
      await expect(
        vendorsApi.moveVendor({
          vendorId: 'gv-regional-ops',
          newParentId: 'sv-regional',
          actorId: 'admin',
        }),
      ).rejects.toThrow(/cycle detected/);
    });

    it('rejects invalid role hierarchy', async () => {
      // Group Vendor cannot report to Sub Vendor
      await expect(
        vendorsApi.moveVendor({
          vendorId: 'gv-regional-ops',
          newParentId: 'sv-demo-sub-vendor-1',
          actorId: 'admin',
        }),
      ).rejects.toThrow(/Role hierarchy violation/);
    });

    it('successfully moves vendor under valid parent and writes audit log', async () => {
      // Move sv-demo-sub-vendor-1 from gv-demo-group-vendor to gv-regional-ops
      const moved = await vendorsApi.moveVendor({
        vendorId: 'sv-demo-sub-vendor-1',
        newParentId: 'gv-regional-ops',
        actorId: 'admin',
      });
      expect(moved.parentId).toBe('gv-regional-ops');

      // Verify in db
      const db = loadDb();
      expect(db.vendors['sv-demo-sub-vendor-1']?.parentId).toBe('gv-regional-ops');

      // Check audit log
      const audit = db.auditLogs.find(
        (a) => a.action === 'MOVE_VENDOR' && a.targetId === 'sv-demo-sub-vendor-1',
      );
      expect(audit).toBeDefined();
      expect(audit?.details).toMatchObject({
        oldParentId: 'gv-demo-group-vendor',
        newParentId: 'gv-regional-ops',
      });
    });

    it('rejects action when actor lacks permission', async () => {
      // da-test-da has no MANAGE_TEAM permission
      await expect(
        vendorsApi.moveVendor({
          vendorId: 'sv-demo-sub-vendor-1',
          newParentId: 'gv-regional-ops',
          actorId: 'da-test-da',
        }),
      ).rejects.toThrow();
    });
  });

  // ─── Fleet API ─────────────────────────────────────────────────────
  describe('fleetApi', () => {
    it('rejects vehicle creation with duplicate registration number', async () => {
      const vehicles = await fleetApi.listVehicles();
      const existing = vehicles[0]!;

      await expect(
        fleetApi.createVehicle({
          vehicle: {
            ownerVendorId: existing.ownerVendorId,
            regNo: existing.regNo.toLowerCase(), // test normalized match
            model: 'Test Car',
            seatingCapacity: 4,
            fuelType: 'PETROL',
            status: 'ACTIVE',
            assignedDriverId: null,
          },
          actorId: 'admin',
        }),
      ).rejects.toThrow(/already exists/);
    });

    it('prevents activating non-compliant vehicle', async () => {
      // Create vehicle without any documents
      const newVeh = await fleetApi.createVehicle({
        vehicle: {
          ownerVendorId: 'sv-demo-sub-vendor-1',
          regNo: 'DL01ZZ9999',
          model: 'Test NonCompliant',
          seatingCapacity: 4,
          fuelType: 'DIESEL',
          status: 'INACTIVE',
          assignedDriverId: null,
        },
        actorId: 'admin',
      });

      // Attempt to toggle to ACTIVE should fail because docs are missing
      await expect(
        fleetApi.toggleVehicleStatus({ vehicleId: newVeh.id, actorId: 'admin' }),
      ).rejects.toThrow(/Vehicle cannot be activated/);
    });

    it('assigns compliant driver to vehicle and prevents double assignment', async () => {
      const drivers = await fleetApi.listDrivers();
      let compliantDriver = drivers.find((d) => isDriverCompliant(d).compliant);

      if (!compliantDriver) {
        const target = drivers[0]!;
        await documentsApi.uploadDocument({
          entityType: 'DRIVER',
          entityId: target.id,
          type: 'DL',
          fileName: 'dl.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          expiryDate: '2028-12-31',
          actorId: 'admin',
        });
        const reloaded = await fleetApi.getDriver(target.id);
        const doc = reloaded.documents.find((d) => d.type === 'DL')!;
        await documentsApi.reviewDocument({
          entityType: 'DRIVER',
          entityId: target.id,
          docId: doc.id,
          status: 'APPROVED',
          actorId: 'admin',
        });
        compliantDriver = await fleetApi.getDriver(target.id);
      }

      const vehicles = await fleetApi.listVehicles();
      const vehicleA = vehicles[0]!;
      const vehicleB = vehicles[1]!;

      // Assign to vehicleA
      await fleetApi.assignDriver({
        vehicleId: vehicleA.id,
        driverId: compliantDriver!.id,
        actorId: 'admin',
      });

      // Attempting to assign same driver to vehicleB should fail
      await expect(
        fleetApi.assignDriver({
          vehicleId: vehicleB.id,
          driverId: compliantDriver!.id,
          actorId: 'admin',
        }),
      ).rejects.toThrow(/already assigned/);
    });
  });

  // ─── Delegations API ───────────────────────────────────────────────
  describe('delegationApi', () => {
    it('creates, toggles, and deletes delegation', async () => {
      const del = await delegationApi.createDelegation({
        delegatorId: 'admin',
        delegateId: 'sa-site-admin',
        scope: ['MANAGE_TEAM'],
        actorId: 'admin',
      });
      expect(del.enabled).toBe(true);

      const disabled = await delegationApi.toggleDelegation({
        delegationId: del.id,
        enabled: false,
        actorId: 'admin',
      });
      expect(disabled.enabled).toBe(false);

      await delegationApi.deleteDelegation({ delegationId: del.id, actorId: 'admin' });
      const list = await delegationApi.listDelegations();
      expect(list.some((d) => d.id === del.id)).toBe(false);
    });
  });

  // ─── Audit API ─────────────────────────────────────────────────────
  describe('auditApi', () => {
    it('returns paginated audit logs', async () => {
      const res = await auditApi.listAuditLogs({ limit: 5 });
      expect(res.items.length).toBeLessThanOrEqual(5);
      if (res.hasMore) {
        expect(res.nextCursor).toBeDefined();
      }
    });
  });

  // ─── Zustand Store Optimistic Updates ──────────────────────────────
  describe('useAppStore', () => {
    it('initializes store with seed data', async () => {
      await useAppStore.getState().initApp();
      const state = useAppStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(Object.keys(state.vendorsById).length).toBeGreaterThan(20);
    });

    it('rolls back optimistic move on network failure', async () => {
      await useAppStore.getState().initApp();
      const store = useAppStore.getState();
      const originalParent = store.vendorsById['sv-demo-sub-vendor-1']?.parentId;
      expect(originalParent).toBe('gv-demo-group-vendor');

      // Force failure on next request
      devApiConfig.forceFailNext = true;

      await expect(
        store.moveVendor('sv-demo-sub-vendor-1', 'gv-regional-ops'),
      ).rejects.toThrow();

      // Store should have rolled back to original parent
      const rolledBackState = useAppStore.getState();
      expect(rolledBackState.vendorsById['sv-demo-sub-vendor-1']?.parentId).toBe(originalParent);
      expect(rolledBackState.childrenIndex['gv-demo-group-vendor']).toContain('sv-demo-sub-vendor-1');
      expect(rolledBackState.childrenIndex['gv-regional-ops']).not.toContain('sv-demo-sub-vendor-1');
    });
  });
});
