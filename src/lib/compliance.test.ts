import { describe, it, expect } from 'vitest';
import type { DocumentRecord, Vehicle, Driver } from '@/types';
import {
  getDocumentStatus,
  isVehicleCompliant,
  isDriverCompliant,
  getEffectiveVehicleStatus,
} from './compliance';
import { addDays, subDays, formatISO } from 'date-fns';

const NOW = new Date('2024-06-15T12:00:00Z');

function makeDoc(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc1',
    type: 'RC',
    fileName: 'rc.pdf',
    fileSize: 1000,
    mimeType: 'application/pdf',
    expiryDate: formatISO(addDays(NOW, 60), { representation: 'date' }),
    uploadedAt: '2024-01-01T00:00:00Z',
    uploadedBy: 'v1',
    verification: { status: 'APPROVED' },
    ...overrides,
  };
}

function makeVehicle(docs: DocumentRecord[], overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh1',
    ownerVendorId: 'v1',
    regNo: 'KA01AB1234',
    model: 'Swift Dzire',
    seatingCapacity: 4,
    fuelType: 'PETROL',
    status: 'ACTIVE',
    assignedDriverId: null,
    documents: docs,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDriver(docs: DocumentRecord[], overrides: Partial<Driver> = {}): Driver {
  return {
    id: 'drv1',
    ownerVendorId: 'v1',
    name: 'Test Driver',
    phone: '9876543210',
    licenseNumber: 'KA0120240000001',
    availability: 'AVAILABLE',
    assignedVehicleId: null,
    documents: docs,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── getDocumentStatus ─────────────────────────────────────────────

describe('getDocumentStatus', () => {
  it('returns APPROVED for valid approved doc', () => {
    const doc = makeDoc({ expiryDate: formatISO(addDays(NOW, 60), { representation: 'date' }) });
    expect(getDocumentStatus(doc, NOW)).toBe('APPROVED');
  });

  it('returns EXPIRED for doc expired yesterday', () => {
    const doc = makeDoc({ expiryDate: formatISO(subDays(NOW, 1), { representation: 'date' }) });
    expect(getDocumentStatus(doc, NOW)).toBe('EXPIRED');
  });

  it('returns EXPIRING_SOON for doc expiring in exactly 30 days', () => {
    const doc = makeDoc({ expiryDate: formatISO(addDays(NOW, 30), { representation: 'date' }) });
    expect(getDocumentStatus(doc, NOW)).toBe('EXPIRING_SOON');
  });

  it('returns APPROVED for doc expiring in 31 days (just outside window)', () => {
    const doc = makeDoc({ expiryDate: formatISO(addDays(NOW, 31), { representation: 'date' }) });
    expect(getDocumentStatus(doc, NOW)).toBe('APPROVED');
  });

  it('returns EXPIRED for doc expiring today (0 days left)', () => {
    const doc = makeDoc({ expiryDate: formatISO(NOW, { representation: 'date' }) });
    expect(getDocumentStatus(doc, NOW)).toBe('EXPIRING_SOON');
  });

  it('returns PENDING for pending doc regardless of expiry', () => {
    const doc = makeDoc({
      verification: { status: 'PENDING' },
      expiryDate: formatISO(addDays(NOW, 60), { representation: 'date' }),
    });
    expect(getDocumentStatus(doc, NOW)).toBe('PENDING');
  });

  it('returns REJECTED for rejected doc regardless of expiry', () => {
    const doc = makeDoc({
      verification: { status: 'REJECTED', rejectionReason: 'Blurry image' },
      expiryDate: formatISO(addDays(NOW, 60), { representation: 'date' }),
    });
    expect(getDocumentStatus(doc, NOW)).toBe('REJECTED');
  });
});

// ─── isVehicleCompliant ────────────────────────────────────────────

describe('isVehicleCompliant', () => {
  it('compliant when all 4 docs present, approved, and valid', () => {
    const docs = [
      makeDoc({ id: 'd1', type: 'RC' }),
      makeDoc({ id: 'd2', type: 'PERMIT' }),
      makeDoc({ id: 'd3', type: 'PUC' }),
      makeDoc({ id: 'd4', type: 'INSURANCE' }),
    ];
    const result = isVehicleCompliant(makeVehicle(docs), NOW);
    expect(result.compliant).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('non-compliant when a doc is missing', () => {
    const docs = [
      makeDoc({ id: 'd1', type: 'RC' }),
      makeDoc({ id: 'd2', type: 'PERMIT' }),
      makeDoc({ id: 'd3', type: 'PUC' }),
      // INSURANCE missing
    ];
    const result = isVehicleCompliant(makeVehicle(docs), NOW);
    expect(result.compliant).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]!.docType).toBe('INSURANCE');
    expect(result.reasons[0]!.status).toBe('MISSING');
  });

  it('non-compliant when a doc is expired', () => {
    const docs = [
      makeDoc({ id: 'd1', type: 'RC' }),
      makeDoc({ id: 'd2', type: 'PERMIT' }),
      makeDoc({
        id: 'd3',
        type: 'PUC',
        expiryDate: formatISO(subDays(NOW, 5), { representation: 'date' }),
      }),
      makeDoc({ id: 'd4', type: 'INSURANCE' }),
    ];
    const result = isVehicleCompliant(makeVehicle(docs), NOW);
    expect(result.compliant).toBe(false);
    expect(result.reasons.find((r) => r.docType === 'PUC')?.status).toBe('EXPIRED');
  });

  it('non-compliant when a doc is rejected', () => {
    const docs = [
      makeDoc({ id: 'd1', type: 'RC' }),
      makeDoc({ id: 'd2', type: 'PERMIT' }),
      makeDoc({ id: 'd3', type: 'PUC' }),
      makeDoc({
        id: 'd4',
        type: 'INSURANCE',
        verification: { status: 'REJECTED', rejectionReason: 'Invalid' },
      }),
    ];
    const result = isVehicleCompliant(makeVehicle(docs), NOW);
    expect(result.compliant).toBe(false);
    expect(result.reasons.find((r) => r.docType === 'INSURANCE')?.status).toBe('REJECTED');
  });

  it('non-compliant when a doc is pending', () => {
    const docs = [
      makeDoc({ id: 'd1', type: 'RC' }),
      makeDoc({ id: 'd2', type: 'PERMIT', verification: { status: 'PENDING' } }),
      makeDoc({ id: 'd3', type: 'PUC' }),
      makeDoc({ id: 'd4', type: 'INSURANCE' }),
    ];
    const result = isVehicleCompliant(makeVehicle(docs), NOW);
    expect(result.compliant).toBe(false);
  });

  it('compliant when doc is EXPIRING_SOON (still valid)', () => {
    const docs = [
      makeDoc({ id: 'd1', type: 'RC', expiryDate: formatISO(addDays(NOW, 15), { representation: 'date' }) }),
      makeDoc({ id: 'd2', type: 'PERMIT' }),
      makeDoc({ id: 'd3', type: 'PUC' }),
      makeDoc({ id: 'd4', type: 'INSURANCE' }),
    ];
    const result = isVehicleCompliant(makeVehicle(docs), NOW);
    expect(result.compliant).toBe(true);
  });
});

// ─── isDriverCompliant ─────────────────────────────────────────────

describe('isDriverCompliant', () => {
  it('compliant when DL present, approved, valid', () => {
    const docs = [makeDoc({ id: 'dl1', type: 'DL' })];
    const result = isDriverCompliant(makeDriver(docs), NOW);
    expect(result.compliant).toBe(true);
  });

  it('non-compliant when DL missing', () => {
    const result = isDriverCompliant(makeDriver([]), NOW);
    expect(result.compliant).toBe(false);
    expect(result.reasons[0]!.docType).toBe('DL');
  });

  it('non-compliant when DL expired', () => {
    const docs = [
      makeDoc({
        id: 'dl1',
        type: 'DL',
        expiryDate: formatISO(subDays(NOW, 1), { representation: 'date' }),
      }),
    ];
    const result = isDriverCompliant(makeDriver(docs), NOW);
    expect(result.compliant).toBe(false);
  });
});

// ─── getEffectiveVehicleStatus ─────────────────────────────────────

describe('getEffectiveVehicleStatus', () => {
  it('BLOCKED when vehicle has blocked field', () => {
    const docs = [
      makeDoc({ id: 'd1', type: 'RC' }),
      makeDoc({ id: 'd2', type: 'PERMIT' }),
      makeDoc({ id: 'd3', type: 'PUC' }),
      makeDoc({ id: 'd4', type: 'INSURANCE' }),
    ];
    const vehicle = makeVehicle(docs, {
      blocked: { byVendorId: 'admin', reason: 'Audit', at: '2024-01-01T00:00:00Z' },
    });
    expect(getEffectiveVehicleStatus(vehicle, NOW)).toBe('BLOCKED');
  });

  it('INACTIVE when status is INACTIVE', () => {
    const docs = [
      makeDoc({ id: 'd1', type: 'RC' }),
      makeDoc({ id: 'd2', type: 'PERMIT' }),
      makeDoc({ id: 'd3', type: 'PUC' }),
      makeDoc({ id: 'd4', type: 'INSURANCE' }),
    ];
    expect(getEffectiveVehicleStatus(makeVehicle(docs, { status: 'INACTIVE' }), NOW)).toBe('INACTIVE');
  });

  it('NON_COMPLIANT when missing docs', () => {
    expect(getEffectiveVehicleStatus(makeVehicle([]), NOW)).toBe('NON_COMPLIANT');
  });

  it('OPERATIONAL when compliant, active, not blocked', () => {
    const docs = [
      makeDoc({ id: 'd1', type: 'RC' }),
      makeDoc({ id: 'd2', type: 'PERMIT' }),
      makeDoc({ id: 'd3', type: 'PUC' }),
      makeDoc({ id: 'd4', type: 'INSURANCE' }),
    ];
    expect(getEffectiveVehicleStatus(makeVehicle(docs), NOW)).toBe('OPERATIONAL');
  });
});
