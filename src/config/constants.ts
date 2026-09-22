import type { DocType } from '@/types';

/** Number of days before expiry to flag as EXPIRING_SOON */
export const EXPIRY_WARNING_DAYS = 30;

/** Maximum file size for document uploads (bytes) */
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/** Accepted MIME types for document uploads */
export const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

/** Required document types per entity */
export const REQUIRED_VEHICLE_DOCS: DocType[] = ['RC', 'PERMIT', 'PUC', 'INSURANCE'];
export const REQUIRED_DRIVER_DOCS: DocType[] = ['DL'];

/** Indian vehicle registration number pattern (after normalization) */
export const REG_NO_PATTERN = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/;

/** Indian mobile phone pattern (10-digit, starts 6-9) */
export const PHONE_PATTERN = /^[6-9]\d{9}$/;

/** Indian driving license pattern (after normalization: uppercase, no spaces) */
export const LICENSE_PATTERN = /^[A-Z]{2}\d{2}\d{11}$/;

/** Min characters for document rejection reason */
export const MIN_REJECTION_REASON_LENGTH = 5;

/** Undo toast duration in milliseconds */
export const UNDO_TIMEOUT_MS = 5000;

/** Search debounce in milliseconds */
export const SEARCH_DEBOUNCE_MS = 250;

/** Mock API latency range (ms), overridden by VITE_API_LATENCY */
export const API_LATENCY_MIN = 300;
export const API_LATENCY_MAX = 800;

/** Default failure injection rate (0 = off, 0.15 = 15%) */
export const DEFAULT_FAILURE_RATE = 0;

/** localStorage key for persisted DB */
export const STORAGE_KEY = 'vendorhub:v1';

/** Available vendor tags */
export const VENDOR_TAGS = [
  'North',
  'South',
  'East',
  'West',
  'Premium',
  'Pilot',
] as const;
