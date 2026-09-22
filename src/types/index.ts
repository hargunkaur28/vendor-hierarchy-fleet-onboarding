// ─── Role & Permission Enums ───────────────────────────────────────

export type RoleKey =
  | 'ADMIN'
  | 'SITE_ADMIN'
  | 'GROUP_VENDOR'
  | 'SUB_VENDOR'
  | 'DEPLOYMENT_ASSOCIATE';

export type PermissionKey =
  | 'MANAGE_TEAM'
  | 'ONBOARD_FLEET'
  | 'ONBOARD_DRIVERS'
  | 'VERIFY_DOCUMENTS'
  | 'MANAGE_BOOKINGS'
  | 'MANAGE_PAYMENTS';

// ─── Document & Compliance ─────────────────────────────────────────

export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'EV' | 'HYBRID';
export type DocType = 'DL' | 'RC' | 'PERMIT' | 'PUC' | 'INSURANCE';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type DocumentStatus =
  | 'MISSING'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXPIRING_SOON';

export interface DocumentRecord {
  id: string;
  type: DocType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiryDate: string;
  uploadedAt: string;
  uploadedBy: string;
  verification: {
    status: VerificationStatus;
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
  };
}

// ─── Vendor ────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: RoleKey;
  parentId: string | null;
  tags: string[];
  status: 'ACTIVE' | 'SUSPENDED';
  suspendedBy?: { vendorId: string; reason: string; at: string };
  grantedPermissions: PermissionKey[];
  createdAt: string;
  updatedAt: string;
}

// ─── Fleet ─────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  ownerVendorId: string;
  regNo: string;
  model: string;
  seatingCapacity: number;
  fuelType: FuelType;
  status: 'ACTIVE' | 'INACTIVE';
  blocked?: { byVendorId: string; reason: string; at: string };
  assignedDriverId: string | null;
  documents: DocumentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  ownerVendorId: string;
  name: string;
  phone: string;
  licenseNumber: string;
  availability: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';
  assignedVehicleId: string | null;
  documents: DocumentRecord[];
  createdAt: string;
  updatedAt: string;
}

// ─── Delegation ────────────────────────────────────────────────────

export interface Delegation {
  id: string;
  delegatorId: string;
  delegateId: string;
  scope: PermissionKey[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Audit ─────────────────────────────────────────────────────────

export type AuditTargetType =
  | 'VENDOR'
  | 'VEHICLE'
  | 'DRIVER'
  | 'DOCUMENT'
  | 'DELEGATION';

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  onBehalfOfId?: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  details: Record<string, unknown>;
}

// ─── Store Shape ───────────────────────────────────────────────────

export interface Session {
  actorId: string;
  actingOnBehalfOf: string | null;
}

export type TreeView = 'tree' | 'horizontal' | 'compact';

export interface UIState {
  expandedIds: Set<string>;
  view: TreeView;
  filters: {
    search: string;
    tags: string[];
    roles: RoleKey[];
  };
}

// ─── Authorization ─────────────────────────────────────────────────

export type AuthResult =
  | { allowed: true; via: 'OWN' | 'DELEGATION'; onBehalfOfId?: string }
  | { allowed: false; code: ErrorCode; message: string };

export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'OUT_OF_SCOPE'
  | 'DELEGATION_INVALID'
  | 'ACCOUNT_SUSPENDED'
  | 'NOT_FOUND'
  | 'CYCLE_DETECTED'
  | 'INVALID_PARENT_ROLE'
  | 'SAME_PARENT'
  | 'ROLE_CHANGE_CONFLICT'
  | 'DUPLICATE_REG_NO'
  | 'DRIVER_ALREADY_ASSIGNED'
  | 'VEHICLE_ALREADY_ASSIGNED'
  | 'VEHICLE_NON_COMPLIANT'
  | 'VEHICLE_BLOCKED'
  | 'DOC_INVALID_FILE'
  | 'CONFLICT';
