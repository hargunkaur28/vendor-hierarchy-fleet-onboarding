import type { Vehicle, Driver } from '@/types';
import { simulateNetwork, recordAudit } from './client';
import { AppError } from './errors';
import { normalizeRegNo, normalizeLicenseNo } from '@/lib/validators';
import { isVehicleCompliant, isDriverCompliant } from '@/lib/compliance';
import { authorize } from '@/lib/permissions';

export interface CreateVehicleParams {
  vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'documents'>;
  actorId: string;
}

export interface CreateDriverParams {
  driver: Omit<Driver, 'id' | 'createdAt' | 'updatedAt' | 'documents'>;
  actorId: string;
}

export const fleetApi = {
  // ─── Vehicles ───────────────────────────────────────────────────────

  async listVehicles(vendorId?: string): Promise<Vehicle[]> {
    return simulateNetwork((db) => {
      const all = Object.values(db.vehicles);
      if (!vendorId) return all;
      return all.filter((v) => v.ownerVendorId === vendorId);
    });
  },

  async getVehicle(id: string): Promise<Vehicle> {
    return simulateNetwork((db) => {
      const v = db.vehicles[id];
      if (!v) throw new AppError('VEHICLE_NOT_FOUND');
      return v;
    });
  },

  async createVehicle({ vehicle, actorId }: CreateVehicleParams): Promise<Vehicle> {
    return simulateNetwork((db) => {
      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_FLEET',
          targetVendorId: vehicle.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      const normalizedReg = normalizeRegNo(vehicle.regNo);
      const duplicate = Object.values(db.vehicles).some(
        (v) => normalizeRegNo(v.regNo) === normalizedReg,
      );
      if (duplicate) throw new AppError('DUPLICATE_REG_NO');

      const id = `veh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const newVehicle: Vehicle = {
        ...vehicle,
        regNo: normalizedReg,
        id,
        documents: [],
        createdAt: now,
        updatedAt: now,
      };

      db.vehicles[id] = newVehicle;

      recordAudit(db, {
        actorId,
        action: 'CREATE_VEHICLE',
        targetType: 'VEHICLE',
        targetId: id,
        details: { regNo: normalizedReg, ownerVendorId: vehicle.ownerVendorId },
      });

      return newVehicle;
    });
  },

  async updateVehicle({
    vehicleId,
    updates,
    actorId,
  }: {
    vehicleId: string;
    updates: Partial<Pick<Vehicle, 'model' | 'seatingCapacity' | 'fuelType'>>;
    actorId: string;
  }): Promise<Vehicle> {
    return simulateNetwork((db) => {
      const vehicle = db.vehicles[vehicleId];
      if (!vehicle) throw new AppError('VEHICLE_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_FLEET',
          targetVendorId: vehicle.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      Object.assign(vehicle, updates);
      vehicle.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'UPDATE_VEHICLE',
        targetType: 'VEHICLE',
        targetId: vehicleId,
        details: updates,
      });

      return vehicle;
    });
  },

  async toggleVehicleStatus({
    vehicleId,
    actorId,
  }: {
    vehicleId: string;
    actorId: string;
  }): Promise<Vehicle> {
    return simulateNetwork((db) => {
      const vehicle = db.vehicles[vehicleId];
      if (!vehicle) throw new AppError('VEHICLE_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_FLEET',
          targetVendorId: vehicle.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      const newStatus = vehicle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

      // If activating, enforce compliance
      if (newStatus === 'ACTIVE') {
        const { compliant, reasons } = isVehicleCompliant(vehicle);
        if (!compliant) {
          throw new AppError(
            'NON_COMPLIANT_VEHICLE',
            `Vehicle cannot be activated: missing, rejected, or expired documents. (${reasons.map((r) => r.detail).join(', ')})`,
            { reasons },
          );
        }
      }

      vehicle.status = newStatus;
      vehicle.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'TOGGLE_VEHICLE_STATUS',
        targetType: 'VEHICLE',
        targetId: vehicleId,
        details: { status: newStatus },
      });

      return vehicle;
    });
  },

  async blockVehicle({
    vehicleId,
    reason,
    actorId,
  }: {
    vehicleId: string;
    reason: string;
    actorId: string;
  }): Promise<Vehicle> {
    return simulateNetwork((db) => {
      const vehicle = db.vehicles[vehicleId];
      if (!vehicle) throw new AppError('VEHICLE_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_FLEET',
          targetVendorId: vehicle.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      vehicle.blocked = {
        reason,
        at: new Date().toISOString(),
        byVendorId: actorId,
      };
      vehicle.status = 'INACTIVE';
      vehicle.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'BLOCK_VEHICLE',
        targetType: 'VEHICLE',
        targetId: vehicleId,
        details: { reason },
      });

      return vehicle;
    });
  },

  async unblockVehicle({
    vehicleId,
    actorId,
  }: {
    vehicleId: string;
    actorId: string;
  }): Promise<Vehicle> {
    return simulateNetwork((db) => {
      const vehicle = db.vehicles[vehicleId];
      if (!vehicle) throw new AppError('VEHICLE_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_FLEET',
          targetVendorId: vehicle.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      delete vehicle.blocked;
      vehicle.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'UNBLOCK_VEHICLE',
        targetType: 'VEHICLE',
        targetId: vehicleId,
      });

      return vehicle;
    });
  },

  // ─── Drivers ────────────────────────────────────────────────────────

  async listDrivers(vendorId?: string): Promise<Driver[]> {
    return simulateNetwork((db) => {
      const all = Object.values(db.drivers);
      if (!vendorId) return all;
      return all.filter((d) => d.ownerVendorId === vendorId);
    });
  },

  async getDriver(id: string): Promise<Driver> {
    return simulateNetwork((db) => {
      const d = db.drivers[id];
      if (!d) throw new AppError('DRIVER_NOT_FOUND');
      return d;
    });
  },

  async createDriver({ driver, actorId }: CreateDriverParams): Promise<Driver> {
    return simulateNetwork((db) => {
      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_DRIVERS',
          targetVendorId: driver.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      const duplicate = Object.values(db.drivers).some((d) => d.phone === driver.phone);
      if (duplicate) throw new AppError('DUPLICATE_DRIVER_PHONE');

      const id = `drv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const newDriver: Driver = {
        ...driver,
        licenseNumber: normalizeLicenseNo(driver.licenseNumber),
        id,
        documents: [],
        createdAt: now,
        updatedAt: now,
      };

      db.drivers[id] = newDriver;

      recordAudit(db, {
        actorId,
        action: 'CREATE_DRIVER',
        targetType: 'DRIVER',
        targetId: id,
        details: { name: newDriver.name, phone: newDriver.phone, ownerVendorId: driver.ownerVendorId },
      });

      return newDriver;
    });
  },

  async updateDriver({
    driverId,
    updates,
    actorId,
  }: {
    driverId: string;
    updates: Partial<Pick<Driver, 'name' | 'phone'>>;
    actorId: string;
  }): Promise<Driver> {
    return simulateNetwork((db) => {
      const driver = db.drivers[driverId];
      if (!driver) throw new AppError('DRIVER_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_DRIVERS',
          targetVendorId: driver.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      Object.assign(driver, updates);
      driver.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'UPDATE_DRIVER',
        targetType: 'DRIVER',
        targetId: driverId,
        details: updates,
      });

      return driver;
    });
  },

  async toggleDriverStatus({
    driverId,
    actorId,
  }: {
    driverId: string;
    actorId: string;
  }): Promise<Driver> {
    return simulateNetwork((db) => {
      const driver = db.drivers[driverId];
      if (!driver) throw new AppError('DRIVER_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_DRIVERS',
          targetVendorId: driver.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      driver.availability = driver.availability === 'AVAILABLE' ? 'OFF_DUTY' : 'AVAILABLE';
      driver.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'TOGGLE_DRIVER_STATUS',
        targetType: 'DRIVER',
        targetId: driverId,
        details: { availability: driver.availability },
      });

      return driver;
    });
  },

  async assignDriver({
    vehicleId,
    driverId,
    actorId,
  }: {
    vehicleId: string;
    driverId: string;
    actorId: string;
  }): Promise<{ vehicle: Vehicle; driver: Driver }> {
    return simulateNetwork((db) => {
      const vehicle = db.vehicles[vehicleId];
      if (!vehicle) throw new AppError('VEHICLE_NOT_FOUND');
      const driver = db.drivers[driverId];
      if (!driver) throw new AppError('DRIVER_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_DRIVERS',
          targetVendorId: vehicle.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      // Check driver compliance
      const { compliant, reasons } = isDriverCompliant(driver);
      if (!compliant) {
        throw new AppError(
          'NON_COMPLIANT_DRIVER',
          reasons[0]?.detail ?? 'Driver documents are non-compliant.',
        );
      }

      // Check driver is not already assigned to another active vehicle
      const existingVehicle = Object.values(db.vehicles).find(
        (v) => v.id !== vehicleId && v.assignedDriverId === driverId,
      );
      if (existingVehicle) {
        throw new AppError(
          'DRIVER_ALREADY_ASSIGNED',
          `Driver is already assigned to vehicle ${existingVehicle.regNo}.`,
        );
      }

      vehicle.assignedDriverId = driverId;
      driver.assignedVehicleId = vehicleId;
      vehicle.updatedAt = new Date().toISOString();
      driver.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'ASSIGN_DRIVER',
        targetType: 'VEHICLE',
        targetId: vehicleId,
        details: { driverId, driverName: driver.name },
      });

      return { vehicle, driver };
    });
  },

  async unassignDriver({
    vehicleId,
    actorId,
  }: {
    vehicleId: string;
    actorId: string;
  }): Promise<Vehicle> {
    return simulateNetwork((db) => {
      const vehicle = db.vehicles[vehicleId];
      if (!vehicle) throw new AppError('VEHICLE_NOT_FOUND');

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'ONBOARD_DRIVERS',
          targetVendorId: vehicle.ownerVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      const prevDriverId = vehicle.assignedDriverId;
      vehicle.assignedDriverId = null;
      if (prevDriverId && db.drivers[prevDriverId]) {
        db.drivers[prevDriverId].assignedVehicleId = null;
        db.drivers[prevDriverId].updatedAt = new Date().toISOString();
      }
      vehicle.updatedAt = new Date().toISOString();

      recordAudit(db, {
        actorId,
        action: 'UNASSIGN_DRIVER',
        targetType: 'VEHICLE',
        targetId: vehicleId,
        details: { unassignedDriverId: prevDriverId },
      });

      return vehicle;
    });
  },
};
