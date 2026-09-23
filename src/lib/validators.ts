import { z } from 'zod';
import {
  REG_NO_PATTERN,
  PHONE_PATTERN,
  LICENSE_PATTERN,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
} from '@/config/constants';

/**
 * Normalizes a vehicle registration number: uppercase, strip spaces and hyphens.
 * @complexity O(n) where n = input length
 */
export function normalizeRegNo(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Normalizes a driver license number: uppercase, strip spaces.
 * @complexity O(n) where n = input length
 */
export function normalizeLicenseNo(input: string): string {
  return input.toUpperCase().replace(/\s/g, '');
}

/** Zod schema for Indian vehicle registration number (after normalization) */
export const regNoSchema = z
  .string()
  .min(1, 'Registration number is required')
  .transform(normalizeRegNo)
  .refine((v) => REG_NO_PATTERN.test(v), {
    message: 'Invalid format. Expected e.g. KA01AB1234',
  });

/** Zod schema for 10-digit Indian mobile phone */
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine((v) => PHONE_PATTERN.test(v), {
    message: 'Enter a valid 10-digit mobile number starting with 6-9',
  });

/** Zod schema for Indian driving license number (after normalization) */
export const licenseSchema = z
  .string()
  .min(1, 'License number is required')
  .transform(normalizeLicenseNo)
  .refine((v) => LICENSE_PATTERN.test(v), {
    message: 'Invalid format. Expected e.g. KA0120240000001',
  });

/** Zod schema for document file metadata validation */
export const fileMetaSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z
    .number()
    .max(MAX_FILE_SIZE, `File must be under ${MAX_FILE_SIZE / 1024 / 1024} MB`),
  mimeType: z
    .string()
    .refine(
      (v) => (ACCEPTED_FILE_TYPES as readonly string[]).includes(v),
      { message: 'Upload a PDF, JPG or PNG file' },
    ),
});

/** Zod schema for vehicle form */
export const vehicleFormSchema = z.object({
  regNo: regNoSchema,
  model: z.string().min(2, 'Min 2 characters').max(50, 'Max 50 characters'),
  seatingCapacity: z.number().int().min(2, 'Min 2 seats').max(60, 'Max 60 seats'),
  fuelType: z.enum(['PETROL', 'DIESEL', 'CNG', 'EV', 'HYBRID']),
  ownerVendorId: z.string().min(1, 'Owner is required'),
});

/** Zod schema for driver form */
export const driverFormSchema = z.object({
  name: z.string().min(2, 'Min 2 characters').max(60, 'Max 60 characters'),
  phone: phoneSchema,
  licenseNumber: licenseSchema,
  ownerVendorId: z.string().min(1, 'Owner is required'),
});

/** Zod schema for vendor name */
export const vendorNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be under 100 characters');

import type { Resolver, FieldValues, FieldErrors } from 'react-hook-form';

/**
 * Lightweight Zod resolver for react-hook-form without external packages.
 * // ponytail: native zod validation handles react-hook-form in 15 lines without @hookform/resolvers
 */
export function zodResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: FieldErrors<T> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0]);
      if (field && !(field in errors)) {
        Object.assign(errors, {
          [field]: {
            type: issue.code,
            message: issue.message,
          },
        });
      }
    }
    return { values: {}, errors };
  };
}

