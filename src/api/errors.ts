/**
 * Exact error code union conforming strictly to Section 15 of the specification.
 */
export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'CYCLE_DETECTED'
  | 'INVALID_PARENT_ROLE'
  | 'SAME_PARENT'
  | 'PERMISSION_DENIED'
  | 'OUT_OF_SCOPE'
  | 'DELEGATION_INVALID'
  | 'ACCOUNT_SUSPENDED'
  | 'DUPLICATE_REG_NO'
  | 'DRIVER_ALREADY_ASSIGNED'
  | 'VEHICLE_ALREADY_ASSIGNED'
  | 'VEHICLE_NON_COMPLIANT'
  | 'VEHICLE_BLOCKED'
  | 'DOC_INVALID_FILE'
  | 'ROLE_CHANGE_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>, status = 400) {
    super(message ?? ERROR_MESSAGES[code] ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Exact message catalog from Section 15 of the specification.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NETWORK_ERROR: "Couldn't reach the server. Check your connection and retry.",
  CYCLE_DETECTED: "A vendor can't be moved under itself or one of its own team members.",
  INVALID_PARENT_ROLE: 'A vendor role is not permitted under the selected parent.',
  SAME_PARENT: 'Vendor is already under this parent.',
  PERMISSION_DENIED: "You don't have permission to perform this action.",
  OUT_OF_SCOPE: "That vendor isn't part of your network.",
  DELEGATION_INVALID: "Your delegation for this action is disabled or doesn't include it.",
  ACCOUNT_SUSPENDED: 'This account or an ancestor account is suspended.',
  DUPLICATE_REG_NO: 'A vehicle with this registration already exists.',
  DRIVER_ALREADY_ASSIGNED: 'This driver is already assigned to a vehicle.',
  VEHICLE_ALREADY_ASSIGNED: 'This vehicle already has an assigned driver.',
  VEHICLE_NON_COMPLIANT: "Vehicle can't operate: documents missing, rejected, or expired.",
  VEHICLE_BLOCKED: 'This vehicle is blocked from operation.',
  DOC_INVALID_FILE: 'Upload a PDF, JPG or PNG under 5 MB.',
  ROLE_CHANGE_CONFLICT: "Can't change role: existing child vendors must be moved first.",
  VALIDATION_ERROR: 'Invalid input data.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'The operation could not be completed due to a conflict.',
};

export const DEFAULT_ERROR_MESSAGES = ERROR_MESSAGES;
