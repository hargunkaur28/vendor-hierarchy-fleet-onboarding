import type { DocumentRecord, DocumentStatus, DocType, Vehicle, Driver } from '@/types';
import { EXPIRY_WARNING_DAYS, REQUIRED_VEHICLE_DOCS, REQUIRED_DRIVER_DOCS } from '@/config/constants';
import { daysUntilExpiry } from './dates';

/**
 * Determines the display status of a single document based on its
 * verification status and expiry date.
 *
 * This is the shared function — fix here, not at each call site.
 *
 * @complexity O(1)
 */
export function getDocumentStatus(
  doc: DocumentRecord,
  now: Date = new Date(),
): DocumentStatus {
  if (doc.verification.status === 'REJECTED') return 'REJECTED';
  if (doc.verification.status === 'PENDING') return 'PENDING';

  // APPROVED — check expiry
  const days = daysUntilExpiry(doc.expiryDate, now);
  if (days < 0) return 'EXPIRED';
  if (days <= EXPIRY_WARNING_DAYS) return 'EXPIRING_SOON';
  return 'APPROVED';
}

export interface ComplianceReason {
  docType: DocType;
  status: DocumentStatus;
  detail: string;
}

/**
 * Checks if a vehicle is compliant: all 4 required docs present, APPROVED, and not expired.
 *
 * This is the shared function — fix here, not at each call site.
 *
 * @returns Object with compliant flag and specific reasons if non-compliant
 * @complexity O(1) — max 4 required docs, each with at most one document record
 */
export function isVehicleCompliant(
  vehicle: Vehicle,
  now: Date = new Date(),
): { compliant: boolean; reasons: ComplianceReason[] } {
  const reasons: ComplianceReason[] = [];

  for (const requiredType of REQUIRED_VEHICLE_DOCS) {
    const doc = vehicle.documents.find((d) => d.type === requiredType);
    if (!doc) {
      reasons.push({
        docType: requiredType,
        status: 'MISSING',
        detail: `${requiredType} missing`,
      });
      continue;
    }

    const status = getDocumentStatus(doc, now);
    if (status !== 'APPROVED' && status !== 'EXPIRING_SOON') {
      reasons.push({
        docType: requiredType,
        status,
        detail: status === 'EXPIRED'
          ? `${requiredType} expired on ${doc.expiryDate.slice(0, 10)}`
          : status === 'REJECTED'
            ? `${requiredType} rejected${doc.verification.rejectionReason ? `: ${doc.verification.rejectionReason}` : ''}`
            : `${requiredType} pending verification`,
      });
    }
  }

  return { compliant: reasons.length === 0, reasons };
}

/**
 * Checks if a driver is compliant: DL present, APPROVED, and not expired.
 * @complexity O(1)
 */
export function isDriverCompliant(
  driver: Driver,
  now: Date = new Date(),
): { compliant: boolean; reasons: ComplianceReason[] } {
  const reasons: ComplianceReason[] = [];

  for (const requiredType of REQUIRED_DRIVER_DOCS) {
    const doc = driver.documents.find((d) => d.type === requiredType);
    if (!doc) {
      reasons.push({
        docType: requiredType,
        status: 'MISSING',
        detail: `${requiredType} missing`,
      });
      continue;
    }

    const status = getDocumentStatus(doc, now);
    if (status !== 'APPROVED' && status !== 'EXPIRING_SOON') {
      reasons.push({
        docType: requiredType,
        status,
        detail: status === 'EXPIRED'
          ? `${requiredType} expired on ${doc.expiryDate.slice(0, 10)}`
          : status === 'REJECTED'
            ? `${requiredType} rejected`
            : `${requiredType} pending verification`,
      });
    }
  }

  return { compliant: reasons.length === 0, reasons };
}

/**
 * Derives the effective operational status of a vehicle.
 * A vehicle is OPERATIONAL only if compliant, not blocked, and status is ACTIVE.
 * @complexity O(1)
 */
export function getEffectiveVehicleStatus(
  vehicle: Vehicle,
  now: Date = new Date(),
): 'OPERATIONAL' | 'NON_COMPLIANT' | 'BLOCKED' | 'INACTIVE' {
  if (vehicle.blocked) return 'BLOCKED';
  if (vehicle.status === 'INACTIVE') return 'INACTIVE';
  const { compliant } = isVehicleCompliant(vehicle, now);
  if (!compliant) return 'NON_COMPLIANT';
  return 'OPERATIONAL';
}
