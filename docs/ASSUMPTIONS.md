# Assumptions & Architectural Decisions

This document tracks technical assumptions and architectural resolutions established while implementing the requirements outlined in [CASE_STUDY_BRIEF.md](file:///d:/vendor-management-sys/CASE_STUDY_BRIEF.md).

---

## Phase 1: Foundation

### A1: React 18 vs React 19
Baseline dependencies targeted React 18, while modern Vite scaffolding packages React 19. Decision: **keep React 19** — it is backwards-compatible with the React 18 API surface (hooks, memo, lazy, Suspense), and downgrading would fight modern toolchains with no operational benefit.

### A2: `noUncheckedIndexedAccess`
Enabled in addition to `strict: true`. System guidelines mandate avoiding `any` — this compiler flag forces safe handling of `undefined` when indexing into `Record` or array structures, eliminating runtime access errors in the normalized store (`vendorsById[id]` returns `T | undefined`).

### A3: Combobox dropdown — name only vs name + email
Reference UI screenshots display name-only rows in the dropdown list, whereas core feature requirements state: "Each option: name (primary), email (secondary), tiny child-count." Decision: **include email as a subtle secondary line** (`text-xs text-muted`) for optimal disambiguation when multiple vendors share similar naming.

### A4: SUB_VENDOR self-nesting depth limit
Vendor hierarchy rules permit `SUB_VENDOR` &rarr; `SUB_VENDOR` nesting with unbounded depth. Decision: **no artificial depth limit** in the type system or validation — tree algorithms are strictly iterative (no call-stack recursion / no stack overflows), meaning hierarchy depth is bounded only by browser memory.

### A5: "Super Vendor" terminology
Per domain semantics, "Super Vendor" refers to any vendor actively managing and viewing their own downstream subtree. Decision: the UI displays specific role titles (`ADMIN`, `SITE_ADMIN`, `GROUP_VENDOR`, `SUB_VENDOR`, `DEPLOYMENT_ASSOCIATE`), while treating "Super Vendor" as an active operational **perspective** rather than a rigid static role.

### A6: Sonner vs react-hot-toast
Tooling options evaluated included Sonner and react-hot-toast. Decision: **sonner** — delivers a lighter bundle footprint, superior stacking/dismissal physics, native promise-based toasts for optimistic rollback, and integrated `aria-live` screen-reader announcements.

### A7: @tanstack/react-virtual vs react-window
Virtualization tooling evaluated TanStack Virtual and react-window. Decision: **@tanstack/react-virtual** — provides modern TypeScript integration, flexible fixed and variable row sizing, and seamless headless integration with both flat lists and combobox selectors.

### A8: File storage for documents
Storage specifications mandate metadata persistence only. Decision: documents persist metadata attributes (`fileName`, `fileSize`, `mimeType`, `expiryDate`). Temporary image thumbnail previews use session-only `URL.createObjectURL` object URLs without persisting heavy binary blobs into browser `localStorage`.

### A9: Vehicle registration number regex
Validation guidelines define `^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$`. Indian registration numbers vary across states (e.g., `KA01AB1234`, `DL3CAX4321`). Decision: **enforce this standard format** after normalizing input (uppercasing, trimming, and stripping dashes/whitespace).

### A10: Driver license number regex
Validation rules specify `^[A-Z]{2}[0-9]{2}\s?[0-9]{11}$` with tolerant normalization. Decision: normalize by uppercasing and stripping whitespace, then validate against `^[A-Z]{2}\d{2}\d{11}$` (15 alphanumeric characters total), matching standard state RTO driver license conventions.

---

## Phase 2: Mock API & Store

### A11: Failure injection and latency controls
Configured via `devApiConfig` in `src/api/client.ts`. Default latency is 300–800ms in development, 0ms in test environments (`import.meta.env.MODE === 'test'`). Network failure rate defaults to 0% and is adjustable up to 100% via the Dev Diagnostics Panel with a `forceFailNext` one-shot trigger for verifying optimistic update rollback.

### A12: Validation precedence — cycle check before role restriction
When moving a vendor, `wouldCreateCycle()` is evaluated before role compatibility. Moving a node under itself or a descendant is fundamentally a topological graph violation, so it consistently returns `CYCLE_DETECTED` even if the target role would also violate placement rules.

### A13: Driver availability state machine
The `Driver` model tracks `availability: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY'`. The manual driver status toggle alternates between `AVAILABLE` and `OFF_DUTY`. `ON_TRIP` represents an active dispatch engagement and cannot be manually toggled.

### A14: Bidirectional driver-vehicle assignment
Assigning a driver updates both `vehicle.assignedDriverId` and `driver.assignedVehicleId`. Unassigning clears both associations atomically. If a vehicle is deactivated or blocked, its assigned driver remains associated but is flagged as unavailable in assignment selectors.

### A15: Core API Error Code Catalog Conformance
All error codes strictly conform to the system error catalog (`src/api/errors.ts`):
- Role placement rule violations map to `INVALID_PARENT_ROLE`.
- Parent or ancestor suspensions map to `ACCOUNT_SUSPENDED`.
- Vehicle compliance deficiencies map to `VEHICLE_NON_COMPLIANT`.
- Attempting to move the root vendor maps to `PERMISSION_DENIED` ("Root vendor cannot be moved").
- Symmetrical vehicle assignment conflicts map to `VEHICLE_ALREADY_ASSIGNED` alongside `DRIVER_ALREADY_ASSIGNED`. Standard API codes `VALIDATION_ERROR`, `NOT_FOUND`, and `CONFLICT` are retained for HTTP API completeness.

---

## Phase 4: Move Profile Modal & Change Role

### A16: Combobox Virtualization Threshold
When valid parent options exceed 100 items (such as in the 5,000-vendor stress test mode), `@tanstack/react-virtual` engages with fixed 44px row heights to keep DOM nodes bounded to ~10 rendered elements. When options count is ≤ 100, standard performant DOM rendering is maintained.

### A17: Combobox Option Row Content
Dropdown items display vendor name as primary (`text-sm font-medium text-slate-800`), email as secondary (`text-xs text-slate-400`), and a child-count badge (`bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-[10px]`) on the right, providing clean visual clarity and rapid disambiguation.

### A18: Change Role Conflict Resolution
If a vendor has children that are incompatible with a proposed new role (`allowedChildRoles`), the modal displays an inline error banner identifying each blocking child and their current role (`ROLE_CHANGE_CONFLICT`), disabling submission until those children are relocated.

### A19: Undo Toast Lifecycle
The post-move Undo toast uses a 5,000ms duration with Sonner. Clicking "Undo" invokes `moveVendor(vendorId, previousParentId)`, restoring the exact prior state and recording an audit trail event. If another move occurs while an Undo toast is active, the prior toast is dismissed to prevent race conditions.

### A20: Change Role Pre-filtering (Condition a vs Condition b)
Candidate roles in the 'Select New Role' dropdown are strictly pre-filtered to roles allowed under the node's current parent (`isRoleAllowedUnder(role, parentVendor.role)`). If the node has existing children incompatible with a candidate role (e.g. converting a Sub Vendor with children into a Deployment Associate), selecting it surfaces the inline `ROLE_CHANGE_CONFLICT` warning banner and blocks submission until the children are moved.

---

## Phase 5: Permissions & Delegation (F4, F5)

### A21: Delegation Visibility and Descendant Scope
Delegation creation is strictly restricted to direct and indirect descendants of the delegator (`getDescendantIds(currentUserId, childrenIndex)`). Leaf nodes with no downstream team members see a clean informational message indicating delegation requires reporting sub-vendors.

### A22: Acting on Behalf Multi-delegation Resolution
When a user receives active delegations from multiple delegators, the top navigation bar provides an "Acting on behalf of" switcher to select which delegator's perspective to assume or revert to their direct identity. An alert banner clearly reflects the active delegation and permitted functional scope.

### A23: Permission Matrix Ancestor Walk for Blocking Tooltip
When a permission is directly granted to a vendor but blocked by an ancestor's restrictions, the matrix employs `findPermissionBlocker(vendor.id, perm, vendorsById)` to identify the first ancestor lacking that permission, displaying `"Blocked by {ancestor.name}"` in a tooltip with a striped/grey visual indicator.

---

## Phase 6: Fleet, Drivers & Document Compliance (F6, F7)

### A24: Live Operational Status Derivation (Auto-deactivated on Read)
The operational badge and effective operational state on `/vehicles` are derived live on each render using `isVehicleCompliant(vehicle, now)`. Even if `vehicle.status === 'ACTIVE'` in persistent storage, if any required document (`RC`, `PERMIT`, `PUC`, `INSURANCE`) is expired, missing, or rejected, the effective status immediately derives to `NON_COMPLIANT` with specific failure reasons, and the activation toggle is disabled. If `vehicle.blocked` is present, it derives to `BLOCKED`. A vehicle is only `OPERATIONAL` when `compliant && !blocked && status === 'ACTIVE'`.

### A25: FuelType Domain Schema
FuelType adheres to the domain union `'PETROL' | 'DIESEL' | 'CNG' | 'EV' | 'HYBRID'`, standardizing `EV` for electric vehicle fleets.

### A26: Acting on Behalf Delegation Attribution
When an actor operates in "Acting on Behalf" mode (`actingOnBehalfOf !== null`), UI headers and interaction cards attribute operations to the delegator's identity, and the immutable audit log records the delegation context.

### A27: Vehicle Active Toggle Clamping & Document Expiry Persistence
1. **Toggle Clamping:** A non-compliant vehicle (missing, expired, or rejected required documents) can never show the Active toggle as ON. The toggle visual is strictly derived as `vehicle.status === 'ACTIVE' && isVehicleCompliant(vehicle).compliant`. If non-compliant, it renders as deactivated (OFF) and disabled for reactivation, with a specific tooltip detailing each missing or expired document.
2. **Reactivation Feedback:** Clicking the toggle or attempting reactivation on an inactive or non-compliant vehicle surfaces the exact failure reason in a toast notification and hover tooltip (e.g. "Cannot activate: RC expired on 2024-01-01. Upload valid documents first.").
3. **Document Expiry Persistence:** When editing a vehicle or driver, changing a document's expiry date without uploading a new binary file persists the updated expiry date to the store immediately on submit, triggering live compliance re-derivation across all views.

### A28: Override Seniority Enforcement & Vehicle Block Status
1. **Vehicle Block/Unblock Status:** `VehicleBlockDialog.tsx` provides the UI dialog for capturing block reasons. In Phase 7, seniority governance rules are enforced in both `fleetApi.unblockVehicle` and UI unblock buttons: unblocking is strictly restricted to the original blocker or a more senior ancestor (`ROLE_CONFIG[actor.role].rank < ROLE_CONFIG[blocker.role].rank` or ancestor of blocker).
2. **Vendor Suspension & Reactivation:** Suspending requires a reason ($\ge 5$ characters) and renders the subtree non-operational via ancestor verification. Reactivation is strictly restricted to the original suspender or a more senior ancestor; less senior peers cannot undo a senior override.

---

## Phase 8: Compact/Horizontal Views, Keyboard Shortcuts, Accessibility & Polish

### A29: Horizontal Tree Connector Geometry
Curved bezier connectors are avoided in favor of clean orthogonal hierarchy lines. `HorizontalTreeView` exclusively implements orthogonal right-angle connector lines (`w-[1.5px]`, `h-[1.5px]`, and `left-0` vertical bus lines linking siblings from center of first child to center of last child), consistent with the vertical hierarchy tree.

### A30: Keyboard Navigation Left/Right Contract
In strict compliance with keyboard tree navigation standards, `ArrowLeft` strictly collapses the selected node (if expanded) and `ArrowRight` strictly expands the selected node (if collapsed), avoiding erratic sibling jumps.

### A31: Notification Bell Expiry Badge
The header notification bell is live-wired to `selectExpiringDocuments(store).length`. When expiring documents ($\le 30$ days) are present, a badge pill displays the count. Clicking the bell navigates directly to `/documents?tab=expiries`.

### A32: Accessibility & Reduced Motion
In `src/index.css`, `@media (prefers-reduced-motion: reduce)` suppresses all animations, transitions, and pulsing effects across cards, toasts, and dialogs. Prominent `:focus-visible` outlines guarantee accessible keyboard focus management.
