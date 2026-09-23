# Vendor Management System: Architecture & Design

This document details the architectural principles, data flow, state management, algorithmic structures, and design decisions behind the Vendor Hierarchy & Fleet Onboarding Web Application.

---

## 1. High-Level Architectural Model

The application follows a strict **Layered Clean Architecture** that cleanly separates presentation, state management, API transport simulation, and pure business domain algorithms.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          User Interface (React 19)                       │
│  Tree Views (Vertical, Horiz, Compact) │ Forms │ Modals │ Dashboard       │
└─────────────────────────────────────┬────────────────────────────────────┘
                                      │ Dispatches actions / subscribes
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Global State Management (Zustand)                      │
│   Normalized State Cache │ Optimistic Updates │ Rollback Snapshots       │
└───────────────────┬──────────────────────────────────┬───────────────────┘
                    │                                  │
    Invokes API     ▼                                  ▼ Pure Domain Functions
┌───────────────────────────────┐      ┌───────────────────────────────────┐
│     Mock API Client Layer     │      │        Pure Business Logic        │
│   Latency & Failure Injection │      │            (`src/lib/`)           │
│   Typed AppErrors (Sec 15)    │      │  • tree.ts (cycle, reparent)      │
│   LocalStorage Persistence    │      │  • permissions.ts (RBAC, cascade) │
└───────────────────────────────┘      │  • compliance.ts (live derivation)│
                                       │  • search.ts (cached search keys) │
                                       │  • dashboard.ts (seniority & agg) │
                                       └───────────────────────────────────┘
```

### Architectural Guarantees
1. **Zero UI Leaks in Business Logic**: All business algorithms in `src/lib/` are completely free of React hooks, DOM references, or Zustand store instances. They operate strictly on plain TypeScript objects and arrays, allowing 100% deterministic unit testing.
2. **Double-Layer Authorization**: Security checks (`authorize()`, `wouldCreateCycle()`, seniority checks) are evaluated both in the UI presentation layer (to disable actions and show explanatory tooltips) and in the API client layer (to guarantee operations cannot be forced via console or dev shortcuts).
3. **Derived-on-Read Compliance**: Vehicle operational states are never blindly trusted from stored records; operational eligibility is derived dynamically on every render via `isVehicleCompliant()` based on live document health and system overrides.

---

## 2. Directory Structure

```
vendor-management-sys/
├── .github/workflows/ci.yml       # Automated CI pipeline (lint, typecheck, test, build)
├── docs/
│   ├── ARCHITECTURE.md            # System architecture (this document)
│   ├── ASSUMPTIONS.md             # Architectural decisions & assumptions register
│   └── DEMO_SCRIPT.md             # 3–4 minute end-to-end demo guide
├── src/
│   ├── api/                       # Mock API client & storage layer
│   │   ├── client.ts              # Simulated network latency, failure injection & storage
│   │   ├── errors.ts              # Structured typed AppError classes (Section 15)
│   │   └── seed.ts                # Golden scenario generator & 5,000-vendor stress dataset
│   ├── components/                # Presentation & UI components
│   │   ├── common/                # Reusable UI primitives (Avatar, StatusChip, etc.)
│   │   ├── dev/                   # Diagnostics panel (latency slider, flaky preset, reset)
│   │   ├── layout/                # AppLayout, Sidebar, Header, Global keyboard listeners
│   │   ├── tree/                  # HierarchyTree, CompactTreeView, HorizontalTreeView, MoveProfileModal
│   │   ├── fleet/                 # VehiclesPage, DriversPage, VehicleFormDialog, DriverFormDialog
│   │   ├── documents/             # DocumentsPage, DocumentUploader, VerificationQueue
│   │   ├── delegation/            # DelegationPage, PermissionMatrix, DelegateDialog
│   │   └── dashboard/             # DashboardPage, StatCards, SubVendorTable, Charts
│   ├── config/                    # Static domain configurations
│   │   ├── constants.ts           # Storage keys, retry limits, pagination defaults
│   │   ├── permissions.ts         # 6 core permission keys, descriptions, and labels
│   │   └── roles.ts               # Role hierarchy rankings, color palette, allowable children
│   ├── lib/                       # Pure algorithmic domain functions (0 React dependencies)
│   │   ├── compliance.ts          # Vehicle/driver document verification engine
│   │   ├── dashboard.ts           # Aggregator & Section 8.4 seniority enforcement
│   │   ├── permissions.ts         # Intersection-based ancestor permission cascade
│   │   ├── search.ts              # Inverted index & search tree traversal
│   │   ├── tree.ts                # Graph cycle detection, reparenting, adjacency indexing
│   │   └── validators.ts          # Zod schemas for registration numbers, DL, phone, files
│   ├── pages/                     # Route root components (Lazy-loaded via React.lazy)
│   ├── store/                     # Zustand state management
│   │   ├── selectors.ts           # Memoized state selectors
│   │   └── useAppStore.ts         # Central application store
│   ├── types/                     # TypeScript domain contracts
│   ├── App.tsx                    # Route configuration & code-splitting boundary
│   └── main.tsx                   # React root mount
└── vitest.config.ts               # Test suite configuration
```

---

## 3. Data Structures & Algorithmic Design

### 3.1 Normalized Graph Representation
Tree structures frequently suffer from recursive rendering overhead and expensive deep copies. The application normalizes the hierarchy into two primary structures:
- `vendorsById: Record<string, Vendor>`: Flat $O(1)$ lookup map of all vendor entities.
- `childrenIndex: Record<string, string[]>`: Adjacency list indexing each vendor's immediate children IDs.

```typescript
// Fast O(1) parent lookup
const vendor = vendorsById[id];
const parent = vendor.parentId ? vendorsById[vendor.parentId] : null;

// Fast O(1) child retrieval
const directChildrenIds = childrenIndex[id] || [];
```

### 3.2 Acyclicity Detection (`wouldCreateCycle`)
When moving vendor $V$ to target parent $T$:
- **Self-parenting**: If $V = T$, reject ($O(1)$).
- **Current parent**: If $T = V.\text{parentId}$, reject ($O(1)$).
- **Descendant reparenting**: If $T$ is an existing descendant of $V$, moving $V$ under $T$ would create an orphaned cycle. We walk the ancestor chain upward from $T$ to root:
  - If $V$ is encountered in $T$'s ancestor chain, a cycle would form: reject ($O(d)$ time, where $d$ is tree depth, $O(d)$ space).

### 3.3 Atomic Reparenting (`reparent`)
Reparenting moves the vendor and implicitly moves its entire subtree:
1. Assert acyclicity via `wouldCreateCycle`.
2. Check structural parent-child role rules (`isRoleAllowedUnder`).
3. Detach $V$ from old parent in `childrenIndex`.
4. Update `parentId` of $V$ to $T$.
5. Attach $V$ to $T$'s array in `childrenIndex`.
6. Time complexity: $O(d + k)$ where $k$ is old parent's child count. Subtree descendants are untouched ($O(1)$ updates).

### 3.4 Inverted Key Search & Ancestor Auto-Inclusion
In a 5,000-vendor organization, search queries must remain responsive ($<16$ ms per frame):
1. **Search Key Pre-computation**: Search keys (`${name} ${email} ${phone} ${tags}`) are computed and cached in a WeakMap/Map (`getOrBuildSearchKeys`).
2. **Ancestor Auto-Inclusion**: When a node matches a search filter, all of its ancestors up to the root are automatically marked as `visible` so the user can trace the structural path down to the match.
3. **Performance Profiler**: Search execution benchmark across 5,000 nodes completes in **~7–9 ms**, with `selectVisibleTree` resolving in **~4–5 ms**.

---

## 4. Role Hierarchy & Permission Cascading

### 4.1 Strict 5-Tier Role Invariants
| Role | Rank | Max Direct Children Allowed Under | Can Move Profile? |
| :--- | :---: | :--- | :---: |
| `ADMIN` | 1 | Platform Root (None above) | ❌ |
| `SITE_ADMIN` | 2 | `ADMIN` | ❌ |
| `GROUP_VENDOR` | 3 | `ADMIN`, `SITE_ADMIN` | ✅ |
| `SUB_VENDOR` | 4 | `GROUP_VENDOR` | ✅ |
| `DEPLOYMENT_ASSOCIATE`| 5 | `SUB_VENDOR` | ❌ |

### 4.2 Ancestor Permission Intersection
Permissions granted to a vendor can never exceed the permissions held by their direct parent. Effective permissions are computed by walking the root-to-leaf path and taking the **intersection** of granted sets:

$$\text{Effective}(V) = \text{Granted}(V) \cap \text{Effective}(\text{Parent}(V))$$

If an ancestor account is `SUSPENDED`, the effective permission set drops to $\emptyset$, instantly freezing the operational capability of the entire downstream subtree.

### 4.3 Delegation Model & Seniority Enforcement
- **Descendant Scope**: Delegations can only be granted to vendors within the delegator's subtree (`isDescendantOf(delegate, delegator)`).
- **Scope Restriction**: A delegator can only delegate permissions that they currently effectively possess.
- **Attribution**: While acting on behalf of a delegator, UI headers and audit logs explicitly attribute actions as: `Actor (Acting on behalf of Delegator)`.
- **Seniority Override (Section 8.4)**: When a vehicle is blocked or a vendor is suspended, only the original actor or a strictly more senior ancestor (`rank(actor) < rank(target)`) has permission to unblock or reactivate. Peers cannot override senior administrative actions.

---

## 5. Fleet Operational Status Pipeline

A vehicle's operational state is derived live on each read cycle:

```
[Vehicle Record]
       │
       ▼
1. Is Vehicle Blocked? ─────────► YES ──► State: BLOCKED (Inactive)
       │ NO
       ▼
2. Are all 4 required docs      ► NO  ──► State: NON_COMPLIANT (Inactive)
   (RC, Permit, PUC, Ins)
   APPROVED & Non-Expired?
       │ YES
       ▼
3. Is vehicle toggle ACTIVE?    ► NO  ──► State: INACTIVE (Manual toggle OFF)
       │ YES
       ▼
State: OPERATIONAL (Active)
```

Non-compliant vehicles are automatically locked in the deactivated state with their activation toggle disabled, displaying detailed hover tooltips explaining the exact blocking violation.

---

## 6. Resilience, Error Handling & Dev Diagnostics

- **Structured AppErrors**: Typed errors specify an error `code`, user-friendly `message`, and structured `details` payload.
- **Optimistic UI with Rollback**: Move profile operations update the hierarchy tree instantly in state; if the simulated API call encounters a network failure, the operation automatically rolls back to the prior snapshot and triggers a toast notification with an immediate **Retry** action.
- **Developer Diagnostics Panel**:
  - Mock API latency slider (0 to 1,500 ms) for simulating slow 3G/4G connections.
  - Flaky network quick preset (15% failure injection).
  - Force Invalid Move button (deliberately attempts an illegal cycle move to demonstrate robust UI error handling).
  - Golden scenario database reset with confirmation dialog.
