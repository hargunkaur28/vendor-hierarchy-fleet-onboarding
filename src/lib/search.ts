import type { Vendor, RoleKey } from '@/types';
import type { VendorMap } from './tree';

export interface SearchFilters {
  search: string;
  tags: string[];
  roles: RoleKey[];
}

export interface SearchResult {
  /** Vendor IDs that match the filters */
  matchIds: Set<string>;
  /** All vendor IDs that should be visible (matches + their ancestors) */
  visibleIds: Set<string>;
}

/**
 * Precomputes a lowercase search key for a vendor: "name|email|phone".
 * Called once per vendor at load/update, not on every keystroke.
 * @complexity O(1) per vendor
 */
export function buildSearchKey(vendor: Vendor): string {
  return `${vendor.name}|${vendor.email}|${vendor.phone}`.toLowerCase();
}

/**
 * Searches the vendor tree by text query and optional tag/role filters.
 *
 * Algorithm:
 * 1. Linear scan of all vendors against the search key and filters
 * 2. For each match, walk up ancestors adding them to `visibleIds`
 *    with a visited guard to prevent repeat walks
 *
 * Search + tag uses AND semantics. Tags use ANY-match (OR within tags).
 *
 * @complexity O(n + min(m·d, n)) where n = vendors, m = matches, d = depth
 * @space O(n) for the visible set
 */
export function searchTree(
  filters: SearchFilters,
  byId: VendorMap,
  searchKeys: Record<string, string>,
): SearchResult {
  const query = filters.search.toLowerCase().trim();
  const hasSearch = query.length > 0;
  const hasTags = filters.tags.length > 0;
  const hasRoles = filters.roles.length > 0;
  const noFilters = !hasSearch && !hasTags && !hasRoles;

  const matchIds = new Set<string>();
  const visibleIds = new Set<string>();

  if (noFilters) {
    // No filters: everything is visible, nothing is "matched" (no highlight)
    for (const id of Object.keys(byId)) {
      visibleIds.add(id);
    }
    return { matchIds, visibleIds };
  }

  // Find matches
  for (const vendor of Object.values(byId)) {
    let matches = true;

    if (hasSearch) {
      const key = searchKeys[vendor.id] ?? buildSearchKey(vendor);
      if (!key.includes(query)) matches = false;
    }

    if (matches && hasTags) {
      // ANY-match: vendor has at least one of the filter tags
      const hasAnyTag = filters.tags.some((t) => vendor.tags.includes(t));
      if (!hasAnyTag) matches = false;
    }

    if (matches && hasRoles) {
      if (!filters.roles.includes(vendor.role)) matches = false;
    }

    if (matches) {
      matchIds.add(vendor.id);
      visibleIds.add(vendor.id);

      // Walk up ancestors (with visited guard)
      let current = byId[vendor.parentId ?? ''];
      while (current && !visibleIds.has(current.id)) {
        visibleIds.add(current.id);
        current = byId[current.parentId ?? ''];
      }
    }
  }

  return { matchIds, visibleIds };
}

/**
 * Precomputes search keys for all vendors.
 * Call once at load and update incrementally on vendor changes.
 * @complexity O(n)
 */
export function buildAllSearchKeys(byId: VendorMap): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const vendor of Object.values(byId)) {
    keys[vendor.id] = buildSearchKey(vendor);
  }
  return keys;
}

let cachedVendors: VendorMap | null = null;
let cachedSearchKeys: Record<string, string> = {};

/**
 * Returns precomputed search keys for vendorsById, reusing the cached mapping
 * if the vendorsById reference has not changed.
 */
export function getOrBuildSearchKeys(byId: VendorMap): Record<string, string> {
  if (byId === cachedVendors) {
    return cachedSearchKeys;
  }
  cachedVendors = byId;
  cachedSearchKeys = buildAllSearchKeys(byId);
  return cachedSearchKeys;
}
