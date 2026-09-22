import { describe, it, expect } from 'vitest';
import {
  normalizeRegNo,
  normalizeLicenseNo,
  regNoSchema,
  phoneSchema,
  licenseSchema,
  fileMetaSchema,
} from './validators';

// ─── normalizeRegNo ────────────────────────────────────────────────

describe('normalizeRegNo', () => {
  it('uppercases and strips spaces/hyphens', () => {
    expect(normalizeRegNo('ka-01 ab 1234')).toBe('KA01AB1234');
    expect(normalizeRegNo('DL3CAX4321')).toBe('DL3CAX4321');
  });
});

// ─── regNoSchema ───────────────────────────────────────────────────

describe('regNoSchema', () => {
  const valid = ['KA01AB1234', 'DL02CAX4321', 'MH12AB5678', 'ka-01 ab 1234'];
  const invalid = ['', 'KAAABB1234', '12AB1234', 'KA01AB12345', 'KA01AB123'];

  it.each(valid)('accepts %s', (v) => {
    expect(regNoSchema.safeParse(v).success).toBe(true);
  });

  it.each(invalid)('rejects %s', (v) => {
    expect(regNoSchema.safeParse(v).success).toBe(false);
  });

  it('normalizes before validation', () => {
    const result = regNoSchema.safeParse('ka-01 ab 1234');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('KA01AB1234');
    }
  });
});

// ─── phoneSchema ───────────────────────────────────────────────────

describe('phoneSchema', () => {
  it('accepts valid 10-digit phones starting 6-9', () => {
    expect(phoneSchema.safeParse('9876543210').success).toBe(true);
    expect(phoneSchema.safeParse('6000000000').success).toBe(true);
  });

  it('rejects invalid phones', () => {
    expect(phoneSchema.safeParse('5123456789').success).toBe(false); // starts with 5
    expect(phoneSchema.safeParse('98765').success).toBe(false); // too short
    expect(phoneSchema.safeParse('98765432100').success).toBe(false); // too long
    expect(phoneSchema.safeParse('').success).toBe(false);
  });
});

// ─── licenseSchema ─────────────────────────────────────────────────

describe('licenseSchema', () => {
  it('accepts valid license numbers', () => {
    expect(licenseSchema.safeParse('KA0120240000001').success).toBe(true);
    expect(licenseSchema.safeParse('DL0520230000002').success).toBe(true);
  });

  it('normalizes spaces', () => {
    const result = licenseSchema.safeParse('KA 01 20240000001');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('KA0120240000001');
    }
  });

  it('rejects invalid formats', () => {
    expect(licenseSchema.safeParse('').success).toBe(false);
    expect(licenseSchema.safeParse('12345').success).toBe(false);
    expect(licenseSchema.safeParse('KAAABB20240000001').success).toBe(false);
  });
});

// ─── normalizeLicenseNo ────────────────────────────────────────────

describe('normalizeLicenseNo', () => {
  it('uppercases and strips spaces', () => {
    expect(normalizeLicenseNo('ka 01 20240000001')).toBe('KA0120240000001');
  });
});

// ─── fileMetaSchema ────────────────────────────────────────────────

describe('fileMetaSchema', () => {
  it('accepts valid file metadata', () => {
    expect(
      fileMetaSchema.safeParse({
        fileName: 'doc.pdf',
        fileSize: 1000,
        mimeType: 'application/pdf',
      }).success,
    ).toBe(true);
  });

  it('rejects oversized file', () => {
    expect(
      fileMetaSchema.safeParse({
        fileName: 'doc.pdf',
        fileSize: 6 * 1024 * 1024,
        mimeType: 'application/pdf',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid MIME type', () => {
    expect(
      fileMetaSchema.safeParse({
        fileName: 'doc.docx',
        fileSize: 1000,
        mimeType: 'application/msword',
      }).success,
    ).toBe(false);
  });

  it('accepts image/jpeg', () => {
    expect(
      fileMetaSchema.safeParse({
        fileName: 'dl.jpg',
        fileSize: 2000000,
        mimeType: 'image/jpeg',
      }).success,
    ).toBe(true);
  });

  it('accepts image/png', () => {
    expect(
      fileMetaSchema.safeParse({
        fileName: 'dl.png',
        fileSize: 100,
        mimeType: 'image/png',
      }).success,
    ).toBe(true);
  });
});
