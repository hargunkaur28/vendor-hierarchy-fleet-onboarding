# SPEC: Vendor Hierarchy Management + Cab & Driver Onboarding (Frontend, Mock Data)

You are building a complete, production-quality **frontend-only** web app for a ride-sharing / corporate-commute platform's **Vendor Management module**. This document is the full specification. Read all of it before writing any code.

---

## 0. HOW TO WORK (instructions to the agent)

1. Read this entire file first — including **Section 4A (UI Design System)**, which is binding for every screen. Then create `docs/ASSUMPTIONS.md` and list any ambiguity you resolved and how. **Do not stop to ask questions**; decide, document, continue.
2. Work **phase by phase** (Section 22). After each phase: run `npm run lint && npm run typecheck && npm run test && npm run build`. Fix everything. Then `git commit` with a conventional message (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`).
3. Implement by **priority tier** (Section 3). Finish **every P0 item completely and polished** before touching P1. Finish P1 before P2. A polished P0 beats a broken P0+P1+P2.
4. TypeScript `strict: true`. No `any`. No `// @ts-ignore`. No dead code, no leftover `console.log`.
5. Business logic lives in **pure functions** in `src/lib/` (no React, no store imports) so it is unit-testable. React components stay thin.
6. Every non-obvious function gets a JSDoc block explaining **what, why, and time/space complexity**.
7. Use meaningful names, small components (< ~150 lines), and consistent formatting (Prettier + ESLint).
8. Never fake success. If an operation can fail (validation, permission, simulated network error) the UI must show a clear, specific message.
9. **Work in "lazy senior dev" mode** (full definition below). This governs *how* you write every line in this build, on top of everything else in this section.
10. When done, produce the deliverables in Section 19 and 20.

### 0.1 Lazy senior dev mode (binding coding discipline for this whole build)

You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

Before writing any code, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here — don't re-write it.
3. Does the standard library already do this? Use it.
4. Does a native platform feature cover it? Use it.
5. Does an already-installed dependency (Section 4) solve it? Use it.
6. Can this be one line? Make it one line.
7. Only then: write the minimum code that works.

The ladder runs **after** you understand the problem, not instead of it: read the task and the code it touches, trace the real flow end to end, then climb.

**Bug fix = root cause, not symptom.** A report names a symptom. Grep every caller of the function you touch and fix the shared function once — one guard there is a smaller diff than one per caller, and patching only the path the ticket names leaves a sibling caller still broken. This matters a lot in this codebase specifically: `authorize()`, `wouldCreateCycle()`, `getEffectivePermissions()`, and `isVehicleCompliant()` each have multiple call sites (UI *and* API layer per Section 8.3); a fix belongs in the `lib/` function, never patched separately at each call site.

**Rules:**
- No abstractions that weren't explicitly requested.
- No new dependency if it can be avoided — check Section 4's list first.
- No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins, but only once you understand the problem. The smallest change in the wrong place isn't lazy, it's a second bug.
- Question complex requests internally: "Do you actually need X, or does Y cover it?" — then document the call in `docs/ASSUMPTIONS.md` rather than stopping to ask.
- Pick the edge-case-correct option when two stdlib approaches are the same size — lazy means less code, not the flimsier algorithm.
- Mark deliberate simplifications that cut a real corner with a known ceiling (e.g. a naive O(n) scan used instead of an index because n stays small in this app, a simulated network layer, an in-memory-only audit log) with a `// ponytail:` comment naming the ceiling and the upgrade path.

**Not lazy about:** understanding the problem (read it fully and trace the real flow before picking a rung — a small diff you don't understand is just laziness dressed up as efficiency), input validation at trust boundaries (all API layer functions per Section 9), error handling that prevents data loss (optimistic-update rollback per Section 9), accessibility (Section 17), the complexity/scalability requirements this spec explicitly asks for (Section 11, 16 — those are "explicitly requested," so they are never the corner to cut), and anything else explicitly requested in this document.

Lazy code without its check is unfinished: every non-trivial `lib/` function leaves the unit test Section 18 already asks for — the smallest thing that fails if the logic breaks. Trivial one-liners need no test beyond what Section 18 already requires.

---

## 1. CONTEXT AND GOAL

This is a case study for a frontend internship assessment at a corporate-mobility SaaS company. The evaluators will read the code, the README, run the app, and watch a demo video. They score on: **code quality, complexity analysis, UX, error handling, performance, scalability, functionality**.

### What the product does

A **Super Vendor** (e.g., a national fleet operator) manages a **multi-level network of sub-vendors** (regional → city → local). Vendors onboard **cabs** and **drivers**, upload **compliance documents** (DL, RC, Permit, Pollution certificate, Insurance), and Super Vendors can **delegate** permissions, **monitor** everything in a dashboard, and **override** sub-vendor actions (e.g., disable a non-compliant vehicle).

### Reference screenshots (already provided; binding for visual style — see Section 4A)

- **Screen 1: "My Team" hierarchy tree.** Page title "My Team". Top bar: search input ("Search by name, email or Phone No."), a "Select Tags" multi-select dropdown, and a **role color legend** (Admin = purple, Site Admin = red/orange, Group Vendor = teal, Sub Vendor = pink/magenta, Deployment Associate = maroon). Top-right: a keyboard-shortcuts icon button, a **Horizontal** toggle button, and a **Compact** toggle button. The body is an org-chart: root node "admin" at top, children connected by lines. Each node is a small card with a round colored avatar showing initials, name, email, an edit (pencil) icon, and (for movable roles) a **"Move Profile"** outlined button. Nodes with children show a small collapse/expand chevron with a **child-count badge**.
- **Screen 2: "Move {Name}" modal.** Radio: **Change Parent** (selected) / **Change Role**. Helper text: "Move group vendor under a different site admin". A dropdown "Select Site Admin". An info box: "All sub-vendors and deployment associates under this group-vendor will also be moved under the site admin". Buttons: **Cancel** and **Move** (disabled until a selection is made).
- **Screen 3: Searchable dropdown open.** Search box "Search by name" at the top of the list, then a scrollable list of site admins.

---

## 2. HOW THE EVALUATION CRITERIA MAP TO THIS BUILD

| Criterion | What must be visibly true |
|---|---|
| Complexity estimation | README "Complexity Analysis" table (Section 19.2) + JSDoc complexity notes on every tree/permission/search function. Efficient structures (normalized maps, adjacency index, memoized selectors). |
| User experience | Intuitive navigation, skeleton loaders, empty states, toasts for every mutation (success **and** failure), confirm dialogs for destructive actions, Undo on move, responsive, keyboard accessible. |
| Error handling | Central error catalog (Section 15), form validation with field-level messages, permission-denied messages, simulated network failures with retry, error boundary, invalid-operation prevention (cycles, duplicates, role rules). |
| Performance | Memoized selectors, `React.memo` tree nodes, only-expanded-nodes rendering, virtualized list in Compact view, debounced search, stress-test seed of 5,000 vendors that stays smooth. |
| Scalability | Normalized data model, O(depth) checks instead of O(n), config-driven roles (N-level), API layer abstracted so it can be swapped for real REST, documented scaling notes (server-side pagination, lazy child loading). |
| Functionality | All features F1–F10 in Section 14 working end to end. |

---

## 3. PRIORITY TIERS (strict order)

**P0: Must be perfect (core, matches screenshots):**
- F1 Hierarchy tree (My Team) with expand/collapse, search, role legend
- F2 Move Profile modal (Change Parent) with searchable dropdown, descendant info banner, validation, cycle prevention, toasts
- F4 Permissions model + effective permissions
- F5 Delegation (enable/revoke, restrict functions)
- F6 Vehicle & driver onboarding forms + driver-to-vehicle assignment
- F7 Document upload + expiry + compliance flag (non-compliant vehicles cannot operate)
- F8 Super Vendor dashboard (fleet counts, pending verifications, driver availability, sub-vendor list)
- Mock API layer, store, seed data, "View as" user switcher
- Unit tests for all pure logic; README with complexity analysis

**P1: Should have:**
- F3 Change Role option in the Move modal
- F9 Super Vendor override actions (disable vehicle, approve/reject doc, suspend sub-vendor)
- Tag filter, role filter, Undo on move, audit log page, expiry reminders panel
- Horizontal + Compact view toggles, keyboard shortcuts modal
- Component tests for Move modal

**P2: Nice to have:**
- Charts + CSV export of compliance report
- Simulated real-time updates (driver availability ticking)
- Pan/zoom on the org-chart canvas
- Dark mode
- Playwright smoke test

---

## 4. TECH STACK

- **React 18 + TypeScript (strict) + Vite**
- **Tailwind CSS** (design tokens in `tailwind.config`; role colors and design tokens from Section 4A)
- **Zustand** (store) with selectors; optional `immer` middleware
- **React Router v6**
- **react-hook-form + zod** for forms and validation
- **Radix UI primitives** (`@radix-ui/react-dialog`, `react-dropdown-menu`, `react-tooltip`, etc.) or shadcn/ui for accessible dialog/menu primitives
- **react-hot-toast** (or sonner) for toasts
- **react-window** (or `@tanstack/react-virtual`) for virtualization
- **lucide-react** for icons
- **date-fns** for date math
- **Vitest + @testing-library/react + @testing-library/user-event + jsdom** for tests
- **ESLint (typescript-eslint, react-hooks, jsx-a11y) + Prettier**
- P2 only: **recharts**

Scripts required in `package.json`: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`, `format`.

---

## 4A. UI DESIGN SYSTEM & VISUAL LANGUAGE

> This section is binding for every screen built in Phases 3–8. It supersedes generic Tailwind defaults and takes precedence over any conflicting styling note elsewhere in this document. Functional behavior (states, ARIA, validation, acceptance criteria) is defined elsewhere and is unaffected by this section — this section governs colors, spacing, and motion only.
>
> The three reference screenshots (Section 1) are **exact style references, not just layout inspiration**: match their density, flatness, and restraint. This is a clean operational SaaS console — quiet, static, high-contrast text on a bright neutral canvas. It is explicitly **not** a marketing-style dashboard with gradients, glow shadows, or hover-lift card physics. When in doubt, choose the flatter, quieter option.

### 4A.1 Design Identity

A **crisp, flat operational console**. Bright neutral canvas, high-contrast obsidian text, and the five **role colors already defined in Section 1** used as the system's only multi-hue element — everywhere else stays neutral gray plus a single indigo/purple brand accent (chosen to match the "Admin" purple already used in the reference screenshots' legend). Motion is minimal and functional: it confirms an action happened, it never decorates.

### 4A.2 Color Tokens

| Token | Value | Usage |
|---|---|---|
| `bg-canvas` | `#F7F7F8` | App background |
| `bg-surface` | `#FFFFFF` | Cards, modals, sidebar, table rows |
| `border-subtle` | `#E5E5E8` | Card borders, dividers, connector lines |
| `border-strong` | `#111111` | Focus rings, active input borders |
| `text-primary` | `#0D0D0D` | Headings, names, metrics |
| `text-secondary` | `#55565B` | Body text, nav labels |
| `text-muted` | `#9CA3AF` | Emails, timestamps, captions, helper text |
| `brand` | `#4F46E5` | Primary CTA fill, active nav item, links, root/selected node border, search highlight |
| `role-admin` | `#6D4AFF` (purple) | Matches Section 1 legend |
| `role-site-admin` | `#F04E23` (red/orange) | Matches Section 1 legend |
| `role-group-vendor` | `#0EA5A0` (teal) | Matches Section 1 legend |
| `role-sub-vendor` | `#E0389B` (pink/magenta) | Matches Section 1 legend |
| `role-deployment-assoc` | `#8B1E3F` (maroon) | Matches Section 1 legend |
| `status-success` | text `#15803D` / bg `rgba(21,128,61,.1)` | Active / Approved / Compliant |
| `status-warning` | text `#B45309` / bg `rgba(180,83,9,.1)` | Expiring, pending |
| `status-danger` | text `#B91C1C` / bg `rgba(185,28,28,.1)` | Expired, blocked, rejected, non-compliant, suspended |
| `status-info` | text `#1D4ED8` / bg `rgba(29,78,216,.1)` | Delegation / "acting on behalf of" |

Role tokens are used **only** for avatar fills, legend dots, and node accent borders. Buttons, links, active nav, and focus states use `brand` only. Compliance/verification/delegation states use the four status tokens only. No gradients anywhere in this build — every color above is a flat fill.

### 4A.3 Typography

- Font: `'Inter', sans-serif` throughout. Headings 600 semibold; body 400–500.
- Emails, phone numbers, reg numbers, license numbers, timestamps: `font-mono text-xs text-muted`.
- Section eyebrows (e.g. "PENDING VERIFICATIONS", "EXPIRY REMINDERS", "SYSTEM ALERTS"): `text-xs font-bold uppercase tracking-wider text-muted`.

### 4A.4 Core Component Classes

```css
.card { background:#FFF; border-radius:10px; padding:1.25rem; border:1px solid #E5E5E8; box-shadow:none; }
.card--elevated { box-shadow:0 4px 20px rgba(0,0,0,.04); } /* dashboard stat cards only, see 4A.6 */
.badge { display:inline-flex; align-items:center; gap:.25rem; padding:.2rem .55rem; border-radius:6px; font-size:.65rem; font-weight:600; letter-spacing:.05em; text-transform:uppercase; }
.skeleton { background:linear-gradient(90deg,#F0F0F0 25%,#FAFAFA 50%,#F0F0F0 75%); background-size:200% 100%; animation:shimmer 1.5s ease-in-out infinite; border-radius:6px; }
```

### 4A.5 App Shell

- **Sidebar:** fixed, `260px`, white, `border-right: 1px solid border-subtle`, no shadow. Squircle monogram logo + product name at top. Nav items per Section 13 routes (Dashboard, My Team, Vehicles, Drivers, Documents, Delegation, Audit, Settings), each hidden/disabled per permission (Section 13). Active item: flat `brand` fill, white text, `rounded-lg`, no glow. Inactive: `text-secondary`, `hover:bg-canvas`. Bottom block: current "View as" identity (avatar in that vendor's role color, name, role label), Sign Out.
- **Top navbar:** `h-14`, sticky, `bg-white/90 backdrop-blur-sm`, `border-b border-subtle`. Left: mobile hamburger + page title. Right: notification bell with expiry-reminder badge count (F7), "Acting on behalf of" pill when a delegation is active (`status-info` token, flat), View-as switcher.
- **Mobile:** sidebar becomes a `280px` slide-in drawer over a blurred backdrop; closes on route change.

### 4A.6 Dashboard (F8) Card Language

No reference screenshot constrains F8, so a slightly livelier treatment is fine here — but stay consistent with the rest of the app:
- Stat cards use `.card--elevated` (light shadow only, no scale/lift on hover — keep the whole app static, per 4A.9).
- Layout: colored top accent bar in a status or `brand` token depending on the metric, icon square (flat fill, matching token), big number (`text-3xl font-bold text-primary`), uppercase muted label beneath.
- Alerts (expiring/pending/non-compliant) render **above** the stat-card grid: a flat green "All compliant" row when clean, or an amber/red scrollable list of offending items with a "View all →" link in `brand` — reuse this same two-state pattern for expiry reminders **and** pending verifications.
- Sub-vendor table and driver-availability widget sit below the grid in plain `.card` containers with skeleton loading states.

### 4A.7 Tree View (F1) — must match Screens 1–3 exactly

- **Node card:** white, `1px solid border-subtle`, `rounded-lg` (~8px), **no shadow at rest, no hover elevation or scale** — this view stays flat per the reference.
- **Avatar:** solid flat-fill circle, ~32–36px, white bold initials, color = the exact role token for that vendor's role.
- **Root / currently-open node:** gets a **2px `brand` border** in place of the default gray border (see "admin" node, Screen 1). This is the only card-level highlight state — no shadow, no glow.
- **Edit icon:** small gray pencil, top-right of the card.
- **Move Profile button:** outlined only — `1px brand` border, `brand` text, white fill, small leading icon, `rounded-md`. Never filled/solid at rest.
- **Connector lines:** thin `border-subtle` gray, orthogonal/right-angle routing exactly as in Screen 1 — not curved SVG paths.
- **Expand/collapse control:** small caret + child-count badge, centered on the connector line beneath the parent card (not attached to the card body) — replicate the exact placement from Screen 1.
- **Toolbar row:** search input with leading icon, "Select Tags" dropdown, then the role legend rendered as inline dot+label pairs, right-aligned square-outline keyboard-shortcuts icon button, then **Horizontal** and **Compact** as plain outlined toggle buttons side by side (not filled pill toggles).
- **Search highlight:** matched text wrapped in `<mark>` with `brand` at ~15% opacity background — not default yellow.
- **Post-move pulse:** after a successful Move, the relocated node gets a 2s `brand`-colored ring pulse (see 4A.9), respecting `prefers-reduced-motion`.

### 4A.8 Modals & Forms — must match Screens 2–3

- **Modal container:** white, `1px solid border-subtle`, `rounded-xl`, light dialog elevation only (no heavy card shadow), close `X` top-right, title `text-lg font-semibold text-primary`.
- **Radio group** (Change Parent / Change Role): standard native-style radio, `brand` fill when selected, `text-secondary` label otherwise.
- **Dropdown trigger** ("Select Site Admin"): plain `1px border-subtle` rectangle, chevron flips on open, no colored fill at rest.
- **Info banner:** flat light-gray box (`#F5F5F7`), small circular "i" icon on the left, `text-secondary text-sm` — neutral gray always, never amber/blue-tinted, exactly as in Screen 2.
- **Combobox list** (Screen 3): search bar pinned to top with leading icon, plain rows (name text; add a muted secondary line only where Section 14/F2 calls for it), `hover:bg-canvas` row highlight, no borders between rows, thin scrollbar. Virtualize per F2 spec when >100 options.
- **Buttons:** **Cancel** = outlined `border-strong`/gray text; **Move** (or primary action) = flat `brand` fill, white text; disabled state = flat light-gray fill with muted gray text (a visibly greyed pill, not just a lower-opacity version of the enabled state) — matches Screen 2's disabled "Move" button exactly.

### 4A.9 Motion Rules

This UI is largely **static**. No hover scale, no hover elevation, no gradient sheens, anywhere in the tree or modals. Motion is limited to:
1. Modal open/close: fade + slight scale-in, ~150ms.
2. Dropdown/combobox list expand.
3. Toast slide-in / auto-dismiss.
4. The 2s post-move pulse ring on the relocated tree node (4A.7).
5. Dashboard-only (4A.6): stat-card entrance can stagger in (`opacity 0→1, y 12→0`) on page load, since no reference screenshot constrains that page — but even there, skip hover lift/scale to keep the app feeling like one consistent console.

All motion respects `prefers-reduced-motion: reduce` — disable transforms, keep opacity fades only.

### 4A.10 Status Chip Usage (ties into F7/F9)

Every compliance/verification/delegation state renders through the four status tokens from 4A.2, always paired with an icon (never color alone, per Section 17 a11y rule):
`APPROVED / ACTIVE / COMPLIANT` → success · `PENDING / EXPIRING_SOON` → warning · `REJECTED / EXPIRED / BLOCKED / NON_COMPLIANT / SUSPENDED` → danger · `DELEGATED / ON_BEHALF_OF` → info.

---

## 5. PROJECT STRUCTURE

```
/
├─ README.md
├─ SPEC.md                      (this file)
├─ docs/
│  ├─ ASSUMPTIONS.md
│  ├─ ARCHITECTURE.md
│  └─ screenshots/
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ types/                    domain types (Section 6)
│  ├─ config/
│  │  ├─ roles.ts               role config (Section 7)
│  │  ├─ permissions.ts         permission keys + labels
│  │  └─ constants.ts           thresholds (EXPIRY_WARNING_DAYS = 30 etc.)
│  ├─ lib/                      PURE logic (no React, no store)
│  │  ├─ tree.ts                index building, ancestors, descendants, cycle check, reparent
│  │  ├─ search.ts              tree search + tag/role filters
│  │  ├─ permissions.ts         effective permissions, authorize()
│  │  ├─ compliance.ts          document status, vehicle compliance
│  │  ├─ validators.ts          zod schemas (reg no, phone, etc.)
│  │  ├─ dates.ts
│  │  ├─ prng.ts                seeded PRNG (mulberry32)
│  │  └─ *.test.ts              unit tests colocated
│  ├─ api/
│  │  ├─ client.ts              mock transport: latency, failure injection, localStorage persistence
│  │  ├─ vendorsApi.ts
│  │  ├─ fleetApi.ts
│  │  ├─ documentsApi.ts
│  │  ├─ delegationApi.ts
│  │  ├─ auditApi.ts
│  │  ├─ errors.ts              AppError class + error codes
│  │  └─ seed.ts                deterministic seed generator
│  ├─ store/
│  │  ├─ useAppStore.ts         slices: session, vendors, fleet, delegations, audit, ui
│  │  └─ selectors.ts           memoized selectors
│  ├─ features/
│  │  ├─ hierarchy/             TreeView, TreeNode, CompactList, Legend, MoveProfileModal, Toolbar, ShortcutsModal
│  │  ├─ delegation/            DelegationPage, PermissionMatrix, DelegateDialog
│  │  ├─ fleet/                 VehiclesPage, VehicleForm, DriversPage, DriverForm, AssignDriverDialog
│  │  ├─ documents/             DocumentUploader, DocumentList, VerificationQueue
│  │  ├─ dashboard/             DashboardPage, StatCards, SubVendorTable, ReminderPanel
│  │  └─ audit/                 AuditLogPage
│  ├─ components/ui/            Button, Modal, Combobox, Badge, Avatar, Skeleton, EmptyState, ConfirmDialog, Toast wrapper, ErrorBoundary, FormField
│  ├─ hooks/                    useDebounce, useKeyboardShortcuts, useAsync
│  └─ styles/
```

---

## 6. DOMAIN MODEL (normalized; never store nested trees)

```ts
export type RoleKey =
  | 'ADMIN' | 'SITE_ADMIN' | 'GROUP_VENDOR' | 'SUB_VENDOR' | 'DEPLOYMENT_ASSOCIATE';

export type PermissionKey =
  | 'MANAGE_TEAM'        // move profiles, change roles, add/remove sub-vendors
  | 'ONBOARD_FLEET'      // create/edit vehicles
  | 'ONBOARD_DRIVERS'    // create/edit drivers, assign to vehicles
  | 'VERIFY_DOCUMENTS'   // approve/reject documents, compliance tracking
  | 'MANAGE_BOOKINGS'
  | 'MANAGE_PAYMENTS';

export interface Vendor {
  id: string;
  name: string;
  email: string;            // fake domain: @example.com
  phone: string;            // 10-digit Indian mobile
  role: RoleKey;
  parentId: string | null;  // null only for ADMIN root
  tags: string[];
  status: 'ACTIVE' | 'SUSPENDED';
  suspendedBy?: { vendorId: string; reason: string; at: string };
  grantedPermissions: PermissionKey[]; // what the PARENT granted to this vendor (root has all)
  createdAt: string;        // ISO
  updatedAt: string;
}

export type FuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'EV' | 'HYBRID';
export type DocType = 'DL' | 'RC' | 'PERMIT' | 'PUC' | 'INSURANCE';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DocumentRecord {
  id: string;
  type: DocType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiryDate: string;          // ISO date
  uploadedAt: string;
  uploadedBy: string;          // vendorId of actor
  verification: {
    status: VerificationStatus;
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
  };
}

export interface Vehicle {
  id: string;
  ownerVendorId: string;
  regNo: string;               // normalized uppercase, no spaces/hyphens
  model: string;
  seatingCapacity: number;
  fuelType: FuelType;
  status: 'ACTIVE' | 'INACTIVE'; // operational switch
  blocked?: { byVendorId: string; reason: string; at: string }; // override block
  assignedDriverId: string | null;
  documents: DocumentRecord[];   // RC, PERMIT, PUC, INSURANCE
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  ownerVendorId: string;
  name: string;
  phone: string;
  licenseNumber: string;
  availability: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';
  assignedVehicleId: string | null;
  documents: DocumentRecord[];   // DL
  createdAt: string;
  updatedAt: string;
}

export interface Delegation {
  id: string;
  delegatorId: string;          // super vendor granting authority
  delegateId: string;           // descendant that may act on delegator's behalf
  scope: PermissionKey[];       // restricted function list
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  onBehalfOfId?: string;        // set when action was performed under a delegation
  action: string;               // e.g. 'VENDOR_MOVED', 'DELEGATION_REVOKED', 'DOC_APPROVED'
  targetType: 'VENDOR' | 'VEHICLE' | 'DRIVER' | 'DOCUMENT' | 'DELEGATION';
  targetId: string;
  details: Record<string, unknown>;
}
```

**Store shape (normalized):**
```ts
vendorsById: Record<string, Vendor>
childrenByParent: Record<string, string[]>   // adjacency index, derived & kept in sync
vehiclesById, driversById, delegationsById, audit: AuditEntry[]
session: { actorId: string; actingOnBehalfOf: string | null }
ui: { expandedIds: Set<string>, view: 'tree'|'horizontal'|'compact', filters: {...} }
```
`childrenByParent` must be rebuilt/patched by the same action that changes `parentId` so they can never diverge. Add a dev-only invariant checker (`assertTreeInvariants`) called in tests and after each mutation in dev mode.

---

## 7. ROLE CONFIG AND HIERARCHY RULES (config-driven, supports N levels)

All rules live in `src/config/roles.ts`, **not** scattered through components:

```ts
export const ROLE_CONFIG: Record<RoleKey, {
  label: string;
  colorToken: string;                 // tailwind token: role-admin, role-siteadmin, ...
  rank: number;                       // lower = more senior
  allowedChildRoles: RoleKey[];
  movable: boolean;                   // shows "Move Profile"
  parentRoleLabel: string | null;     // used in modal copy: "site admin", "group vendor"...
}> = {
  ADMIN:                { label:'Admin',                 rank:0, allowedChildRoles:['SITE_ADMIN'], movable:false, ... },
  SITE_ADMIN:           { label:'Site Admin',            rank:1, allowedChildRoles:['GROUP_VENDOR','SUB_VENDOR'], movable:false, ... },
  GROUP_VENDOR:         { label:'Group Vendor',          rank:2, allowedChildRoles:['SUB_VENDOR','DEPLOYMENT_ASSOCIATE'], movable:true, ... },
  SUB_VENDOR:           { label:'Sub Vendor',            rank:3, allowedChildRoles:['SUB_VENDOR','DEPLOYMENT_ASSOCIATE'], movable:true, ... },
  DEPLOYMENT_ASSOCIATE: { label:'Deployment Associate',  rank:4, allowedChildRoles:[], movable:true, ... },
};
```
Notes:
- `SUB_VENDOR → SUB_VENDOR` is allowed so **N-level** nesting (Regional → City → Local) really works. Depth is unbounded; only role validity is enforced.
- Terminology mapping: the case study says "Super Vendor / Sub Vendor". In the UI, **Super Vendor = any vendor viewing their own subtree** (the logged-in vendor with descendants). Group Vendor / Site Admin / Admin are simply the top levels of that hierarchy. Document this mapping in the README.
- Helper: `getValidParentRoles(role)`: roles whose `allowedChildRoles` include `role`.
- Helper: `isRoleAllowedUnder(childRole, parentRole)`.

---

## 8. PERMISSIONS, DELEGATION, AUTHORIZATION (the heart of the logic)

### 8.1 Granted vs effective permissions
- `vendor.grantedPermissions` = permissions the **parent** granted directly.
- **Effective permissions** of vendor V:
  `effective(V) = granted(V) ∩ effective(parent(V))`, with `effective(root) = ALL_PERMISSIONS`.
- So revoking a permission at a parent **automatically** removes it below without rewriting descendants. In the UI show inherited-but-blocked permissions greyed with a tooltip: "Blocked by {ancestor name}".
- **No privilege escalation:** when granting permissions to a child, the set must be a subset of the granter's **effective** permissions. Validate in `lib/permissions.ts` and in the API.
- Memoize `effective()` per (vendorId, treeVersion). Compute in O(depth).

### 8.2 Delegation
A `Delegation` lets a **delegate** (a descendant of the delegator) act **on behalf of** the delegator, limited to `scope`.
- Only an **ancestor** (or the delegator's own authority) can create/enable/revoke it; the delegate must be a **strict descendant** of the delegator.
- Scope ⊆ delegator's effective permissions (no escalation).
- Enable/revoke **any time**. Revoked/disabled delegations grant nothing immediately.
- A delegate with an active delegation sees a header control: **"Acting on behalf of {Delegator}"** toggle. While active, `session.actingOnBehalfOf = delegatorId`; permitted targets = delegator's subtree, permitted actions = `scope`.
- Every action performed under delegation is logged with `actorId = delegate` and `onBehalfOfId = delegator`, and UI copy says "Performed by X on behalf of Y".
- Multi-level chain works naturally: Super → Regional (delegation A) → City (Regional can create a narrower delegation B ⊆ A's scope).

### 8.3 Central authorization function (single source of truth)
```ts
authorize(ctx, {
  actorId, permission, targetVendorId, onBehalfOfId?
}): { allowed: true; via: 'OWN' | 'DELEGATION'; onBehalfOfId?: string }
  | { allowed: false; code: ErrorCode; message: string }
```
Rules, evaluated in this order:
1. Actor exists and is `ACTIVE`, and no ancestor of the actor is `SUSPENDED` → else `ACCOUNT_SUSPENDED`.
2. Target must be **inside the actor's subtree** (strict descendant, or self for self-service actions), except ADMIN who sees all → else `OUT_OF_SCOPE`.
3. If `onBehalfOfId` is set: an enabled delegation must exist (delegator → actor), `permission ∈ delegation.scope ∩ effective(delegator)`, and target must be inside the **delegator's** subtree → else `DELEGATION_INVALID` / `PERMISSION_DENIED`.
4. Otherwise `permission ∈ effective(actor)` → else `PERMISSION_DENIED`.

Both the **UI** (to hide/disable controls with a tooltip reason) and the **mock API** (to reject, defense in depth) call the same `authorize`.

### 8.4 Override (P1)
Any **ancestor** with the relevant permission can override descendant actions:
- Disable a vehicle (`blocked` with reason, only the blocker or a more senior ancestor can unblock).
- Approve/reject a document.
- Suspend / reactivate a sub-vendor (`status = SUSPENDED`; suspension blocks the vendor **and its whole subtree** from acting; do not mutate descendants, evaluate via ancestor walk).

---

## 9. MOCK API LAYER (`src/api/`)

Purpose: behave like a real REST backend so UI states are real, and so swapping to real APIs later only touches this folder.

- `client.ts`: `request<T>(fn, opts)`:
  - Artificial latency **300–800 ms** (seeded/random), configurable; `0` in tests.
  - **Failure injection:** configurable rate (default 0; a dev-panel toggle "Simulate flaky network" sets ~15%); throws `AppError('NETWORK_ERROR')`.
  - **Persistence:** entire DB in `localStorage` under a versioned key (`vendorhub:v1`). On version mismatch, reseed. Provide a **"Reset demo data"** button.
  - All functions return `Promise` and throw typed `AppError { code, message, details? }`.
- Endpoints (all validate input with zod and re-run `authorize` + business rules server-side):
  - Vendors: `listVendors()`, `getVendor(id)`, `moveVendor({ vendorId, newParentId })`, `changeVendorRole({ vendorId, newRole })`, `createVendor()`, `updateVendor()`, `suspendVendor()`, `reactivateVendor()`, `updateGrantedPermissions()`
  - Fleet: `listVehicles()`, `createVehicle()`, `updateVehicle()`, `setVehicleStatus()`, `blockVehicle()`, `unblockVehicle()`, `listDrivers()`, `createDriver()`, `updateDriver()`, `assignDriver({ vehicleId, driverId })`, `unassignDriver()`
  - Documents: `uploadDocument({ ownerType, ownerId, type, file meta, expiryDate })` (metadata only, no bytes stored), `reviewDocument({ docId, decision, reason? })`
  - Delegation: `listDelegations()`, `createDelegation()`, `updateDelegationScope()`, `setDelegationEnabled()`, `revokeDelegation()`
  - Audit: `listAudit({ limit, cursor })` (cursor pagination to demonstrate scalable design)
- Every mutation appends an `AuditEntry`.
- Mutations use **optimistic UI in the store with rollback** on failure (at minimum for `moveVendor`, toggling vehicle status, and toggling delegation).

Error codes (`src/api/errors.ts`):
`NETWORK_ERROR, VALIDATION_ERROR, PERMISSION_DENIED, OUT_OF_SCOPE, DELEGATION_INVALID, ACCOUNT_SUSPENDED, NOT_FOUND, CYCLE_DETECTED, INVALID_PARENT_ROLE, SAME_PARENT, ROLE_CHANGE_CONFLICT, DUPLICATE_REG_NO, DRIVER_ALREADY_ASSIGNED, VEHICLE_ALREADY_ASSIGNED, VEHICLE_NON_COMPLIANT, VEHICLE_BLOCKED, DOC_INVALID_FILE, CONFLICT`

---

## 10. STATE MANAGEMENT

- One Zustand store with slices. **Components subscribe via narrow selectors** (`useAppStore(s => s.vendorsById[id])`) to avoid re-render storms.
- Memoized derived selectors in `selectors.ts` (use a `treeVersion` counter that increments on any structural change as the memo key):
  - `selectVisibleTree(actorId, filters, expandedIds)`
  - `selectSubtreeStats(vendorId)` (counts of vendors, vehicles, drivers, pending docs)
  - `selectEffectivePermissions(vendorId)`
  - `selectNonCompliantVehicles(actorId)`
  - `selectExpiringDocuments(actorId, days)`
- Async action pattern: `pending / success / error` status per operation, so UI shows loaders and errors.
- **"View as" switcher** (header): dropdown to impersonate any vendor (searchable, grouped by role). Everything (tree scope, dashboard, permissions) is scoped to the impersonated vendor. Default actor = Admin. Persist selection in `sessionStorage`.

---

## 11. CORE ALGORITHMS (`src/lib/tree.ts`, pure, tested, complexity-documented)

Let **n** = vendors, **d** = tree depth, **c** = children count of one node, **k** = size of a subtree, **m** = search matches.

| Function | Behavior | Time | Space |
|---|---|---|---|
| `buildChildrenIndex(vendors)` | Build `parentId → childIds[]` | O(n) | O(n) |
| `getAncestors(id, byId)` | Walk `parentId` to root | O(d) | O(d) |
| `isDescendantOf(candidateId, ancestorId, byId)` | Walk up from candidate | O(d) | O(1) |
| `getDescendantIds(id, index)` | Iterative DFS (no recursion → no stack overflow at depth) | O(k) | O(k) |
| `wouldCreateCycle(nodeId, newParentId, byId)` | True if `newParentId === nodeId` or `nodeId` is an ancestor of `newParentId` (walk up from new parent) | O(d) | O(1) |
| `getValidParents(node, ctx)` | Candidates whose role allows `node.role`, excluding self, current parent, own descendants, suspended vendors, and vendors outside the actor's authority. Uses **one** pass + a precomputed descendant `Set` | O(n) | O(k) |
| `reparent(state, nodeId, newParentId)` | Validate (cycle, role, same parent) then set `parentId`, patch both children arrays. Descendants move implicitly because they reference their parent by id. | validation O(d) + array patch O(c) | O(1) |
| `searchTree(query, filters, byId)` | Precompute a lowercase `searchKey = name+email+phone` once per vendor; linear scan; for each match add its ancestors to a `visible` Set (visited-guard prevents repeat walks) | O(n + min(m·d, n)) | O(n) |
| `getEffectivePermissions(id, byId)` | Intersect granted sets while walking up | O(d·p), p = 6 | O(p) |
| `computeSubtreeStats(rootId, ...)` | Single post-order pass | O(k) | O(k) |

Key insight to state in README: because children reference parents by id, **moving a whole subtree is one pointer change**; there is no per-descendant rewrite. Cycle detection is O(d), not O(n).

---

## 12. SEED DATA (`src/api/seed.ts`, deterministic)

Use a **seeded PRNG** (mulberry32, fixed seed) so demos are reproducible. All emails `@example.com`, phones 10-digit fake (start 6–9), names fictional. Do **not** copy real emails from the screenshots.

**Golden scenario (mirrors the screenshots):**
- `admin` (ADMIN, root)
- ~14 Site Admins directly under admin (e.g., "Site Admin North", "Site Admin South", …)
- Under one Site Admin ("Deepak Testing"): 5 Group Vendors ("Demo Group Vendor", "Test Group A", "Test Group B", "QA Group", "Arun QA")
- Under "Demo Group Vendor": 4 Sub Vendors ("Demo Vendor Supervisor", "Demo Vendor Supervisor 2", "Demo Sub Vendor 1", "Demo Sub Vendor 2")
- Under "Demo Sub Vendor 1": 1 Deployment Associate ("Test DA")
- A second branch: Site Admin → Group Vendor ("Megha Test") → Sub Vendor
- **A deeper N-level branch:** Group Vendor → Regional Sub Vendor → City Sub Vendor → Local Sub Vendor → DA (proves N-level)

**Bulk fill:** generate ~60 vendors total by default with role-valid parents.
**Stress mode:** a dev-panel button **"Load 5,000 vendors"** regenerates a large valid tree (used to demonstrate performance).

**Fleet seed:** per Sub Vendor 2–6 vehicles and 2–6 drivers (fake Indian reg nos like `KA01AB1234`, `DL3CAX4321`; models: Swift Dzire, Toyota Etios, Innova Crysta, Tata Tigor EV, Ertiga; mix of fuel types). Documents seeded with a realistic mix: most valid; **~10% expired, ~10% expiring within 30 days, ~8% pending verification, ~4% rejected, ~3% missing a required doc**. Some vehicles already `blocked` by an override. Some drivers unassigned.
**Tags:** `North, South, East, West, Premium, Pilot`; "Compliance Risk" is a **derived** tag (has non-compliant vehicle in subtree) computed, not stored.
**Delegations:** seed 2 (one enabled with narrowed scope, one disabled).
**Grants:** most vendors get a default grant set by role; a few have restricted grants (e.g., a Sub Vendor can onboard drivers but **not** MANAGE_PAYMENTS) so permission behavior is demo-able immediately.

---

## 13. ROUTES AND LAYOUT

App shell: **left sidebar** (collapsible on mobile), **top header** (page title, global search optional, **View as** switcher, "Acting on behalf of" toggle when applicable, dev panel menu, notification bell for expiry reminders). Visual spec: Section 4A.5.

| Route | Page |
|---|---|
| `/` | redirect to `/dashboard` |
| `/dashboard` | F8 Super Vendor Dashboard |
| `/team` | F1 My Team (hierarchy) |
| `/vehicles` | F6 Vehicles list + onboarding |
| `/drivers` | F6 Drivers list + onboarding |
| `/documents` | F7 Documents + Verification queue |
| `/delegation` | F5 Delegation & permissions |
| `/audit` | Audit log (P1) |
| `*` | 404 page |

Sidebar items are **hidden/disabled by permission** with tooltips. A route accessed without permission shows an inline "You don't have access" state (not a crash).

---

## 14. FEATURE SPECS WITH ACCEPTANCE CRITERIA

### F1. Hierarchy Tree "My Team" (P0)
**UI** — Visual spec: Section 4A.7.
- Page header "My Team". Toolbar: search input (debounced 250 ms, placeholder "Search by name, email or Phone No."), Tags multi-select ("Select Tags"), Role filter, role **legend** with colored dots, view toggle buttons (**Horizontal**, **Compact**), keyboard-shortcuts icon button.
- **Node card:** colored circular avatar with initials, name, email, edit icon (opens edit vendor drawer/dialog: name, phone, tags), **Move Profile** button (if role `movable` and actor may `MANAGE_TEAM`), and if it has children an expand/collapse chevron with **child-count badge** (direct children count; tooltip shows total descendants).
- Connector lines between parent and children (CSS pseudo-elements or SVG).
- Root and first level expanded by default; everything else collapsed.

**Views**
- **Vertical org-chart (default):** parents above children, horizontally scrollable.
- **Horizontal:** parents left, children right.
- **Compact (P1):** indented list, **virtualized** with react-window; row = avatar + name + role badge + counts + actions; expand/collapse per row.

**Behavior**
- **Only expanded nodes' children are rendered** (lazy render). Collapsing removes DOM.
- Search: matches are highlighted (`<mark>`); ancestors of matches auto-expand and stay visible; non-matching branches are hidden; "N results" label; empty state "No vendors match 'xyz'" with a Clear button.
- Tag filter: ANY-match semantics, combined with search using AND.
- Scoped to the acting user's subtree (Admin sees all).
- Keyboard: tab into tree, **Arrow Up/Down** move focus, **Right** expand / **Left** collapse, **Enter** opens details, **/** focuses search, **Esc** clears search. Shortcuts modal lists these (`?` opens it).
- Card and tree use `role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-level`.
- Loading: skeleton org-chart; error: inline error with Retry.
- **Performance:** `React.memo` on nodes with narrow selectors; passing 5k vendors must not lag when expanding a node (target < 100 ms interaction).

**Acceptance:** with 60 seeded vendors and with 5,000 stress vendors, expand/collapse and search feel instant; screenshots' structure is reproducible; legend colors match role colors on avatars.

### F2. Move Profile modal (Change Parent) (P0)
Visual spec: Section 4A.8.
**Trigger:** "Move Profile" on a card.
**Modal content (mirror screenshots):**
- Title: **"Move {Name}"**, close (X) button, Esc closes, focus trapped, focus returns to trigger.
- Radio: **Change Parent** (default) | **Change Role** (P1; if not built, render disabled with tooltip "Coming soon" only if it's cut, prefer implementing).
- Helper text (dynamic from role config): "Move {roleLabel} under a different {parentRoleLabel}", e.g., "Move group vendor under a different site admin".
- **Searchable dropdown (combobox)** labeled "Select {ParentRoleLabel}":
  - Search input "Search by name" (matches name and email), debounced.
  - Each option: name (primary), email (secondary), tiny child-count.
  - Options come from `getValidParents()`. **Invalid targets never appear** (self, own descendants, current parent, role-invalid, suspended, out of actor's scope).
  - Virtualized list if > 100 options. Keyboard: Up/Down/Enter/Esc. `role="combobox"` / `listbox` / `option` with `aria-activedescendant`.
  - Empty result: "No matching {parentRoleLabel} found".
- **Info banner** (info icon): dynamic and **accurate**: "All **{N}** sub-vendors and deployment associates under this {roleLabel} will also be moved under the selected {parentRoleLabel}." `N` = real descendant count; if `N = 0`, say "No team members are under this {roleLabel}."
- Buttons: **Cancel**, **Move** (disabled until valid selection; shows spinner while submitting; disabled during submit to prevent double-submit).

**On submit**
1. Client validation via `wouldCreateCycle` / role check (even though options are filtered; defense in depth).
2. Optimistic update, call `moveVendor`, on success: close modal, toast **"{Name} moved under {NewParent}"** with **Undo** (5 s, reverts move via API and audit-logs it), expand path to the moved node, scroll into view, pulse highlight ~2 s.
3. On failure: rollback, keep modal open, show inline error banner with the specific message from the error catalog + Retry. Never a generic "Something went wrong" if we know the reason.
4. Audit entry `VENDOR_MOVED` with `{from, to, descendantCount}`.

**Acceptance:** cannot move a node under itself or its descendant by any route; moving a Group Vendor moves all its sub-vendors/DAs (verify by tree); Undo restores the exact previous parent; double-click on Move does not fire twice.

### F3. Change Role (P1)
- Radio switches the form: dropdown "Select new role" listing roles that (a) are allowed under the node's **current parent** (`isRoleAllowedUnder`) and (b) can still contain the node's **existing children** (each child's role must be in the new role's `allowedChildRoles`).
- If existing children would become invalid, list blocking children in an error banner: "Cannot change to X: {a, b, c} must be moved first" (`ROLE_CHANGE_CONFLICT`) and disable Move/Save.
- On success: toast, avatar color updates, audit `VENDOR_ROLE_CHANGED`.
- Changing role resets `grantedPermissions` to the new role's defaults, clamped to parent's effective permissions.

### F4. Permissions model UI (P0)
- On `/delegation` (or a vendor drawer), a **permission matrix**: rows = direct sub-vendors (or selected vendor), columns = 6 permissions, cells = toggle switches.
- A cell is **disabled** if the actor does not hold that permission (cannot grant what you don't have), tooltip "You don't have this permission".
- A permission that is granted but **blocked by an ancestor** is shown as inherited-blocked (striped/grey) with tooltip "Blocked by {Ancestor}".
- Saving shows toast; changes are audit-logged; changing a parent's grant is immediately reflected in descendants' **effective** column (show an "Effective" chip list per row).
- Example enforced in the demo: a sub-vendor with `ONBOARD_DRIVERS` but not `MANAGE_PAYMENTS` can add drivers but sees Payments controls disabled and gets `PERMISSION_DENIED` if the API is forced.

### F5. Delegation (P0)
- **Delegation page** (visible to vendors with descendants): table of delegations you created: delegate, scope chips, status toggle (enabled/disabled), created date, actions (Edit scope, Revoke).
- **"Delegate authority" dialog:** pick delegate (searchable, only strict descendants), pick scope via checkboxes (only permissions you hold), optional "Delegate everything" shortcut that selects all of **your effective** permissions; confirm. Warn clearly: "{Delegate} will be able to perform these actions in your name."
- **Revoke** requires confirm dialog; effect is immediate; audit logged.
- **Acting on behalf:** a delegate with an active delegation sees header toggle; when on, banner across the top "You are acting on behalf of {Delegator}" and restricted to `scope`. Attempting an out-of-scope action shows "Not included in your delegation scope".
- **Continuity demo:** Admin-level Super Vendor "unavailable" (simulate by toggling "Mark unavailable" or just document) and delegate performing onboarding approval under their name shows in audit as "X on behalf of Y".
- Chain rule: a delegate can re-delegate only a **subset** of their own delegated scope to a descendant.

### F6. Vehicle & Driver Onboarding (P0)
**Vehicles page:** table (virtualized if > 100 rows) with reg no, model, seats, fuel, status badge (Active/Inactive/Blocked/Non-compliant), assigned driver, doc health icons, actions. Search + filters (status, fuel, compliance).
**Add/Edit Vehicle form (react-hook-form + zod):**
- Registration number: required; normalized (uppercase, strip spaces/hyphens); regex `^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$`; **unique** across all vehicles (`DUPLICATE_REG_NO`).
- Model: required, 2–50 chars. Seating capacity: integer 2–60. Fuel type: select of 5.
- Owner vendor: defaults to actor if Sub Vendor; otherwise select from descendant vendors.
- Docs section embedded (F7): RC, Permit, PUC, Insurance upload rows with expiry dates.
- Submit disabled while invalid/submitting; inline field errors below inputs; success toast; form resets or navigates.
- Requires `ONBOARD_FLEET`.

**Drivers page:** same pattern. Fields: name (2–60), phone (`^[6-9]\d{9}$`, unique), license number (required, `^[A-Z]{2}[0-9]{2}\s?[0-9]{11}$` tolerant normalization), DL upload w/ expiry. Requires `ONBOARD_DRIVERS`.

**Assign driver ↔ vehicle:**
- Dialog on the vehicle row: searchable list of **available, compliant, unassigned** drivers in the same subtree.
- Rules: one driver per vehicle and one vehicle per driver (`DRIVER_ALREADY_ASSIGNED` / `VEHICLE_ALREADY_ASSIGNED`); cannot assign a driver with an expired/missing/rejected DL; cannot assign to a non-compliant or blocked vehicle (`VEHICLE_NON_COMPLIANT` / `VEHICLE_BLOCKED`).
- Unassign action with confirm.

### F7. Documents & Compliance (P0)
**Required documents:** Driver → `DL`. Vehicle → `RC`, `PERMIT`, `PUC` (pollution), `INSURANCE`.
**Uploader component (reusable):**
- Drag-and-drop + click; accepts `application/pdf, image/jpeg, image/png`; max 5 MB (`DOC_INVALID_FILE` with specific reason: type vs size); expiry date input (required, cannot be in the past for a new upload; show a clear message); shows file name, size, progress bar (simulated), preview thumbnail for images (via `URL.createObjectURL`, session-only, and store only metadata).
- Re-upload replaces the old record and resets verification to `PENDING`.
**Document status (derived by `lib/compliance.ts`):**
`MISSING | PENDING | APPROVED | REJECTED | EXPIRED | EXPIRING_SOON (≤ 30 days)`.
- Colored chips + icons (not color alone) — see Section 4A.10.
**Vehicle compliance:** `isVehicleCompliant(v, now)` = all 4 required docs present **and** APPROVED **and** not expired. A non-compliant vehicle:
- shows a red "Non-compliant" badge with reasons list ("Insurance expired on 12 Aug", "PUC missing").
- **cannot** be set `ACTIVE` (toggle disabled with tooltip; API rejects `VEHICLE_NON_COMPLIANT`).
- is auto-**deactivated on read** if a doc has expired (derive operational status: `effectiveStatus = compliant && !blocked && status==='ACTIVE' ? 'OPERATIONAL' : ...`, don't rely on stale stored data).
- **Driver compliance** similarly from DL; a driver with an expired DL cannot be assigned.
**Reminders panel (P1):** bell icon with badge count; list of docs expiring ≤ 30 days and already expired, grouped by vendor, with links to fix. This represents the "automated reminders" requirement (state clearly in README that it is simulated in-app; real system would email/SMS via a scheduled job).
**Verification queue (`/documents`):** for actors with `VERIFY_DOCUMENTS`: table of `PENDING` docs in their subtree with Approve / Reject (reject **requires** a reason, min 5 chars). Bulk approve (select multiple) is P1.

### F8. Super Vendor Dashboard (P0)
Visual spec: Section 4A.6. Scoped to the acting user's subtree. Shows:
- **Stat cards:** Total sub-vendors, Active vehicles, Inactive vehicles, Blocked/Non-compliant vehicles, Pending verifications, Expired documents, Expiring soon (≤ 30d), Drivers Available / On trip / Off duty.
- **Sub-vendor table:** each direct sub-vendor with: name, role, status, #vehicles (active/inactive), #drivers available, #pending docs, compliance %, and a "Risk" badge; sortable and filterable; click row to drill into that vendor (View as / filter pages).
- **Pending verifications** widget (top 5 oldest + "View all").
- **Driver availability** widget.
- **Expiry reminders** widget.
- Dashboard values must come from **one aggregation pass** (`computeDashboardStats`) O(V + D + Veh) and be memoized.
- Loading skeletons; empty state for a vendor with no team ("No sub-vendors yet. Add your first").
- P2: charts (fleet status donut, compliance by sub-vendor bar), CSV export "Compliance report", and simulated live updates (setInterval every ~5 s flipping a few drivers' availability, with a "Live" pill toggle; must not cause full-page re-render).

### F9. Super Vendor Override Controls (P1)
- On vehicle/vendor rows for ancestors: **Disable vehicle** (dialog requires reason; sets `blocked`), **Re-enable** (only blocker or more senior), **Suspend sub-vendor** (reason; subtree becomes non-operational; banner shows for suspended users when "Viewing as" them), **Reactivate**.
- Example flow from the brief: Super Vendor sees a vehicle with missing insurance -> **Disable** -> vehicle cannot operate until resolved; sub-vendor sees "Blocked by {Super Vendor}: {reason}".
- All audited.

### F10. Audit Log (P1)
- Table: time, actor, "on behalf of", action, target, details. Filters (action, actor, date range). Cursor-based "Load more". Shows delegation attribution clearly.

---

## 15. UX STATES AND ERROR-HANDLING CATALOG

**Every screen must implement:** loading (skeleton), empty (illustration/text + CTA), error (message + Retry), and success feedback.

**Message catalog (centralize in `src/api/errors.ts` → `ERROR_MESSAGES`):**
| Code | User-facing message |
|---|---|
| NETWORK_ERROR | "Couldn't reach the server. Check your connection and retry." |
| CYCLE_DETECTED | "A vendor can't be moved under itself or one of its own team members." |
| INVALID_PARENT_ROLE | "A {role} can only be placed under a {allowed roles}." |
| SAME_PARENT | "{Name} is already under {Parent}." |
| PERMISSION_DENIED | "You don't have permission to {action}." |
| OUT_OF_SCOPE | "That vendor isn't part of your network." |
| DELEGATION_INVALID | "Your delegation for this action is disabled or doesn't include it." |
| ACCOUNT_SUSPENDED | "This account is suspended by {name}. Reason: {reason}" |
| DUPLICATE_REG_NO | "A vehicle with registration {regNo} already exists." |
| DRIVER_ALREADY_ASSIGNED | "{Driver} is already assigned to {Vehicle}." |
| VEHICLE_NON_COMPLIANT | "Vehicle can't operate: {reasons}." |
| VEHICLE_BLOCKED | "Blocked by {name}: {reason}." |
| DOC_INVALID_FILE | "Upload a PDF, JPG or PNG under 5 MB." |
| ROLE_CHANGE_CONFLICT | "Can't change role: {children} must be moved first." |

**Rules**
- Toasts: success (green), error (red, persists until dismissed for failures), info. Announce via `aria-live`.
- Confirm dialogs for: revoke delegation, disable vehicle, suspend vendor, reject document, reset demo data.
- **Prevent invalid operations upfront** (disabled buttons with tooltip explaining why) *and* validate on submit *and* validate in the API.
- Global **ErrorBoundary** with "Reload" and "Reset demo data" options; per-route boundary so one page crash doesn't kill the app.
- Form: validate on blur + on submit, first invalid field gets focus, error text linked with `aria-describedby`.
- Prevent double-submit everywhere.
- Unsaved-changes warning on forms with edits (P2).

---

## 16. PERFORMANCE AND SCALABILITY REQUIREMENTS

- Normalized state and adjacency index (no deep clones of the tree; use structural sharing).
- Selectors memoized by `treeVersion`; components subscribe narrowly; `React.memo` for TreeNode/rows; stable callbacks (`useCallback`), avoid inline object props in hot paths.
- Debounce search (250 ms). Search precomputes `searchKey` once per vendor at load/update.
- Tree renders **only expanded** nodes; Compact view and long tables use **virtualization**.
- Code splitting: `React.lazy` for routes; charts (P2) lazy loaded.
- Dev panel "Load 5,000 vendors" + a small **perf readout** (render count / last operation ms via `performance.now()`) to prove numbers in the demo and README.
- Scaling notes to document in README: server-side pagination + lazy child loading (`GET /vendors/:id/children`), materialized path or closure table on backend for O(1) subtree queries, WebSocket for live status, permission caching with invalidation on grant change, background job for expiry reminders.

---

## 17. ACCESSIBILITY

- Semantic HTML; labeled inputs; visible focus rings; skip-to-content link.
- Modals: focus trap, `aria-modal`, labelled by title, Esc to close, restore focus.
- Tree ARIA roles (F1); combobox ARIA (F2); status chips include text/icons not just color.
- Color contrast ≥ WCAG AA; role colors must still pass on card backgrounds.
- Respect `prefers-reduced-motion` (no pulse/animations then).
- All icon-only buttons have `aria-label`.

---

## 18. TESTING

**Unit tests (Vitest) for all `src/lib` logic. Minimum cases:**
- `tree`: build index; ancestors; descendants (deep chain of 10k nodes: no stack overflow); `wouldCreateCycle` (self, child, grandchild, unrelated); `reparent` keeps index consistent and moves subtree implicitly; `getValidParents` excludes self/descendants/current/role-invalid/suspended.
- `permissions`: effective intersection through 4 levels; revoke at top removes below; no escalation on grant; `authorize` for every branch (own, delegation ok, delegation disabled, out of scope, suspended ancestor, out-of-scope delegator).
- `compliance`: expiry boundary (today, +30d, +31d, yesterday), missing docs, rejected, pending, vehicle compliance reasons.
- `validators`: reg no normalization and valid/invalid samples, phone, file type/size.
- `search`: matching by name/email/phone, ancestor inclusion, tag + text combination, no results.
- Invariant test: after random sequences of 500 valid moves on a 200-node tree, `assertTreeInvariants` holds (no cycles, index in sync, single root).

**Component tests (RTL):**
- Move modal: Move disabled until selection; dropdown filters by search; invalid targets not listed; banner shows correct descendant count; submit success closes and toasts; API failure shows inline error and stays open.
- Delegation toggle enable/revoke flow.
- Vehicle form validation (bad reg no, duplicate reg no).

Set `VITE_API_LATENCY=0` in tests. Aim for meaningful coverage of `lib/` (> 90%).

---

## 19. DOCUMENTATION DELIVERABLES

### 19.1 README.md must include
1. Project overview + **live demo link** (Vercel/Netlify) + **demo video link**.
2. Screenshots/GIFs (tree, move modal, dashboard, delegation, compliance block).
3. Feature checklist mapped to the case-study sections (I, II, III, IV, V) with ✅ status.
4. Tech stack and **why** (short).
5. Setup: `npm i`, `npm run dev`, `npm test`, `npm run build`, env flags (`VITE_API_LATENCY`, `VITE_FAILURE_RATE`).
6. **How to demo** quickly: which "View as" users to pick to see delegation, restricted permissions, non-compliant vehicles, etc.
7. Architecture overview (folder structure, data flow: UI → store → api → mock DB; pure logic in lib).
8. Data model summary and design decisions (normalized tree, permissions as intersection, delegation semantics, derived compliance).
9. **Complexity analysis** (19.2).
10. Error handling strategy and UX decisions.
11. Performance approach + measured numbers from the 5k stress mode.
12. Scalability and production notes (what would change with a real backend).
13. Assumptions and trade-offs; known limitations; what I'd do with more time.
14. Note on AI usage: built with an AI coding agent (Claude Code); how generated code was reviewed/validated (tests, lint, manual checks).

### 19.2 Complexity Analysis section (table)
Use the table in Section 11 and add: dashboard aggregation O(V+D+Veh) time / O(S) space (S = direct sub-vendors); compliance check O(1) (≤5 docs); combobox filtering O(n) per keystroke, mitigated by debounce + virtualization; render cost O(visible nodes) not O(n); memory O(n) for normalized maps; audit log append O(1), page fetch O(page size). Include a paragraph on **space** (indexes double pointer storage but make traversals O(k)), and **monitoring resource consumption** (dev perf readout, React Profiler notes, bundle size report via `vite-bundle-visualizer`; state the measured bundle size).

### 19.3 Code documentation
JSDoc on all `lib/` functions (what/why/complexity), file-level comments in feature folders explaining responsibilities, `docs/ARCHITECTURE.md` with a text diagram, `docs/ASSUMPTIONS.md`.

---

## 20. DEMO PLAN (use to verify the app is demo-ready; also write `docs/DEMO_SCRIPT.md`)

Target 3–4 minutes:
1. Dashboard as Admin: stats, pending verifications, driver availability.
2. My Team: search, expand, tags filter, legend. Toggle Compact view. Click "Load 5,000 vendors", expand and search instantly, show perf readout, reset.
3. Move Profile: open modal on a Group Vendor, search dropdown, show banner count, move, Undo, move again. Try moving a node under its own child via a forced path (dev panel "Force invalid move") → error message.
4. Change Role (conflict and success).
5. Permissions matrix: restrict `MANAGE_PAYMENTS` for a sub vendor; "View as" that sub vendor → payments disabled with tooltip.
6. Delegation: create scoped delegation to a Regional Vendor; view as delegate → "Acting on behalf of"; perform an approval; show audit "on behalf of". Revoke and show it stop working.
7. Onboard a vehicle (validation errors → fix → success), upload docs, assign driver; upload an expired doc → vehicle non-compliant and cannot activate.
8. Super Vendor override: disable vehicle with reason; sub vendor sees blocked reason.
9. Simulated network failure toggle → error + Retry.

---

## 21. GIT AND DELIVERY

- Public GitHub repo, `main` branch, **small conventional commits** per logical step (at least one per phase, more is better; avoid one giant commit).
- `.gitignore`, `.editorconfig`, `LICENSE` (MIT).
- GitHub Actions workflow `ci.yml`: install, lint, typecheck, test, build.
- Deploy to **Vercel/Netlify**; add the link to README.
- `docs/screenshots/` populated; `docs/DEMO_SCRIPT.md`.
- Repo: https://github.com/hargunkaur28/vendor-hierarchy-fleet-onboarding.git

---

## 22. PHASE PLAN (definition of done per phase)

**Phase 1: Foundation.** Vite+TS+Tailwind+ESLint+Prettier+Vitest setup, types, role/permission config, `lib/tree.ts`, `lib/permissions.ts`, `lib/compliance.ts`, `lib/validators.ts`, seeded generator, with **full unit tests green**. *DoD: tests pass, types clean.*

**Phase 2: Mock API + store.** `api/client.ts` (latency, failure injection, persistence), endpoints for vendors/fleet/docs/delegation/audit, Zustand store, selectors, session + "View as". *DoD: can call every endpoint from a scratch test; persistence and reset work.*

**Phase 3: App shell + Tree (F1).** Layout, routing, header/sidebar (per 4A.5), tree view (vertical, per 4A.7), search, tags, legend, skeleton/empty/error states, keyboard navigation. *DoD: matches screenshot structure and style exactly; 5k stress mode smooth.*

**Phase 4: Move modal (F2) + Undo + audit hooks; Change Role (F3).** Combobox component (per 4A.8), dynamic banner, validation, optimistic update + rollback. *DoD: all acceptance criteria for F2 pass; matches Screens 2–3; component tests green.*

**Phase 5: Permissions + Delegation (F4, F5).** Matrix UI, delegate dialog, revoke, acting-on-behalf banner, authorize used by UI and API. *DoD: restricted sub-vendor demo works; delegation scope enforced both in UI and API.*

**Phase 6: Fleet + Drivers + Documents (F6, F7).** Forms with zod, uploader, compliance engine in UI, assignment rules, reminders panel, verification queue. *DoD: expired doc blocks activation; duplicate reg no rejected; DL expiry blocks assignment.*

**Phase 7: Dashboard + Overrides + Audit (F8, F9, F10).** *DoD: numbers reconcile with the underlying data; override blocks vehicle and sub-vendor sees reason.*

**Phase 8: Compact/Horizontal views, shortcuts modal, polish, accessibility pass, P2 items if time permits.**

**Phase 9: Docs + delivery.** README (with measured perf numbers), ARCHITECTURE, ASSUMPTIONS, DEMO_SCRIPT, screenshots, CI, deploy. *DoD: fresh clone → `npm i && npm run dev` works; all checks green.*

---

## 23. NON-GOALS (do not build)

- No real backend, real auth, real file storage, real email/SMS (simulate and document).
- No map/routing/booking features beyond what's needed to mention `MANAGE_BOOKINGS` / `MANAGE_PAYMENTS` as permission keys (placeholder pages with permission-gating are fine: they show "Module placeholder" with correct enable/disable behavior).
- No i18n.

---

## 24. FINAL CHECKLIST (verify before declaring done)

- [ ] Every P0 feature works end to end with mock data; screenshots' three screens are reproducible **visually**, per Section 4A
- [ ] Cannot create cycles or role-invalid parents by any UI path or API call
- [ ] Moving a subtree moves all descendants (tested)
- [ ] Effective permissions correct through 4+ levels; no privilege escalation possible
- [ ] Delegation: enable, restrict, revoke, acting-on-behalf, audit attribution
- [ ] Vehicle/driver onboarding validated; duplicates rejected; assignment rules enforced
- [ ] Expired/missing/rejected/pending docs handled; non-compliant vehicles cannot operate
- [ ] Dashboard numbers correct and scoped by "View as"
- [ ] Loading/empty/error states on every page; toasts on every mutation
- [ ] 5,000-vendor stress mode is smooth; perf numbers in README
- [ ] `lint`, `typecheck`, `test`, `build` all pass; CI green
- [ ] README complete incl. Complexity Analysis, assumptions, AI-usage note
- [ ] Demo video/screenshots ready; live link works; repo public
