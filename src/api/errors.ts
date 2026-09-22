export type ErrorCode =
  | 'ROOT_VENDOR_IMMUTABLE'
  | 'PARENT_NOT_FOUND'
  | 'VENDOR_NOT_FOUND'
  | 'CYCLE_DETECTED'
  | 'ROLE_RESTRICTION'
  | 'SUSPENDED_PARENT'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'OUT_OF_SCOPE'
  | 'DELEGATION_EXPIRED'
  | 'SUSPENDED_ANCESTOR'
  | 'DUPLICATE_REG_NO'
  | 'DUPLICATE_DRIVER_PHONE'
  | 'NON_COMPLIANT_VEHICLE'
  | 'NON_COMPLIANT_DRIVER'
  | 'DRIVER_ALREADY_ASSIGNED'
  | 'VEHICLE_NOT_FOUND'
  | 'DRIVER_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'DELEGATION_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>, status = 400) {
    super(message ?? DEFAULT_ERROR_MESSAGES[code] ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  ROOT_VENDOR_IMMUTABLE: 'Root vendor cannot be moved, suspended, or modified.',
  PARENT_NOT_FOUND: 'Selected parent vendor does not exist.',
  VENDOR_NOT_FOUND: 'Vendor not found.',
  CYCLE_DETECTED: 'Cannot move vendor under itself or its descendants (cycle detected).',
  ROLE_RESTRICTION: 'Role hierarchy violation: vendor role is not permitted under selected parent.',
  SUSPENDED_PARENT: 'Cannot move under a suspended parent vendor.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action.',
  OUT_OF_SCOPE: 'Target vendor is outside your administrative scope.',
  DELEGATION_EXPIRED: 'Your delegation to manage this vendor has expired or is disabled.',
  SUSPENDED_ANCESTOR: 'Action blocked because an ancestor vendor in the hierarchy is suspended.',
  DUPLICATE_REG_NO: 'A vehicle with this registration number already exists.',
  DUPLICATE_DRIVER_PHONE: 'A driver with this phone number already exists.',
  NON_COMPLIANT_VEHICLE: 'Vehicle cannot be activated: missing, rejected, or expired documents.',
  NON_COMPLIANT_DRIVER: 'Driver cannot be assigned: license is invalid or expired.',
  DRIVER_ALREADY_ASSIGNED: 'This driver is already assigned to an active vehicle.',
  VEHICLE_NOT_FOUND: 'Vehicle not found.',
  DRIVER_NOT_FOUND: 'Driver not found.',
  DOCUMENT_NOT_FOUND: 'Document not found.',
  DELEGATION_NOT_FOUND: 'Delegation record not found.',
  NETWORK_ERROR: 'Simulated network failure. Please retry.',
  VALIDATION_ERROR: 'Invalid input data.',
};
