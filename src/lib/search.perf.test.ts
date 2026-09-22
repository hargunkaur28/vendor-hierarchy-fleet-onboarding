import { describe, it, expect } from 'vitest';
import { generateStressData } from '@/api/seed';
import { searchTree, buildAllSearchKeys, getOrBuildSearchKeys } from './search';
import { selectVisibleTree } from '@/store/selectors';
import type { AppState } from '@/store/useAppStore';

describe('Search & Filter Profiler Benchmark (5,000 Vendors)', () => {
  const stressDb = generateStressData(5000);
  const vendorCount = Object.keys(stressDb.vendors).length;

  it('verifies 5k dataset loaded', () => {
    expect(vendorCount).toBeGreaterThanOrEqual(5000);
  });

  it('measures search execution time with cached vs uncached search keys', () => {
    // 1. Measure uncached buildAllSearchKeys
    const t0 = performance.now();
    const uncachedKeys = buildAllSearchKeys(stressDb.vendors);
    const uncachedBuildTime = performance.now() - t0;

    // 2. Measure cached getOrBuildSearchKeys (after first call)
    const firstCached = getOrBuildSearchKeys(stressDb.vendors);
    const t1 = performance.now();
    const cachedKeys = getOrBuildSearchKeys(stressDb.vendors);
    const cachedAccessTime = performance.now() - t1;

    expect(cachedKeys).toBe(firstCached); // Reference equality on cache hit
    expect(firstCached).toStrictEqual(uncachedKeys);
    expect(cachedAccessTime).toBeLessThan(1);

    // 3. Measure searchTree query execution
    const queries = ['admin', 'stress', 'example'];
    const times: number[] = [];

    for (const q of queries) {
      const start = performance.now();
      const res = searchTree(
        { search: q, tags: [], roles: [] },
        stressDb.vendors,
        cachedKeys,
      );
      const elapsed = performance.now() - start;
      times.push(elapsed);
      expect(res.visibleIds.size).toBeGreaterThan(0);
    }

    const avgSearchTime = times.reduce((a, b) => a + b, 0) / times.length;

    // 4. Measure selectVisibleTree through store selector
    const mockState: Partial<AppState> = {
      vendorsById: stressDb.vendors,
      searchFilters: { search: 'admin', tags: [], roles: [] },
      statusFilter: 'ALL',
    };

    const s0 = performance.now();
    const visibleResult = selectVisibleTree(mockState as AppState);
    const selectorTime = performance.now() - s0;

    expect(visibleResult.matchIds.size).toBeGreaterThan(0);

    // Print profiler trace to stdout
    console.warn('\n=== PROFILER TRACE: 5,000 VENDORS SEARCH ===');
    console.warn(`Dataset size: ${vendorCount} vendors`);
    console.warn(`Uncached buildAllSearchKeys: ${uncachedBuildTime.toFixed(2)}ms`);
    console.warn(`Cached getOrBuildSearchKeys:  ${cachedAccessTime.toFixed(4)}ms`);
    console.warn(`Average searchTree execution: ${avgSearchTime.toFixed(2)}ms`);
    console.warn(`Full selectVisibleTree execution: ${selectorTime.toFixed(2)}ms`);
    console.warn('============================================\n');

    // Expectations: with cached keys, search execution across 5,000 items is fast
    expect(cachedAccessTime).toBeLessThan(1);
    expect(avgSearchTime).toBeLessThan(50);
  });
});
