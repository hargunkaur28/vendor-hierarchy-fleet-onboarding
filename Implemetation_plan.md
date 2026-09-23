# Vendor Hierarchy Management + Cab & Driver Onboarding — Implementation Plan

## Overview

Build a complete, production-quality **frontend-only** web app for a ride-sharing / corporate-commute platform's Vendor Management module. The app features a multi-level vendor hierarchy tree, cab & driver onboarding with compliance, delegation/permissions system, and a Super Vendor dashboard — all with mock data, optimistic UI, and full error handling.

**Key constraint:** Frontend-only with mock API layer (localStorage persistence), strict TypeScript, full unit tests, 5k-vendor stress-test performance, and pixel-faithful adherence to the reference screenshots' visual style (flat, operational SaaS console — no gradients, no hover-lift).

---

## Standing Constraints (apply to every file, every phase)

### Lazy Senior Dev Mode (Section 0.1)

This is a **binding coding discipline** for the entire build, not a one-time read. Before writing any code, climb the ladder: YAGNI → reuse existing → stdlib → platform feature → installed dep → one-liner → minimum code.

- **`// ponytail:` markers** on every deliberate simplification that cuts a real corner, naming the ceiling and the upgrade path.
- **Bug fix = root cause:** when touching `authorize()`, `wouldCreateCycle()`, `getEffectivePermissions()`, or `isVehicleCompliant()`, fix the **shared `lib/` function once** — never patch separately at each call site. These functions have multiple callers (UI + API layer); a fix belongs in the shared function.
- No abstractions not explicitly requested. No new deps if avoidable. Deletion over addition. Boring over clever. Fewest files possible. Shortest working diff wins.
- **Not lazy about:** understanding the problem, input validation at trust boundaries, error handling that prevents data loss, accessibility, and the complexity/scalability requirements the spec explicitly asks for.

### Commit Discipline

Multiple logical commits within each phase (not one giant commit per phase). Conventional messages: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`. Each commit should pass lint/typecheck at minimum.

### docs/ASSUMPTIONS.md

Created **before Phase 1 code** and appended to as ambiguities are resolved throughout every phase — not backfilled in Phase 9.

---

## Proposed Changes

### Phase 1: Foundation

Set up the project with Vite + React 18 + TypeScript (strict) + Tailwind CSS, install all dependencies, configure ESLint/Prettier/Vitest, define domain types, role/permission config, implement all pure business logic in `src/lib/` with full unit tests, **and** build the deterministic seed generator.

#### [NEW] `docs/ASSUMPTIONS.md`
Created first, before any code. Documents every ambiguity resolved during the build. Appended to in every subsequent phase.

#### [NEW] Project scaffold via Vite

- `npx -y create-vite@latest ./ --template react-ts`
- Configure `tsconfig.json` with `strict: true`, path aliases
- Install all deps from Section 4: zustand, react-router-dom, react-hook-form, zod, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-tooltip, @radix-ui/react-checkbox, @radix-ui/react-switch, @radix-ui/react-select, sonner (toast), @tanstack/react-virtual, lucide-react, date-fns, immer
- Dev deps: vitest, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom, eslint, @typescript-eslint/eslint-plugin, @typescript-eslint/parser, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y, prettier, prettier-plugin-tailwindcss
- Configure `tailwind.config.ts` with all design tokens from Section 4A.2
- Add all npm scripts: dev, build, preview, lint, typecheck, test, test:watch, format

#### [NEW] `src/types/index.ts`
All domain types from Section 6: `RoleKey`, `PermissionKey`, `Vendor`, `Vehicle`, `Driver`, `DocumentRecord`, `Delegation`, `AuditEntry`, etc.

#### [NEW] `src/config/roles.ts`
Role configuration from Section 7 with `ROLE_CONFIG`, `getValidParentRoles()`, `isRoleAllowedUnder()`.

#### [NEW] `src/config/permissions.ts`
Permission keys, labels, and default grants per role.

#### [NEW] `src/config/constants.ts`
`EXPIRY_WARNING_DAYS = 30`, file size limits, regex patterns, etc.

#### [NEW] `src/lib/tree.ts` + `src/lib/tree.test.ts`
All tree algorithms from Section 11: `buildChildrenIndex`, `getAncestors`, `isDescendantOf`, `getDescendantIds` (iterative DFS), `wouldCreateCycle`, `getValidParents`, `reparent`, `searchTree`, `assertTreeInvariants`. Full unit tests including 10k-node deep chain (no stack overflow), random 500-move invariant test.

#### [NEW] `src/lib/permissions.ts` + `src/lib/permissions.test.ts`
`getEffectivePermissions`, `authorize`, `canGrant`. Tests for intersection through 4 levels, revoke propagation, delegation paths, suspended ancestor check.

#### [NEW] `src/lib/compliance.ts` + `src/lib/compliance.test.ts`
`getDocumentStatus`, `isVehicleCompliant`, `getComplianceReasons`, `isDriverCompliant`. Tests for expiry boundaries, missing docs, rejected, pending.

#### [NEW] `src/lib/validators.ts` + `src/lib/validators.test.ts`
Zod schemas for reg no, phone, license, file type/size. Tests for valid/invalid samples with normalization.

#### [NEW] `src/lib/search.ts` + `src/lib/search.test.ts`
`searchTree` with tag/role filters. Tests for name/email/phone matching, ancestor inclusion, combined filters.

#### [NEW] `src/lib/dates.ts`
Date utilities using date-fns.

#### [NEW] `src/lib/prng.ts`
Mulberry32 seeded PRNG for deterministic seed data.

#### [NEW] `src/api/seed.ts`
Deterministic seed generator using the PRNG. Scaffolded in Phase 1 (not deferred to Phase 2) per the spec's Phase 1 DoD. Includes:
- **Golden scenario** (~60 vendors) matching screenshots: admin → ~14 Site Admins → Group Vendors → Sub Vendors → DAs
- **Explicit deep N-level branch:** Group Vendor → Regional Sub Vendor → City Sub Vendor → Local Sub Vendor → DA (proves unbounded nesting)
- Fleet seed with realistic doc status mix (10% expired, 10% expiring ≤30d, 8% pending verification, 4% rejected, 3% missing required doc)
- 2 delegations (one enabled with narrowed scope, one disabled)
- Varied permission grants (some restricted)
- Tags: North, South, East, West, Premium, Pilot
- **Stress mode** function: generates 5,000 valid vendors with role-valid parents

**Phase 1 Commits (target):**
1. `chore: scaffold vite + ts + tailwind + deps`
2. `docs: create ASSUMPTIONS.md`
3. `feat: domain types and role/permission config`
4. `feat: tree algorithms with unit tests`
5. `feat: permissions and authorization with unit tests`
6. `feat: compliance logic with unit tests`
7. `feat: validators and search with unit tests`
8. `feat: deterministic seed generator with N-level branch`

**DoD:** All tests pass, types clean, lint clean.

---

### Phase 2: Mock API + Store

#### [NEW] `src/api/errors.ts`
`AppError` class with typed error codes and the message catalog from Section 15.

#### [NEW] `src/api/client.ts`
Mock transport: configurable latency (300–800ms, 0 in tests via `VITE_API_LATENCY`), failure injection (~15% rate via `VITE_FAILURE_RATE` or dev toggle), localStorage persistence with versioned key (`vendorhub:v1`).

#### [NEW] `src/api/vendorsApi.ts`
All vendor endpoints: list, get, move, changeRole, create, update, suspend, reactivate, updateGrantedPermissions. Each validates with zod and re-runs `authorize`.

#### [NEW] `src/api/fleetApi.ts`
Vehicle and driver endpoints: CRUD, assign/unassign, block/unblock, status toggle. Compliance enforcement.

#### [NEW] `src/api/documentsApi.ts`
Upload (metadata only), reviewDocument (approve/reject with reason).

#### [NEW] `src/api/delegationApi.ts`
CRUD for delegations, scope updates, enable/disable.

#### [NEW] `src/api/auditApi.ts`
Cursor-paginated list, append on every mutation.

#### [NEW] `src/store/useAppStore.ts`
Zustand store with immer middleware. Slices: session, vendors, fleet, delegations, audit, ui. Optimistic update + rollback pattern for key mutations (moveVendor, vehicle status toggle, delegation toggle). `assertTreeInvariants` in dev mode after each vendor mutation.

#### [NEW] `src/store/selectors.ts`
Memoized selectors: `selectVisibleTree`, `selectSubtreeStats`, `selectEffectivePermissions`, `selectNonCompliantVehicles`, `selectExpiringDocuments`, `computeDashboardStats`.

**Phase 2 Commits (target):**
1. `feat: AppError class and error catalog`
2. `feat: mock API client with latency/failure/persistence`
3. `feat: vendor API endpoints with authorization`
4. `feat: fleet and document API endpoints`
5. `feat: delegation and audit API endpoints`
6. `feat: zustand store with slices and optimistic updates`
7. `feat: memoized selectors`

**DoD:** Can call every endpoint from tests; persistence and reset work; store syncs with API.

---

### Phase 3: App Shell + Tree (F1)

#### [NEW] `src/App.tsx`
Router setup, layout with sidebar + header, React.lazy routes, ErrorBoundary.

#### [NEW] `src/components/ui/`
Shared UI components: Button, Modal (Radix Dialog), Combobox, Badge, Avatar, Skeleton, EmptyState, ConfirmDialog, Toast wrapper (sonner), ErrorBoundary, FormField.

#### [NEW] `src/features/hierarchy/`
- `TreeView.tsx` — Main container, toolbar, search, filters
- `TreeNode.tsx` — React.memo'd node card with avatar, name, email, edit icon, Move Profile button, expand/collapse with child-count badge
- `Legend.tsx` — Role color legend (inline dot+label pairs)
- `Toolbar.tsx` — Search input, tag dropdown, role filter, view toggles, shortcuts icon (grid/squares icon per screenshots)
- Connector lines via CSS pseudo-elements (orthogonal/right-angle routing per screenshots)
- Keyboard navigation: Arrow keys, Enter, /, Esc
- ARIA: role="tree", role="treeitem", aria-expanded, aria-level

#### [NEW] `src/hooks/useDebounce.ts`, `src/hooks/useKeyboardShortcuts.ts`, `src/hooks/useAsync.ts`

#### [NEW] `src/styles/index.css`
Design system: custom Tailwind theme, component classes (.card, .badge, .skeleton), Inter font import, motion rules per 4A.9.

**DoD:** Matches screenshot 1 structure and style exactly; 5k stress mode smooth; keyboard navigation works.

---

### Phase 4: Move Modal (F2) + Change Role (F3)

#### [NEW] `src/features/hierarchy/MoveProfileModal.tsx`
- Change Parent (P0) + Change Role (P1) radio
- Searchable combobox with virtualized dropdown (name primary, email secondary subtle — per screenshots, names are emphasized)
- Dynamic info banner with accurate descendant count
- Optimistic update + rollback + undo (5s toast)
- Post-move pulse highlight (2s, respects prefers-reduced-motion)
- All validation: cycle, role, same parent

#### [NEW] `src/components/ui/Combobox.tsx`
Reusable searchable combobox with virtualization, keyboard navigation, ARIA combobox/listbox/option pattern.

#### [NEW] Component tests: `MoveProfileModal.test.tsx`

**DoD:** All F2 acceptance criteria pass; matches screenshots 2–3 exactly; component tests green.

---

### Phase 5: Permissions + Delegation (F4, F5)

#### [NEW] `src/features/delegation/`
- `DelegationPage.tsx` — Table of delegations with status toggle, edit scope, revoke
- `PermissionMatrix.tsx` — Toggle grid for granting/revoking permissions to sub-vendors
- `DelegateDialog.tsx` — Create delegation dialog with descendant picker and scope checkboxes

#### Acting-on-behalf header toggle, banner, scope enforcement in all action paths.

**DoD:** Restricted sub-vendor demo works; delegation scope enforced in both UI and API; audit shows "on behalf of" attribution.

---

### Phase 6: Fleet + Drivers + Documents (F6, F7)

#### [NEW] `src/features/fleet/`
- `VehiclesPage.tsx` — Virtualized table with search, filters, status badges
- `VehicleForm.tsx` — react-hook-form + zod, embedded doc upload
- `DriversPage.tsx` — Same pattern
- `DriverForm.tsx`
- `AssignDriverDialog.tsx` — Searchable list of available compliant unassigned drivers

#### [NEW] `src/features/documents/`
- `DocumentUploader.tsx` — Drag-and-drop, file validation, expiry date, simulated progress
- `DocumentList.tsx` — Status chips with icons per 4A.10
- `VerificationQueue.tsx` — Pending docs table with approve/reject (reject requires reason ≥5 chars)

**DoD:** Expired doc blocks activation; duplicate reg no rejected; DL expiry blocks assignment; compliance badges accurate.

---

### Phase 7: Dashboard + Overrides + Audit (F8, F9, F10)

#### [NEW] `src/features/dashboard/`
- `DashboardPage.tsx` — Stat cards (per 4A.6), sub-vendor table, widgets
- `StatCards.tsx` — Colored accent bar, icon, big number, uppercase muted label
- `SubVendorTable.tsx` — Sortable, filterable, risk badges, click to drill
- `ReminderPanel.tsx` — Expiry reminders + pending verifications

#### [NEW] `src/features/audit/`
- `AuditLogPage.tsx` — Table with filters, cursor-based "Load more", delegation attribution

#### Override controls integrated into vehicle/vendor rows (F9, P1).

**DoD:** Dashboard numbers reconcile with underlying data; override blocks vehicle and sub-vendor sees reason; audit log shows delegation attribution.

---

### Phase 8: Polish + Views + Accessibility + Dev Panel

- **Compact view** (P1): virtualized indented list with @tanstack/react-virtual
- **Horizontal view** toggle
- **Keyboard shortcuts modal** (`?` opens it)
- **Dev panel** (accessible from header menu):
  - "Simulate flaky network" toggle (15% failure rate)
  - "Load 5,000 vendors" button + perf readout
  - "Reset demo data" button (with confirm dialog)
  - **"Force invalid move" button** (for Demo Plan step 3 — attempts a cycle-creating move to demonstrate error handling)
  - API latency slider
- Full **accessibility pass**: focus management, ARIA audit, contrast checks, `prefers-reduced-motion`
- **Code splitting**: `React.lazy` for all routes
- Tag filter, role filter, Undo on move, expiry reminders panel (P1 items)

**DoD:** All P1 items working; dev panel functional; accessibility audit clean; reduced-motion respected.

---

### Phase 9: Docs + Delivery

#### [NEW] `README.md`
Complete per Section 19.1: overview, feature checklist, tech stack, setup, demo guide, architecture, data model, complexity analysis table (Section 19.2), error handling, performance numbers from 5k stress, scalability notes, assumptions, AI usage note.

#### [UPDATE] `docs/ASSUMPTIONS.md`
Final review — should already be populated from all prior phases.

#### [NEW] `docs/ARCHITECTURE.md`
Data flow diagram, folder structure, design decisions.

#### [NEW] `docs/DEMO_SCRIPT.md`
3–4 minute demo walkthrough from Section 20.

#### [NEW] `.github/workflows/ci.yml`
Install, lint, typecheck, test, build.

#### [NEW] `.gitignore`, `.editorconfig`, `LICENSE` (MIT)
`.gitignore` covering node_modules, dist, .env, coverage, etc.

#### Deploy
- Push to `github.com/hargunkaur28/vendor-hierarchy-fleet-onboarding`
- Deploy to Vercel or Netlify
- Add both links (repo + live demo) to README

#### [NEW] `docs/screenshots/`
Populated with app screenshots for README.

**DoD:** Fresh clone → `npm i && npm run dev` works; all checks green; live demo accessible; repo public.

---

## Verification Plan

### Automated Tests
```bash
npm run lint        # ESLint with typescript-eslint, react-hooks, jsx-a11y
npm run typecheck   # tsc --noEmit with strict: true
npm run test        # Vitest: all lib/ unit tests + component tests
npm run build       # Production build succeeds
```

### Manual Verification
- All 3 reference screenshots reproduced visually (tree, move modal, searchable dropdown)
- 5,000-vendor stress mode: expand/collapse and search feel instant (<100ms)
- Move a Group Vendor → all descendants follow; Undo restores
- Cycle prevention: cannot move node under itself or its descendant
- "Force invalid move" dev button → clear error message
- Permission matrix: restrict a permission → sub-vendor sees it disabled
- Delegation: create, act on behalf of, audit shows attribution, revoke stops it
- Expired doc → vehicle non-compliant → cannot activate
- Duplicate reg no → rejected
- Simulated network failure → error toast + retry
- Dashboard numbers match underlying data
- Keyboard navigation works throughout
- Responsive on mobile
- `prefers-reduced-motion` disables animations

> [!IMPORTANT]
> This is a very large project (~9 phases). I will implement phase by phase, committing granularly within each phase. P0 features will be fully polished before touching P1/P2.

> [!NOTE]
> The spec says to use Tailwind CSS (Section 4) despite the system prompt preferring vanilla CSS. The spec's Section 4 is explicit and takes precedence.
