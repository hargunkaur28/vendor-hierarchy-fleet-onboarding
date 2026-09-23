# Enterprise Vendor Hierarchy Management & Fleet Onboarding Platform

[![CI](https://github.com/hargunkaur28/vendor-hierarchy-fleet-onboarding/actions/workflows/ci.yml/badge.svg)](https://github.com/hargunkaur28/vendor-hierarchy-fleet-onboarding/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict_Mode-blue.svg)](tsconfig.json)
[![Tests: 192 Passed](https://img.shields.io/badge/Tests-192_Passed-brightgreen.svg)](src/)

A high-performance, enterprise-grade frontend platform for corporate commute and ride-sharing operations. Manages multi-tiered vendor organizations, role-based access control (RBAC), delegated authority, fleet vehicle & driver onboarding, real-time compliance derivation, and immutable audit logs.

- **GitHub Repository**: [https://github.com/hargunkaur28/vendor-hierarchy-fleet-onboarding](https://github.com/hargunkaur28/vendor-hierarchy-fleet-onboarding)
- **Live Interactive Demo**: [https://vendor-hierarchy-fleet-onboarding.vercel.app](https://vendor-hierarchy-fleet-onboarding.vercel.app) *(or run locally via `npm run dev`)*
- **Demo Walkthrough Guide**: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
- **Detailed System Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Assumptions & Decision Register**: [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md)

---

## 1. Feature Checklist

| Section | Feature Area | Status | Key Deliverables & Highlights |
| :--- | :--- | :---: | :--- |
| **I** | **Multi-Tier Organization Hierarchy** | ✅ | 5-tier strict ranking (`ADMIN` → `SITE_ADMIN` → `GROUP_VENDOR` → `SUB_VENDOR` → `DEPLOYMENT_ASSOCIATE`). Unbounded `SUB_VENDOR` depth. Vertical tree, horizontal tree (strictly orthogonal connectors per SPEC 4A.7), and compact virtualized view. |
| **II** | **Profile Movement & Role Management** | ✅ | Searchable combobox parent selector, real-time cycle prevention (`wouldCreateCycle`), atomic reparenting, optimistic updates with toast Undo, dynamic descendant count warning banners, role modification with parent-compatibility guards. |
| **III** | **Permissions & Delegated Authority** | ✅ | 6 core permissions matrix, ancestor permission intersection (`Effective = Granted ∩ ParentEffective`), descendant-scoped delegation, "Acting on behalf of" perspective mode with header banner and audit log attribution. |
| **IV** | **Fleet & Driver Onboarding** | ✅ | Indian registration normalization (`DL01AB1234`), DL/phone validation, document upload with expiry date enforcement, auto-deactivated on-read operational status derivation (`isVehicleCompliant`), fuel types (Petrol, Diesel, CNG, EV, Hybrid). |
| **IV.b** | **Document Compliance & Verification** | ✅ | Multi-document verification queue (Approve/Reject with $\ge 5$ char reason), expiration countdown buckets (Expired, $\le 7$d, 8–15d, 16–30d), header notification bell with live badge count and deep-linking. |
| **V** | **Super Vendor Dashboard & Overrides** | ✅ | High-level KPI metric cards, Fleet Operational donut chart, Direct Sub-Vendors risk table, live simulated telemetry streaming mode, Section 8.4 seniority-gated vehicle block/unblock and vendor suspension overrides. |
| **V.b** | **Immutable Audit Log** | ✅ | Comprehensive audit trail capturing actor, action, timestamp, target, before/after diffs, and acting-on-behalf delegation attribution with cursor pagination and role filters. |
| **Shell**| **Accessibility, Views & Dev Diagnostics** | ✅ | Global `?` keyboard shortcuts modal, `prefers-reduced-motion` animation suppression, Route code-splitting with `React.lazy`, API latency slider (0–1500ms), 15% flaky network preset, and 5,000-vendor stress test. |

---

## 2. Technology Stack & Rationale

- **React 19 & TypeScript (Strict Mode with `noUncheckedIndexedAccess`)**: Modern, concurrent React runtime paired with zero-`any` type safety. Prevents missing-null bugs across complex graph manipulations.
- **Vite 6**: Sub-second Hot Module Replacement (HMR) and optimized Rollup production code-splitting.
- **Tailwind CSS**: Utility-first styling enabling pixel-perfect alignment with design specifications without stylesheet bloat.
- **Zustand**: Lightweight, decoupled store utilizing normalized graph lookups (`vendorsById`, `childrenIndex`) avoiding unnecessary React context re-renders.
- **@tanstack/react-virtual**: Virtualized rendering of massive tree lists and combobox options, keeping DOM node count constant regardless of dataset size.
- **Zod & React Hook Form**: Declarative, schema-driven validation with regex normalization for Indian vehicle registrations, driving licenses, and document constraints.
- **Lucide React & Sonner**: Crisp, modern icon typography and stacked promise toasts for optimistic update rollbacks.
- **Vitest & React Testing Library**: 192 unit and component tests verifying algorithmic correctness, acyclicity, RBAC intersections, and UI flows.

---

## 3. Quickstart & Local Setup

### Prerequisites
- Node.js 18+ (Node 20 or 22 recommended)
- npm 9+

### Installation & Execution
```bash
# 1. Clone repository
git clone https://github.com/hargunkaur28/vendor-hierarchy-fleet-onboarding.git
cd vendor-hierarchy-fleet-onboarding

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Quality Validation Commands
```bash
# Type checking
npm run typecheck

# Linting (ESLint with zero warnings tolerance)
npm run lint

# Run all 192 unit & integration tests
npm test

# Production bundle build
npm run build
```

### Environment Configuration Flags
You can configure mock network behavior via environment variables in `.env` or interactively via the in-app Developer Panel:
- `VITE_API_LATENCY`: Override mock latency in milliseconds (e.g. `0` for instant tests, `500` for realistic network feel). Defaults to `300–800ms` in development.
- `VITE_FAILURE_RATE`: Simulated network failure rate between `0` and `1` (e.g. `0.15` for 15% failure rate). Defaults to `0`.

---

## 4. How to Demo Quickly ("View As" Guide)

The top-right header contains a **"View as" Switcher** dropdown. Use these pre-seeded personas to test perspective-specific rules:

1. **`admin` (Platform Administrator)**:
   - Global visibility across all subtrees.
   - Access to full audit log, global fleet management, and super-vendor overrides.
2. **`site-admin` (Site Admin)**:
   - Senior administrative tier. Direct report to Admin.
3. **`gv-north-mobility` (Group Vendor)**:
   - Manages a regional cluster with sub-vendors (`Delhi Cabs`).
   - Move Profile enabled (can move under Admin or Site Admin).
   - Can grant scoped delegations down its subtree.
4. **`sub-delhi-cabs` (Sub Vendor)**:
   - Direct report under North Mobility.
   - Onboards local fleet vehicles and drivers.
   - If North Mobility restricts `MANAGE_PAYMENTS`, viewing as Delhi Cabs displays disabled controls with "Blocked by GV North Mobility" tooltips.
5. **`da-driver-ops` (Deployment Associate)**:
   - Leaf operational vendor. Has no sub-vendors; cannot move profile.

---

## 5. System Architecture & Data Flow

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ React Component │ ────► │  Zustand Store  │ ────► │ Mock API Client │
│  (UI / Pages)   │ ◄──── │ (State / Cache) │ ◄──── │  (localStorage) │
└─────────────────┘       └─────────────────┘       └─────────────────┘
        │                          ▲
        ▼                          │
┌───────────────────────────────────────────┐
│     Pure Business Logic (`src/lib/`)      │
│  tree.ts  │  permissions.ts  │  search.ts │
│  compliance.ts  │  dashboard.ts           │
└───────────────────────────────────────────┘
```

1. **Presentation Layer**: Thin React components subscribe to store slices via selectors.
2. **State Layer**: Zustand manages flat, normalized dictionaries (`vendorsById`, `vehiclesById`, `driversById`, `documentsById`).
3. **Optimistic Updates & Rollbacks**: Modifying operations update UI state immediately. If the API layer returns an error, state automatically rolls back to the previous snapshot and displays an actionable error toast.
4. **Pure Business Domain**: Graph traversals, acyclicity checks, and compliance derivations live in `src/lib/` as pure functions without React or store dependencies.

---

## 6. Algorithmic Complexity Analysis (Section 19.2)

| Operation | Time Complexity | Space Complexity | Implementation Notes |
| :--- | :---: | :---: | :--- |
| **Cycle Check (`wouldCreateCycle`)** | $O(d)$ | $O(d)$ | Walks target's ancestor chain to root. $d \le 15$ in typical deep orgs. Fast reject on self/current parent. |
| **Reparenting (`reparent`)** | $O(d + k)$ | $O(d)$ | $O(d)$ cycle check + $O(k)$ array splice on old parent's children. Subtree descendants are moved implicitly ($O(1)$ updates). |
| **Effective Permissions** | $O(d \cdot \|P\|)$ | $O(d \cdot \|P\|)$ | Walks root-to-node path taking set intersections. $\|P\| = 6$ permissions, rendering time negligible ($<0.05$ ms). |
| **Search Tree Filtering** | $O(n)$ | $O(n)$ | Pre-computes lowercase concatenated search keys in memory. Single-pass linear scan across 5,000 nodes in **~7–9 ms**. |
| **Dashboard Metrics Aggregator** | $O(V + D + \text{Veh})$ | $O(S)$ | Computes counts, compliance rates, driver states, and risk distribution in a single pass. $S$ = direct sub-vendors count. |
| **Live Compliance Check** | $O(1)$ | $O(1)$ | Fixed evaluation of $\le 5$ required vehicle documents (`RC`, `PERMIT`, `PUC`, `INSURANCE`). |
| **Combobox Dropdown Filtering** | $O(n)$ | $O(n)$ | Debounced input filtering paired with `@tanstack/react-virtual` DOM virtualization (only ~10 rows in DOM). |
| **Tree Rendering** | $O(\text{visible})$ | $O(\text{visible})$ | Collapsed subtrees are pruned from the virtual/DOM tree. Only visible/expanded nodes are rendered. |
| **Audit Log Append / Pagination** | $O(1) \text{ append} \\ O(\text{page}) \text{ fetch}$ | $O(1)$ | Unshift into audit log array. Cursor pagination fetches standard slices ($O(\text{pageSize})$). |

### Memory & Resource Consumption
- **Storage Trade-offs**: Maintaining dual pointers via `vendorsById` ($O(n)$) and `childrenIndex` ($O(n)$) doubles reference memory but reduces parent-child lookups from $O(n)$ to $O(1)$. Total memory footprint for 5,000 vendors is $<12$ MB heap.
- **Bundle Size Optimization**: Route code-splitting with `React.lazy` produces clean modular chunks:
  - `dist/assets/index-DTyyMVNV.js`: 468.10 kB (141.17 kB gzip) — core app framework
  - `dist/assets/TeamPage-CrwXKjp0.js`: 66.86 kB (18.17 kB gzip)
  - `dist/assets/DelegationPage-DLtLrn_c.js`: 51.54 kB (12.51 kB gzip)
  - `dist/assets/DashboardPage-CpBv9QiF.js`: 48.64 kB (9.77 kB gzip)
  - `dist/assets/DocumentUploader-FDZJjp65.js`: 35.93 kB (13.23 kB gzip)
  - `dist/assets/DocumentsPage-oRazcXIw.js`: 24.17 kB (5.23 kB gzip)
  - `dist/assets/VehiclesPage-De9YYmO-.js`: 24.13 kB (6.03 kB gzip)
  - `dist/assets/AuditPage-CqYZ7XKl.js`: 10.59 kB (3.17 kB gzip)
  - `dist/assets/DriversPage-CI4Kzz4T.js`: 9.67 kB (2.97 kB gzip)

---

## 7. Performance Benchmarks (5,000-Vendor Stress Test)

Tested using the integrated Vitest benchmark harness (`src/lib/search.perf.test.ts`) on a 5,000-vendor hierarchical dataset:

```
=== PROFILER TRACE: 5,000 VENDORS SEARCH ===
Dataset Size:                       5,000 vendors
Uncached buildAllSearchKeys:        7.88 ms
Cached getOrBuildSearchKeys:        0.0066 ms
Average searchTree execution:       6.83 ms
Full selectVisibleTree execution:   4.36 ms
============================================
```

- **Expansion & Collapse**: Instant response ($<5$ ms) due to pure pointer updates in `expandedIds: Set<string>`.
- **Search Lookups**: Real-time filtering remains smoothly within a single 60 FPS animation frame budget ($<16.6$ ms).

---

## 8. Error Handling & Recovery Strategies

The platform implements a structured error model conforming to Section 15:
- **`CYCLE_DETECTED`**: Triggers when attempting to move a vendor under itself or any of its descendants. The combobox proactively excludes invalid targets; if bypassed, an inline error toast explains the cycle path.
- **`INVALID_PARENT_ROLE`**: Triggers if attempting to place a vendor under a parent whose role is structurally incompatible (e.g. Group Vendor under Sub Vendor).
- **`ACCOUNT_SUSPENDED`**: Displayed via top warning banners and disables operational capabilities whenever an account or an ancestor account is suspended.
- **`VEHICLE_NON_COMPLIANT`**: Disables the vehicle active toggle and surfaces specific missing or expired documents in hover tooltips.
- **`SENIORITY_OVERRIDE_VIOLATION`**: Rejects unblock or reactivate requests unless initiated by the original author or a more senior supervisor.
- **Network Resilience**: When the 15% flaky network mode is active, transient failures trigger error toasts equipped with an immediate **"Retry"** button.

---

## 9. Scalability & Production Backend Migration

If migrating this frontend from the current mock client to a distributed microservices backend:
1. **Tree Data Model**:
   - For massive trees ($>100,000$ vendors), transition from flat JSON transfers to closure tables or materialized path columns (`ltree` in PostgreSQL) for $O(1)$ subtree queries.
   - Implement GraphQL or sparse-field REST endpoints to fetch child tiers on demand (lazy node expansion).
2. **File & Document Uploads**:
   - Replace in-memory metadata mock with direct-to-cloud presigned S3/GCS upload URLs.
   - Integrate asynchronous OCR / document verification webhooks.
3. **Permissions & Security**:
   - Replace client-side intersection walk with server-side authorization tokens (e.g. JWT with cached permission bits, evaluated at API gateway).
4. **Audit Trail**:
   - Pipe client and server audit events directly into Kafka / Kinesis for ingestion into immutable audit stores (e.g. ClickHouse, Elasticsearch).

---

## 10. AI Usage Disclosure & Engineering Discipline

This codebase was developed in pair-programming collaboration with an advanced AI coding assistant using a rigorous "lazy senior developer" discipline (`ponytail.md`):
- **Discipline Rungs**: Stop at the first rung that holds: reuse existing helpers, standard libraries, and native platform features before writing new code.
- **Strict Verification**: Every single line of code was verified against TypeScript strict mode, ESLint (`--max-warnings 0`), and 18 test suites containing 192 unit and component tests.
- **Zero-Unrequested Features**: Strict adherence to specifications (e.g. dropping unrequested horizontal sibling hopping to preserve pure Left = collapse, Right = expand semantics).

---

## 11. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
