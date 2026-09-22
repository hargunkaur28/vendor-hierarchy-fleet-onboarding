import type { MockDatabase, AuditEntry } from '@/types';
import { generateSeedData, generateStressData } from './seed';
import { AppError } from './errors';

export const STORAGE_KEY = 'vendorhub:v1';

export interface DevApiConfig {
  latencyMin: number;
  latencyMax: number;
  failureRate: number;
  forceFailNext: boolean;
}

const isTestEnv = Boolean(typeof import.meta !== 'undefined' && import.meta.env?.['MODE'] === 'test');

export const devApiConfig: DevApiConfig = {
  latencyMin: isTestEnv ? 0 : 300,
  latencyMax: isTestEnv ? 0 : 800,
  failureRate: 0, // off by default, toggled via dev panel
  forceFailNext: false,
};

/**
 * Loads the mock database from localStorage, initializing with seed data if missing.
 */
export function loadDb(): MockDatabase {
  if (typeof window === 'undefined' || !window.localStorage) {
    return generateSeedData();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = generateSeedData();
      saveDb(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as MockDatabase;
    if (
      !parsed ||
      !parsed.vendors ||
      !parsed.vendors['admin'] ||
      Object.keys(parsed.vendors).length === 0
    ) {
      const initial = generateSeedData();
      saveDb(initial);
      return initial;
    }
    return parsed;
  } catch {
    const initial = generateSeedData();
    saveDb(initial);
    return initial;
  }
}

/**
 * Persists the mock database to localStorage.
 */
export function saveDb(db: MockDatabase): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // LocalStorage full or private browsing — fail silently in mock
    }
  }
}

/**
 * Resets database to a fresh deterministic seed.
 */
export function resetDb(stress = false): MockDatabase {
  const fresh = stress ? generateStressData() : generateSeedData();
  saveDb(fresh);
  return fresh;
}

/**
 * Simulates real-world network latency and transient failure.
 */
export async function simulateNetwork<T>(action: (db: MockDatabase) => T): Promise<T> {
  const isZeroLatency =
    devApiConfig.latencyMax === 0 ||
    (typeof import.meta !== 'undefined' && import.meta.env?.['VITE_API_LATENCY'] === '0');

  if (!isZeroLatency) {
    const min = devApiConfig.latencyMin;
    const max = devApiConfig.latencyMax;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Failure simulation
  if (devApiConfig.forceFailNext) {
    devApiConfig.forceFailNext = false;
    throw new AppError('NETWORK_ERROR', 'Forced network failure for testing error rollback.');
  }

  if (devApiConfig.failureRate > 0 && Math.random() < devApiConfig.failureRate) {
    throw new AppError('NETWORK_ERROR', 'Simulated network failure. Please retry.');
  }

  const db = loadDb();
  const result = action(db);
  saveDb(db);
  return result;
}

/**
 * Appends an audit entry to the database and truncates if needed.
 */
export function recordAudit(
  db: MockDatabase,
  entry: {
    actorId: string;
    action: string;
    targetType: 'VENDOR' | 'VEHICLE' | 'DRIVER' | 'DOCUMENT' | 'DELEGATION';
    targetId: string;
    onBehalfOfId?: string;
    details?: Record<string, unknown>;
  },
): AuditEntry {
  const audit: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    actorId: entry.actorId,
    onBehalfOfId: entry.onBehalfOfId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: entry.details ?? {},
  };
  db.auditLogs.unshift(audit);
  if (db.auditLogs.length > 500) {
    db.auditLogs.length = 500;
  }
  return audit;
}
