import { describe, it, expect } from 'vitest';
import type { Vendor, Vehicle, Driver } from '@/types';
import { canActorOverrideOrReactivate } from './seniority';
import { computeDashboardStats } from './dashboard';
import { buildChildrenIndex } from './tree';

describe('Seniority Enforcement (Section 8.4)', () => {
  const vendorsById: Record<string, Vendor> = {
    admin: {
      id: 'admin',
      name: 'Admin User',
      email: 'admin@example.com',
      phone: '9876543210',
      role: 'ADMIN',
      parentId: null,
      tags: [],
      status: 'ACTIVE',
      grantedPermissions: ['MANAGE_TEAM', 'ONBOARD_FLEET', 'ONBOARD_DRIVERS', 'VERIFY_DOCUMENTS', 'MANAGE_BOOKINGS', 'MANAGE_PAYMENTS'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    siteAdmin: {
      id: 'siteAdmin',
      name: 'Site Admin North',
      email: 'site@example.com',
      phone: '9876543211',
      role: 'SITE_ADMIN',
      parentId: 'admin',
      tags: [],
      status: 'ACTIVE',
      grantedPermissions: ['MANAGE_TEAM', 'ONBOARD_FLEET', 'ONBOARD_DRIVERS', 'VERIFY_DOCUMENTS'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    groupVendor: {
      id: 'groupVendor',
      name: 'Demo Group Vendor',
      email: 'group@example.com',
      phone: '9876543212',
      role: 'GROUP_VENDOR',
      parentId: 'siteAdmin',
      tags: [],
      status: 'ACTIVE',
      grantedPermissions: ['MANAGE_TEAM', 'ONBOARD_FLEET', 'ONBOARD_DRIVERS'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    subVendor1: {
      id: 'subVendor1',
      name: 'Demo Sub Vendor 1',
      email: 'sub1@example.com',
      phone: '9876543213',
      role: 'SUB_VENDOR',
      parentId: 'groupVendor',
      tags: [],
      status: 'ACTIVE',
      grantedPermissions: ['ONBOARD_FLEET', 'ONBOARD_DRIVERS'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    subVendor2: {
      id: 'subVendor2',
      name: 'Demo Sub Vendor 2',
      email: 'sub2@example.com',
      phone: '9876543214',
      role: 'SUB_VENDOR',
      parentId: 'groupVendor',
      tags: [],
      status: 'ACTIVE',
      grantedPermissions: ['ONBOARD_FLEET', 'ONBOARD_DRIVERS'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  };

  it('allows the original blocker to unblock/reactivate (actorId === blockerId)', () => {
    const res = canActorOverrideOrReactivate('groupVendor', 'groupVendor', vendorsById);
    expect(res.allowed).toBe(true);
  });

  it('allows root admin to unblock/reactivate any lower role', () => {
    const res = canActorOverrideOrReactivate('admin', 'groupVendor', vendorsById);
    expect(res.allowed).toBe(true);
  });

  it('allows a higher ancestor (Site Admin) to unblock what a lower node (Group Vendor) blocked', () => {
    const res = canActorOverrideOrReactivate('siteAdmin', 'groupVendor', vendorsById);
    expect(res.allowed).toBe(true);
  });

  it('blocks a peer or less senior role from unblocking a senior override', () => {
    // Sub vendor trying to unblock what group vendor blocked
    const res = canActorOverrideOrReactivate('subVendor1', 'groupVendor', vendorsById);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('Demo Group Vendor (Group Vendor) or a more senior supervisor');
  });

  it('blocks a peer sub-vendor from unblocking what another sub-vendor blocked', () => {
    const res = canActorOverrideOrReactivate('subVendor2', 'subVendor1', vendorsById);
    expect(res.allowed).toBe(false);
  });
});

describe('Dashboard Statistics Aggregator (computeDashboardStats)', () => {
  const vendorsById: Record<string, Vendor> = {
    root: {
      id: 'root',
      name: 'Root Vendor',
      email: 'root@example.com',
      phone: '9876543210',
      role: 'GROUP_VENDOR',
      parentId: null,
      tags: [],
      status: 'ACTIVE',
      grantedPermissions: ['MANAGE_TEAM', 'ONBOARD_FLEET', 'ONBOARD_DRIVERS', 'VERIFY_DOCUMENTS'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    sub1: {
      id: 'sub1',
      name: 'Sub Vendor One',
      email: 'sub1@example.com',
      phone: '9876543211',
      role: 'SUB_VENDOR',
      parentId: 'root',
      tags: [],
      status: 'ACTIVE',
      grantedPermissions: ['ONBOARD_FLEET', 'ONBOARD_DRIVERS'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    sub2: {
      id: 'sub2',
      name: 'Sub Vendor Two',
      email: 'sub2@example.com',
      phone: '9876543212',
      role: 'SUB_VENDOR',
      parentId: 'root',
      tags: [],
      status: 'SUSPENDED',
      suspendedBy: { vendorId: 'root', reason: 'Repeated compliance violations', at: '2026-01-01' },
      grantedPermissions: ['ONBOARD_FLEET', 'ONBOARD_DRIVERS'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  };

  const childrenIndex = buildChildrenIndex(vendorsById);

  const mockDocs = (expired = false) => [
    {
      id: 'd1',
      type: 'RC' as const,
      fileName: 'rc.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      expiryDate: expired ? '2020-01-01' : '2028-01-01',
      uploadedAt: '2026-01-01',
      uploadedBy: 'sub1',
      verification: { status: 'APPROVED' as const },
    },
    {
      id: 'd2',
      type: 'PERMIT' as const,
      fileName: 'permit.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      expiryDate: '2028-01-01',
      uploadedAt: '2026-01-01',
      uploadedBy: 'sub1',
      verification: { status: 'APPROVED' as const },
    },
    {
      id: 'd3',
      type: 'PUC' as const,
      fileName: 'puc.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      expiryDate: '2028-01-01',
      uploadedAt: '2026-01-01',
      uploadedBy: 'sub1',
      verification: { status: 'APPROVED' as const },
    },
    {
      id: 'd4',
      type: 'INSURANCE' as const,
      fileName: 'ins.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      expiryDate: '2028-01-01',
      uploadedAt: '2026-01-01',
      uploadedBy: 'sub1',
      verification: { status: 'APPROVED' as const },
    },
  ];

  const vehiclesById: Record<string, Vehicle> = {
    v1: {
      id: 'v1',
      ownerVendorId: 'sub1',
      regNo: 'KA01AB1111',
      model: 'Swift Dzire',
      seatingCapacity: 4,
      fuelType: 'PETROL',
      status: 'ACTIVE',
      assignedDriverId: null,
      documents: mockDocs(false),
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    v2: {
      id: 'v2',
      ownerVendorId: 'sub1',
      regNo: 'KA01AB2222',
      model: 'Innova Crysta',
      seatingCapacity: 7,
      fuelType: 'DIESEL',
      status: 'ACTIVE',
      assignedDriverId: null,
      documents: mockDocs(true), // non-compliant because expired RC
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    v3: {
      id: 'v3',
      ownerVendorId: 'sub2',
      regNo: 'KA01AB3333',
      model: 'Tata Tigor EV',
      seatingCapacity: 4,
      fuelType: 'EV',
      status: 'INACTIVE',
      blocked: { byVendorId: 'root', reason: 'Safety violation', at: '2026-01-01' },
      assignedDriverId: null,
      documents: mockDocs(false),
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  };

  const driversById: Record<string, Driver> = {
    dr1: {
      id: 'dr1',
      ownerVendorId: 'sub1',
      name: 'Ramesh Kumar',
      phone: '9876543210',
      licenseNumber: 'KA0120200001234',
      availability: 'AVAILABLE',
      assignedVehicleId: null,
      documents: [
        {
          id: 'dl1',
          type: 'DL',
          fileName: 'dl.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          expiryDate: '2028-01-01',
          uploadedAt: '2026-01-01',
          uploadedBy: 'sub1',
          verification: { status: 'APPROVED' },
        },
      ],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    dr2: {
      id: 'dr2',
      ownerVendorId: 'sub2',
      name: 'Suresh Patel',
      phone: '9876543211',
      licenseNumber: 'KA0120200001235',
      availability: 'ON_TRIP',
      assignedVehicleId: null,
      documents: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  };

  it('computes accurate subtree fleet, driver, and document metrics in one pass', () => {
    const stats = computeDashboardStats('root', vendorsById, childrenIndex, vehiclesById, driversById);

    expect(stats.totalSubVendors).toBe(2);
    expect(stats.totalVehicles).toBe(3);
    expect(stats.activeVehicles).toBe(1); // Only v1 is active and compliant
    expect(stats.nonCompliantVehicles).toBe(1); // v2 has expired RC
    expect(stats.blockedVehicles).toBe(1); // v3 is blocked
    expect(stats.driversTotal).toBe(2);
    expect(stats.driversAvailable).toBe(1);
    expect(stats.driversOnTrip).toBe(1);
    expect(stats.directSubVendors).toHaveLength(2);

    // Check risk levels
    const sub2Metric = stats.directSubVendors.find((s) => s.vendor.id === 'sub2');
    expect(sub2Metric?.riskLevel).toBe('HIGH_RISK'); // because sub2 is SUSPENDED and has blocked vehicle
  });
});
