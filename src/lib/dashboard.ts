import type {
  Vendor,
  Vehicle,
  Driver,
  DocType,
} from '@/types';
import { getDescendantIds } from './tree';
import { isVehicleCompliant, getDocumentStatus } from './compliance';
import { daysUntilExpiry } from './dates';

export type RiskLevel = 'HIGH_RISK' | 'MEDIUM_RISK' | 'CLEAN';

export interface SubVendorRowMetric {
  vendor: Vendor;
  totalVehicles: number;
  activeVehicles: number;
  inactiveVehicles: number;
  nonCompliantVehicles: number;
  blockedVehicles: number;
  totalDrivers: number;
  availableDrivers: number;
  onTripDrivers: number;
  offDutyDrivers: number;
  pendingDocsCount: number;
  expiredDocsCount: number;
  complianceRate: number; // 0 - 100
  riskLevel: RiskLevel;
}

export interface PendingDocWidgetDetail {
  id: string;
  entityType: 'VEHICLE' | 'DRIVER';
  entityName: string;
  docType: DocType;
  ownerVendorName: string;
  uploadedAt: string;
  fileName: string;
}

export interface ExpiryReminderDetail {
  id: string;
  entityType: 'VEHICLE' | 'DRIVER';
  entityName: string;
  docType: DocType;
  ownerVendorName: string;
  expiryDate: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface DashboardStats {
  // Stat cards metrics
  totalSubVendors: number;
  totalVehicles: number;
  activeVehicles: number;
  inactiveVehicles: number;
  blockedVehicles: number;
  nonCompliantVehicles: number;
  pendingVerificationsCount: number;
  expiredDocsCount: number;
  expiringSoonDocsCount: number;
  driversTotal: number;
  driversAvailable: number;
  driversOnTrip: number;
  driversOffDuty: number;
  overallComplianceRate: number;

  // Direct sub-vendors table
  directSubVendors: SubVendorRowMetric[];

  // Top 5 oldest pending verifications
  pendingVerifications: PendingDocWidgetDetail[];

  // Expiry reminders (expired or expiring in <= 30 days)
  expiryReminders: ExpiryReminderDetail[];

  // Donut chart distribution
  fleetStatusDistribution: {
    operational: number;
    nonCompliant: number;
    inactive: number;
    blocked: number;
  };
}

/**
 * Computes all Super Vendor dashboard metrics in a single aggregation pass O(V + D + Veh).
 * Scoped to the active actor's subtree.
 *
 * @param rootVendorId The actor's vendor ID
 * @param vendorsById Normalized vendor map
 * @param childrenIndex Adjacency index
 * @param vehiclesById Normalized vehicle map
 * @param driversById Normalized driver map
 * @param now Current date for compliance calculation
 *
 * @complexity O(V + D + Veh) where V = vendors in subtree, D = drivers, Veh = vehicles
 */
export function computeDashboardStats(
  rootVendorId: string,
  vendorsById: Record<string, Vendor>,
  childrenIndex: Record<string, string[]>,
  vehiclesById: Record<string, Vehicle>,
  driversById: Record<string, Driver>,
  now: Date = new Date(),
): DashboardStats {
  const directChildIds = childrenIndex[rootVendorId] ?? [];
  const descendantIds = getDescendantIds(rootVendorId, childrenIndex);
  const allSubtreeVendorIds = new Set([rootVendorId, ...descendantIds]);

  // Pre-calculate descendant sets for each direct child to assign vehicles/drivers to direct sub-vendors
  const directSubtreeMap = new Map<string, Set<string>>();
  for (const childId of directChildIds) {
    const subDescendants = getDescendantIds(childId, childrenIndex);
    directSubtreeMap.set(childId, new Set([childId, ...subDescendants]));
  }

  // Intermediate accumulators per direct sub-vendor
  const subVendorAccumulators = new Map<
    string,
    {
      totalVehicles: number;
      activeVehicles: number;
      inactiveVehicles: number;
      nonCompliantVehicles: number;
      blockedVehicles: number;
      totalDrivers: number;
      availableDrivers: number;
      onTripDrivers: number;
      offDutyDrivers: number;
      pendingDocsCount: number;
      expiredDocsCount: number;
    }
  >();

  for (const childId of directChildIds) {
    subVendorAccumulators.set(childId, {
      totalVehicles: 0,
      activeVehicles: 0,
      inactiveVehicles: 0,
      nonCompliantVehicles: 0,
      blockedVehicles: 0,
      totalDrivers: 0,
      availableDrivers: 0,
      onTripDrivers: 0,
      offDutyDrivers: 0,
      pendingDocsCount: 0,
      expiredDocsCount: 0,
    });
  }

  // Global subtree metrics
  let totalVehicles = 0;
  let activeVehicles = 0;
  let inactiveVehicles = 0;
  let blockedVehicles = 0;
  let nonCompliantVehicles = 0;
  let compliantVehiclesCount = 0;

  let driversTotal = 0;
  let driversAvailable = 0;
  let driversOnTrip = 0;
  let driversOffDuty = 0;

  let pendingVerificationsCount = 0;
  let expiredDocsCount = 0;
  let expiringSoonDocsCount = 0;

  const allPendingItems: Array<PendingDocWidgetDetail & { rawDate: number }> = [];
  const allExpiryReminders: ExpiryReminderDetail[] = [];

  // Helper to find which direct sub-vendor an owner vendor belongs to
  const findDirectSubVendorId = (ownerId: string): string | null => {
    if (directSubtreeMap.has(ownerId)) return ownerId;
    for (const [childId, set] of directSubtreeMap.entries()) {
      if (set.has(ownerId)) return childId;
    }
    return null;
  };

  // 1. Process vehicles in subtree
  for (const vehicle of Object.values(vehiclesById)) {
    if (!allSubtreeVendorIds.has(vehicle.ownerVendorId)) continue;

    totalVehicles++;
    const directParentId = findDirectSubVendorId(vehicle.ownerVendorId);
    const subAcc = directParentId ? subVendorAccumulators.get(directParentId) : undefined;
    if (subAcc) subAcc.totalVehicles++;

    const isBlocked = Boolean(vehicle.blocked);
    const { compliant } = isVehicleCompliant(vehicle, now);

    if (isBlocked) {
      blockedVehicles++;
      if (subAcc) subAcc.blockedVehicles++;
    }

    if (!compliant) {
      nonCompliantVehicles++;
      if (subAcc) subAcc.nonCompliantVehicles++;
    } else {
      compliantVehiclesCount++;
    }

    if (vehicle.status === 'ACTIVE' && compliant && !isBlocked) {
      activeVehicles++;
      if (subAcc) subAcc.activeVehicles++;
    } else {
      inactiveVehicles++;
      if (subAcc) subAcc.inactiveVehicles++;
    }

    // Inspect vehicle documents
    const ownerName = vendorsById[vehicle.ownerVendorId]?.name ?? 'Unknown Vendor';
    for (const doc of vehicle.documents) {
      const docStatus = getDocumentStatus(doc, now);
      const days = daysUntilExpiry(doc.expiryDate, now);

      if (doc.verification.status === 'PENDING') {
        pendingVerificationsCount++;
        if (subAcc) subAcc.pendingDocsCount++;
        allPendingItems.push({
          id: doc.id,
          entityType: 'VEHICLE',
          entityName: `${vehicle.regNo} (${vehicle.model})`,
          docType: doc.type,
          ownerVendorName: ownerName,
          uploadedAt: doc.uploadedAt,
          fileName: doc.fileName,
          rawDate: new Date(doc.uploadedAt).getTime() || 0,
        });
      }

      if (docStatus === 'EXPIRED') {
        expiredDocsCount++;
        if (subAcc) subAcc.expiredDocsCount++;
        allExpiryReminders.push({
          id: doc.id,
          entityType: 'VEHICLE',
          entityName: vehicle.regNo,
          docType: doc.type,
          ownerVendorName: ownerName,
          expiryDate: doc.expiryDate,
          daysRemaining: days,
          isExpired: true,
        });
      } else if (docStatus === 'EXPIRING_SOON') {
        expiringSoonDocsCount++;
        allExpiryReminders.push({
          id: doc.id,
          entityType: 'VEHICLE',
          entityName: vehicle.regNo,
          docType: doc.type,
          ownerVendorName: ownerName,
          expiryDate: doc.expiryDate,
          daysRemaining: days,
          isExpired: false,
        });
      }
    }
  }

  // 2. Process drivers in subtree
  for (const driver of Object.values(driversById)) {
    if (!allSubtreeVendorIds.has(driver.ownerVendorId)) continue;

    driversTotal++;
    const directParentId = findDirectSubVendorId(driver.ownerVendorId);
    const subAcc = directParentId ? subVendorAccumulators.get(directParentId) : undefined;
    if (subAcc) subAcc.totalDrivers++;

    if (driver.availability === 'AVAILABLE') {
      driversAvailable++;
      if (subAcc) subAcc.availableDrivers++;
    } else if (driver.availability === 'ON_TRIP') {
      driversOnTrip++;
      if (subAcc) subAcc.onTripDrivers++;
    } else {
      driversOffDuty++;
      if (subAcc) subAcc.offDutyDrivers++;
    }

    // Inspect driver documents (DL)
    const ownerName = vendorsById[driver.ownerVendorId]?.name ?? 'Unknown Vendor';
    for (const doc of driver.documents) {
      const docStatus = getDocumentStatus(doc, now);
      const days = daysUntilExpiry(doc.expiryDate, now);

      if (doc.verification.status === 'PENDING') {
        pendingVerificationsCount++;
        if (subAcc) subAcc.pendingDocsCount++;
        allPendingItems.push({
          id: doc.id,
          entityType: 'DRIVER',
          entityName: driver.name,
          docType: doc.type,
          ownerVendorName: ownerName,
          uploadedAt: doc.uploadedAt,
          fileName: doc.fileName,
          rawDate: new Date(doc.uploadedAt).getTime() || 0,
        });
      }

      if (docStatus === 'EXPIRED') {
        expiredDocsCount++;
        if (subAcc) subAcc.expiredDocsCount++;
        allExpiryReminders.push({
          id: doc.id,
          entityType: 'DRIVER',
          entityName: driver.name,
          docType: doc.type,
          ownerVendorName: ownerName,
          expiryDate: doc.expiryDate,
          daysRemaining: days,
          isExpired: true,
        });
      } else if (docStatus === 'EXPIRING_SOON') {
        expiringSoonDocsCount++;
        allExpiryReminders.push({
          id: doc.id,
          entityType: 'DRIVER',
          entityName: driver.name,
          docType: doc.type,
          ownerVendorName: ownerName,
          expiryDate: doc.expiryDate,
          daysRemaining: days,
          isExpired: false,
        });
      }
    }
  }

  // 3. Assemble direct sub-vendors row metrics
  const directSubVendors: SubVendorRowMetric[] = directChildIds.map((childId) => {
    const vendor = vendorsById[childId]!;
    const acc = subVendorAccumulators.get(childId)!;
    const compliant = acc.totalVehicles - acc.nonCompliantVehicles;
    const complianceRate =
      acc.totalVehicles > 0 ? Math.round((compliant / acc.totalVehicles) * 100) : 100;

    let riskLevel: RiskLevel = 'CLEAN';
    if (vendor.status === 'SUSPENDED' || acc.blockedVehicles > 0 || acc.nonCompliantVehicles >= 2 || complianceRate < 60) {
      riskLevel = 'HIGH_RISK';
    } else if (acc.nonCompliantVehicles > 0 || acc.expiredDocsCount > 0 || complianceRate < 90) {
      riskLevel = 'MEDIUM_RISK';
    }

    return {
      vendor,
      totalVehicles: acc.totalVehicles,
      activeVehicles: acc.activeVehicles,
      inactiveVehicles: acc.inactiveVehicles,
      nonCompliantVehicles: acc.nonCompliantVehicles,
      blockedVehicles: acc.blockedVehicles,
      totalDrivers: acc.totalDrivers,
      availableDrivers: acc.availableDrivers,
      onTripDrivers: acc.onTripDrivers,
      offDutyDrivers: acc.offDutyDrivers,
      pendingDocsCount: acc.pendingDocsCount,
      expiredDocsCount: acc.expiredDocsCount,
      complianceRate,
      riskLevel,
    };
  });

  // Sort pending verifications: oldest first (Section 14 F8: "top 5 oldest")
  allPendingItems.sort((a, b) => a.rawDate - b.rawDate);
  const pendingVerifications = allPendingItems.slice(0, 5).map(({ rawDate: _rawDate, ...item }) => item);

  // Sort expiry reminders: most urgent first (expired first, then smallest days remaining)
  allExpiryReminders.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const overallComplianceRate =
    totalVehicles > 0 ? Math.round((compliantVehiclesCount / totalVehicles) * 100) : 100;

  return {
    totalSubVendors: directChildIds.length,
    totalVehicles,
    activeVehicles,
    inactiveVehicles,
    blockedVehicles,
    nonCompliantVehicles,
    pendingVerificationsCount,
    expiredDocsCount,
    expiringSoonDocsCount,
    driversTotal,
    driversAvailable,
    driversOnTrip,
    driversOffDuty,
    overallComplianceRate,
    directSubVendors,
    pendingVerifications,
    expiryReminders: allExpiryReminders.slice(0, 10),
    fleetStatusDistribution: {
      operational: activeVehicles,
      nonCompliant: nonCompliantVehicles,
      inactive: inactiveVehicles,
      blocked: blockedVehicles,
    },
  };
}
