import type {
  Vendor,
  Vehicle,
  Driver,
  DocumentRecord,
  MockDatabase,
  RoleKey,
  DocType,
  FuelType,
  VerificationStatus,
} from '@/types';
import { ROLE_CONFIG } from '@/config/roles';
import { REQUIRED_VEHICLE_DOCS, REQUIRED_DRIVER_DOCS, VENDOR_TAGS } from '@/config/constants';
import { SeededRandom } from '@/lib/prng';
import { addDays, subDays, formatISO } from 'date-fns';

// ─── Seed DB shape ─────────────────────────────────────────────────

export type SeedDB = MockDatabase;

// ─── Constants ─────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Deepak', 'Arun', 'Megha', 'Priya', 'Rahul', 'Sneha', 'Kiran', 'Vikram',
  'Anita', 'Suresh', 'Neha', 'Mohan', 'Ravi', 'Pooja', 'Amit', 'Sanjay',
  'Kavita', 'Nitin', 'Geeta', 'Rajesh', 'Swati', 'Manish', 'Divya', 'Ashok',
  'Rekha', 'Vijay', 'Sunita', 'Gaurav', 'Meena', 'Harsh',
];

const LAST_NAMES = [
  'Kumar', 'Sharma', 'Singh', 'Patel', 'Verma', 'Gupta', 'Joshi', 'Reddy',
  'Nair', 'Iyer', 'Mehta', 'Chopra', 'Bhat', 'Rao', 'Mishra', 'Das',
  'Kaur', 'Chauhan', 'Pillai', 'Menon',
];

const VEHICLE_MODELS: Array<{ model: string; seats: number; fuel: FuelType }> = [
  { model: 'Swift Dzire', seats: 4, fuel: 'PETROL' },
  { model: 'Toyota Etios', seats: 4, fuel: 'DIESEL' },
  { model: 'Innova Crysta', seats: 7, fuel: 'DIESEL' },
  { model: 'Tata Tigor EV', seats: 4, fuel: 'EV' },
  { model: 'Ertiga', seats: 7, fuel: 'CNG' },
  { model: 'Hyundai Aura', seats: 4, fuel: 'PETROL' },
  { model: 'Maruti Celerio', seats: 4, fuel: 'CNG' },
  { model: 'Tata Nexon EV', seats: 5, fuel: 'EV' },
];

const STATE_CODES = ['KA', 'DL', 'MH', 'TN', 'UP', 'GJ', 'RJ', 'WB', 'AP', 'TS'];

const NOW = new Date();

// ─── Generator ─────────────────────────────────────────────────────

/**
 * Generates a deterministic seed database with ~60 vendors, fleet, docs, delegations.
 * Uses mulberry32 PRNG so demos are reproducible.
 *
 * @param seed - PRNG seed (default: 42)
 */
export function generateSeedData(seed = 42): SeedDB {
  const rng = new SeededRandom(seed);
  const db: SeedDB = {
    vendors: {},
    vehicles: {},
    drivers: {},
    delegations: {},
    auditLogs: [],
  };

  // Helper to add a vendor
  const addVendor = (
    id: string,
    name: string,
    role: RoleKey,
    parentId: string | null,
    overrides: Partial<Vendor> = {},
  ): Vendor => {
    const vendor: Vendor = {
      id,
      name,
      email: `${id}@example.com`,
      phone: `${rng.int(6, 9)}${String(rng.int(100000000, 999999999)).padStart(9, '0')}`,
      role,
      parentId,
      tags: rng.sample([...VENDOR_TAGS], rng.int(0, 2)),
      status: 'ACTIVE',
      grantedPermissions: [...ROLE_CONFIG[role].defaultPermissions],
      createdAt: formatISO(subDays(NOW, rng.int(30, 365))),
      updatedAt: formatISO(subDays(NOW, rng.int(0, 30))),
      ...overrides,
    };
    db.vendors[id] = vendor;
    return vendor;
  };

  // ── 1. Golden scenario (mirrors screenshots) ──

  // Root
  addVendor('admin', 'admin', 'ADMIN', null);

  // Site Admins (~14)
  const siteAdminNames = [
    'site-admin', 'Site SA 2', 'Funnel Inc', 'movegsyncadminn',
    'DeepaLitesting', 'DeepakTesting1', 'Partner success', 'AK',
    'gtest', 'DCO Trial acc', 'Ethen', 'Example Ramp',
    'NewSiteadmin', 'Newsite admin 2',
  ];
  const siteAdminIds: string[] = [];
  for (const name of siteAdminNames) {
    const id = `sa-${name.toLowerCase().replace(/\s+/g, '-')}`;
    addVendor(id, name, 'SITE_ADMIN', 'admin');
    siteAdminIds.push(id);
  }

  // Under "DeepakTesting" (sa-deepalitesting): 5 Group Vendors
  const deepakSA = 'sa-deepalitesting';
  const groupVendorNames = [
    'Demo Group Vendor', 'test', 'Arunkumar QA',
    'test2', 'Arunkumar QA 2',
  ];
  const groupVendorIds: string[] = [];
  for (const name of groupVendorNames) {
    const id = `gv-${name.toLowerCase().replace(/\s+/g, '-')}`;
    addVendor(id, name, 'GROUP_VENDOR', deepakSA);
    groupVendorIds.push(id);
  }

  // Under "Demo Group Vendor": 4 Sub Vendors
  const demoGV = 'gv-demo-group-vendor';
  const subVendorNames = [
    'Demo Vendor Supervisor', 'Demo Vendor Supervisor 2',
    'Demo Sub Vendor 1', 'Demo Sub Vendor 2',
  ];
  const demoSubVendorIds: string[] = [];
  for (const name of subVendorNames) {
    const id = `sv-${name.toLowerCase().replace(/\s+/g, '-')}`;
    addVendor(id, name, 'SUB_VENDOR', demoGV);
    demoSubVendorIds.push(id);
  }

  // Under "Demo Sub Vendor 1": 1 DA
  addVendor('da-test-da', 'Test DA', 'DEPLOYMENT_ASSOCIATE', 'sv-demo-sub-vendor-1');

  // Second branch: under sa-deepaktesting1
  const meghaGV = 'gv-megha-test';
  addVendor(meghaGV, 'Megha Test', 'GROUP_VENDOR', 'sa-deepaktesting1');
  addVendor('sv-megha-sub1', 'Megha SubVendor1', 'SUB_VENDOR', meghaGV);

  // ── 2. Deep N-level branch (proves unbounded nesting) ──
  // Group Vendor → Regional Sub Vendor → City Sub Vendor → Local Sub Vendor → DA
  addVendor('gv-regional-ops', 'Regional Operations', 'GROUP_VENDOR', 'sa-site-admin');
  addVendor('sv-regional', 'Regional Sub Vendor', 'SUB_VENDOR', 'gv-regional-ops');
  addVendor('sv-city', 'City Sub Vendor', 'SUB_VENDOR', 'sv-regional');
  addVendor('sv-local', 'Local Sub Vendor', 'SUB_VENDOR', 'sv-city');
  addVendor('da-local', 'Local DA', 'DEPLOYMENT_ASSOCIATE', 'sv-local');

  // ── 3. Bulk fill to ~60 vendors ──
  let vendorCounter = 0;
  const allSubVendorIds = [...demoSubVendorIds, 'sv-megha-sub1', 'sv-regional', 'sv-city', 'sv-local'];

  // Add more group vendors under random site admins
  for (let i = 0; i < 5; i++) {
    const parentSA = rng.pick(siteAdminIds);
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    const id = `gv-bulk-${vendorCounter++}`;
    addVendor(id, name, 'GROUP_VENDOR', parentSA);
    groupVendorIds.push(id);
  }

  // Add more sub vendors under group vendors
  for (let i = 0; i < 10; i++) {
    const parentGV = rng.pick(groupVendorIds);
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    const id = `sv-bulk-${vendorCounter++}`;
    addVendor(id, name, 'SUB_VENDOR', parentGV);
    allSubVendorIds.push(id);
  }

  // Add DAs under sub vendors
  for (let i = 0; i < 5; i++) {
    const parentSV = rng.pick(allSubVendorIds);
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    const id = `da-bulk-${vendorCounter++}`;
    addVendor(id, name, 'DEPLOYMENT_ASSOCIATE', parentSV);
  }

  // ── 4. Restricted permission grants (demo-able) ──
  // A sub vendor that can onboard drivers but NOT manage payments
  const restrictedSV = db.vendors['sv-demo-sub-vendor-1'];
  if (restrictedSV) {
    restrictedSV.grantedPermissions = ['ONBOARD_FLEET', 'ONBOARD_DRIVERS', 'VERIFY_DOCUMENTS'];
  }
  // A sub vendor with minimal permissions
  const minimalSV = db.vendors['sv-demo-sub-vendor-2'];
  if (minimalSV) {
    minimalSV.grantedPermissions = ['ONBOARD_DRIVERS'];
  }

  // ── 5. Fleet seed ──
  const fleetVendors = allSubVendorIds.filter((id) => db.vendors[id]?.role === 'SUB_VENDOR');
  for (const vendorId of fleetVendors) {
    const vehicleCount = rng.int(2, 6);
    const driverCount = rng.int(2, 6);

    // Vehicles
    const vehicleIds: string[] = [];
    for (let i = 0; i < vehicleCount; i++) {
      const vehicleId = `veh-${vendorId}-${i}`;
      const modelInfo = rng.pick(VEHICLE_MODELS);
      const stateCode = rng.pick(STATE_CODES);
      const rtoCode = String(rng.int(1, 99)).padStart(2, '0');
      const letters = String.fromCharCode(65 + rng.int(0, 25)) + String.fromCharCode(65 + rng.int(0, 25));
      const digits = String(rng.int(1000, 9999));
      const regNo = `${stateCode}${rtoCode}${letters}${digits}`;

      const docs = generateVehicleDocs(rng, vehicleId, vendorId);

      const vehicle: Vehicle = {
        id: vehicleId,
        ownerVendorId: vendorId,
        regNo,
        model: modelInfo.model,
        seatingCapacity: modelInfo.seats,
        fuelType: modelInfo.fuel,
        status: rng.chance(0.15) ? 'INACTIVE' : 'ACTIVE',
        assignedDriverId: null,
        documents: docs,
        createdAt: formatISO(subDays(NOW, rng.int(30, 300))),
        updatedAt: formatISO(subDays(NOW, rng.int(0, 30))),
      };

      // ~5% blocked by override
      if (rng.chance(0.05)) {
        vehicle.blocked = {
          byVendorId: 'admin',
          reason: 'Non-compliance flagged during audit',
          at: formatISO(subDays(NOW, rng.int(1, 30))),
        };
      }

      db.vehicles[vehicleId] = vehicle;
      vehicleIds.push(vehicleId);
    }

    // Drivers
    const driverIds: string[] = [];
    for (let i = 0; i < driverCount; i++) {
      const driverId = `drv-${vendorId}-${i}`;
      const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
      const stateCode = rng.pick(STATE_CODES);
      const rtoCode = String(rng.int(1, 99)).padStart(2, '0');
      const licenseDigits = String(rng.int(10000000000, 99999999999));
      const licenseNumber = `${stateCode}${rtoCode}${licenseDigits}`;

      const dlDocs = generateDriverDocs(rng, driverId, vendorId);

      const driver: Driver = {
        id: driverId,
        ownerVendorId: vendorId,
        name,
        phone: `${rng.int(6, 9)}${String(rng.int(100000000, 999999999)).padStart(9, '0')}`,
        licenseNumber,
        availability: rng.pick(['AVAILABLE', 'AVAILABLE', 'ON_TRIP', 'OFF_DUTY']),
        assignedVehicleId: null,
        documents: dlDocs,
        createdAt: formatISO(subDays(NOW, rng.int(30, 300))),
        updatedAt: formatISO(subDays(NOW, rng.int(0, 30))),
      };

      db.drivers[driverId] = driver;
      driverIds.push(driverId);
    }

    // Assign some drivers to vehicles
    const availableDrivers = driverIds.filter(
      (id) => db.drivers[id]?.assignedVehicleId === null,
    );
    const unassignedVehicles = vehicleIds.filter(
      (id) => db.vehicles[id]?.assignedDriverId === null,
    );
    const assignCount = Math.min(
      Math.floor(availableDrivers.length * 0.6),
      unassignedVehicles.length,
    );
    for (let i = 0; i < assignCount; i++) {
      const driver = db.drivers[availableDrivers[i]!];
      const vehicle = db.vehicles[unassignedVehicles[i]!];
      if (driver && vehicle) {
        driver.assignedVehicleId = vehicle.id;
        vehicle.assignedDriverId = driver.id;
      }
    }
  }

  // ── 6. Delegations ──
  db.delegations['del-1'] = {
    id: 'del-1',
    delegatorId: 'gv-demo-group-vendor',
    delegateId: 'sv-demo-sub-vendor-1',
    scope: ['ONBOARD_FLEET', 'ONBOARD_DRIVERS', 'VERIFY_DOCUMENTS'],
    enabled: true,
    createdAt: formatISO(subDays(NOW, 60)),
    updatedAt: formatISO(subDays(NOW, 10)),
  };
  db.delegations['del-2'] = {
    id: 'del-2',
    delegatorId: 'sa-site-admin',
    delegateId: 'gv-regional-ops',
    scope: ['MANAGE_TEAM', 'VERIFY_DOCUMENTS'],
    enabled: false,
    createdAt: formatISO(subDays(NOW, 90)),
    updatedAt: formatISO(subDays(NOW, 45)),
  };

  // ── 7. Initial audit entries ──
  db.auditLogs.push({
    id: 'audit-seed-1',
    at: formatISO(subDays(NOW, 30)),
    actorId: 'admin',
    action: 'SYSTEM_SEEDED',
    targetType: 'VENDOR',
    targetId: 'admin',
    details: { vendorCount: Object.keys(db.vendors).length },
  });

  return db;
}

// ─── Document generators ───────────────────────────────────────────

function generateVehicleDocs(
  rng: SeededRandom,
  vehicleId: string,
  uploadedBy: string,
): DocumentRecord[] {
  const docs: DocumentRecord[] = [];

  for (const docType of REQUIRED_VEHICLE_DOCS) {
    // ~3% chance of missing doc entirely
    if (rng.chance(0.03)) continue;

    docs.push(generateDoc(rng, `${vehicleId}-${docType}`, docType, uploadedBy));
  }

  return docs;
}

function generateDriverDocs(
  rng: SeededRandom,
  driverId: string,
  uploadedBy: string,
): DocumentRecord[] {
  const docs: DocumentRecord[] = [];

  for (const docType of REQUIRED_DRIVER_DOCS) {
    if (rng.chance(0.03)) continue;
    docs.push(generateDoc(rng, `${driverId}-${docType}`, docType, uploadedBy));
  }

  return docs;
}

function generateDoc(
  rng: SeededRandom,
  id: string,
  docType: DocType,
  uploadedBy: string,
): DocumentRecord {
  // Status distribution: ~75% approved valid, ~10% expired, ~10% expiring soon, ~8% pending, ~4% rejected
  const roll = rng.random();
  let verification: DocumentRecord['verification'];
  let expiryDate: string;

  if (roll < 0.04) {
    // Rejected
    verification = {
      status: 'REJECTED' as VerificationStatus,
      reviewedBy: 'admin',
      reviewedAt: formatISO(subDays(NOW, rng.int(1, 15))),
      rejectionReason: rng.pick([
        'Document is blurry',
        'Expired document uploaded',
        'Wrong document type',
        'Information mismatch',
      ]),
    };
    expiryDate = formatISO(addDays(NOW, rng.int(30, 365)), { representation: 'date' });
  } else if (roll < 0.12) {
    // Pending
    verification = { status: 'PENDING' as VerificationStatus };
    expiryDate = formatISO(addDays(NOW, rng.int(30, 365)), { representation: 'date' });
  } else if (roll < 0.22) {
    // Expired
    verification = { status: 'APPROVED' as VerificationStatus, reviewedBy: 'admin', reviewedAt: formatISO(subDays(NOW, rng.int(60, 200))) };
    expiryDate = formatISO(subDays(NOW, rng.int(1, 60)), { representation: 'date' });
  } else if (roll < 0.32) {
    // Expiring soon (within 30 days)
    verification = { status: 'APPROVED' as VerificationStatus, reviewedBy: 'admin', reviewedAt: formatISO(subDays(NOW, rng.int(30, 180))) };
    expiryDate = formatISO(addDays(NOW, rng.int(1, 30)), { representation: 'date' });
  } else {
    // Valid approved
    verification = { status: 'APPROVED' as VerificationStatus, reviewedBy: 'admin', reviewedAt: formatISO(subDays(NOW, rng.int(30, 180))) };
    expiryDate = formatISO(addDays(NOW, rng.int(31, 365)), { representation: 'date' });
  }

  return {
    id,
    type: docType,
    fileName: `${docType.toLowerCase()}_${id}.pdf`,
    fileSize: rng.int(50000, 4500000),
    mimeType: rng.pick(['application/pdf', 'image/jpeg', 'image/png']),
    expiryDate,
    uploadedAt: formatISO(subDays(NOW, rng.int(30, 300))),
    uploadedBy,
    verification,
  };
}

// ─── Stress mode ───────────────────────────────────────────────────

/**
 * Generates a large valid tree of `count` vendors for performance testing.
 * Builds a balanced tree respecting role hierarchy rules.
 * @param count Target vendor count (default 5000)
 * @param seed PRNG seed
 */
export function generateStressData(count = 5000, seed = 12345): SeedDB {
  const rng = new SeededRandom(seed);
  const db: SeedDB = {
    vendors: {},
    vehicles: {},
    drivers: {},
    delegations: {},
    auditLogs: [],
  };

  // Root
  db.vendors['admin'] = {
    id: 'admin',
    name: 'admin',
    email: 'admin@example.com',
    phone: '9000000000',
    role: 'ADMIN',
    parentId: null,
    tags: [],
    status: 'ACTIVE',
    grantedPermissions: ['MANAGE_TEAM', 'ONBOARD_FLEET', 'ONBOARD_DRIVERS', 'VERIFY_DOCUMENTS', 'MANAGE_BOOKINGS', 'MANAGE_PAYMENTS'],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };

  // Collect IDs by role for parent selection
  const idsByRole: Record<RoleKey, string[]> = {
    ADMIN: ['admin'],
    SITE_ADMIN: [],
    GROUP_VENDOR: [],
    SUB_VENDOR: [],
    DEPLOYMENT_ASSOCIATE: [],
  };

  // Distribution target: ~3% SA, ~10% GV, ~55% SV, ~32% DA

  // First pass: create site admins
  const saCount = Math.max(10, Math.floor(count * 0.03));
  for (let i = 0; i < saCount; i++) {
    const id = `stress-sa-${i}`;
    db.vendors[id] = makeStressVendor(rng, id, 'SITE_ADMIN', 'admin');
    idsByRole.SITE_ADMIN.push(id);
  }

  // Second pass: group vendors
  const gvCount = Math.floor(count * 0.1);
  for (let i = 0; i < gvCount; i++) {
    const id = `stress-gv-${i}`;
    const parentId = rng.pick(idsByRole.SITE_ADMIN);
    db.vendors[id] = makeStressVendor(rng, id, 'GROUP_VENDOR', parentId);
    idsByRole.GROUP_VENDOR.push(id);
  }

  // Third pass: sub vendors (bulk — allows nesting)
  const svCount = Math.floor(count * 0.55);
  for (let i = 0; i < svCount; i++) {
    const id = `stress-sv-${i}`;
    // 70% under group vendors, 30% under other sub vendors (if any exist)
    let parentId: string;
    if (rng.chance(0.7) || idsByRole.SUB_VENDOR.length === 0) {
      parentId = rng.pick(idsByRole.GROUP_VENDOR);
    } else {
      parentId = rng.pick(idsByRole.SUB_VENDOR);
    }
    db.vendors[id] = makeStressVendor(rng, id, 'SUB_VENDOR', parentId);
    idsByRole.SUB_VENDOR.push(id);
  }

  // Fourth pass: deployment associates
  const remaining = count - 1 - saCount - gvCount - svCount;
  for (let i = 0; i < remaining; i++) {
    const id = `stress-da-${i}`;
    const parentId = rng.pick(idsByRole.SUB_VENDOR.length > 0 ? idsByRole.SUB_VENDOR : idsByRole.GROUP_VENDOR);
    db.vendors[id] = makeStressVendor(rng, id, 'DEPLOYMENT_ASSOCIATE', parentId);
    idsByRole.DEPLOYMENT_ASSOCIATE.push(id);
  }

  return db;
}

function makeStressVendor(
  rng: SeededRandom,
  id: string,
  role: RoleKey,
  parentId: string,
): Vendor {
  const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)} ${id.slice(-3)}`;
  return {
    id,
    name,
    email: `${id}@example.com`,
    phone: `${rng.int(6, 9)}${String(rng.int(100000000, 999999999)).padStart(9, '0')}`,
    role,
    parentId,
    tags: rng.sample([...VENDOR_TAGS], rng.int(0, 2)),
    status: 'ACTIVE',
    grantedPermissions: [...ROLE_CONFIG[role].defaultPermissions],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}
