# Assumptions & Ambiguity Resolutions

This document tracks every ambiguity resolved during the build. Created before Phase 1 code; appended to as decisions are made.

---

## Phase 1: Foundation

### A1: React 18 vs React 19
The spec says "React 18" but `create-vite@latest` scaffolds React 19. Decision: **keep React 19** — it's backwards-compatible with the React 18 API surface the spec targets (hooks, memo, lazy, Suspense), and downgrading would fight the toolchain for no benefit. Nothing in the spec relies on React 18-only behavior.

### A2: `noUncheckedIndexedAccess`
Enabled in addition to `strict: true`. The spec says "no `any`" — this flag forces us to handle `undefined` when indexing into `Record` or arrays, which is stricter than the spec requires but prevents a whole class of runtime errors in the normalized store (`vendorsById[id]` returns `T | undefined`). Lazy: one `!` or guard per access is cheaper than one bug per missed check.

### A3: Combobox dropdown — name only vs name + email
Screenshot 3 shows name-only rows in the dropdown list. Spec Section 14/F2 says "Each option: name (primary), email (secondary), tiny child-count." Decision: **include email as a subtle secondary line** (`text-xs text-muted`) per the spec, since the screenshots are a style reference but the spec's feature definition is the acceptance criteria. This adds useful disambiguation when multiple vendors share similar names.

### A4: SUB_VENDOR self-nesting depth limit
Section 7 says SUB_VENDOR → SUB_VENDOR is allowed with "unbounded" depth. Decision: **no artificial depth limit** in the type system or validation — the tree algorithms are all iterative (no recursion / no stack overflow), so depth is limited only by the browser's memory. The deep N-level seed branch (Regional → City → Local → DA) demonstrates this.

### A5: "Super Vendor" terminology
Section 7 note: "Super Vendor = any vendor viewing their own subtree." Decision: the UI never shows a "Super Vendor" role label — it's a **perspective**, not a role. Admin/Site Admin/Group Vendor/Sub Vendor/DA are the only role labels. The README will document this mapping.

### A6: Sonner vs react-hot-toast
Spec Section 4 says "react-hot-toast (or sonner)". Decision: **sonner** — smaller bundle, better defaults for stacking/dismissal, built-in promise toasts for optimistic updates, and native `aria-live` support. One less thing to configure.

### A7: @tanstack/react-virtual vs react-window
Spec lists both. Decision: **@tanstack/react-virtual** — framework-agnostic core with better TypeScript support, supports both fixed and variable-size rows, and doesn't require wrapping components in specific container patterns. Works better with our flat list (Compact view) and combobox virtualization.

### A8: File storage for documents
Spec Section 9 says "metadata only, no bytes stored." Decision: documents store only metadata (fileName, fileSize, mimeType, expiryDate). `URL.createObjectURL` is used for image preview thumbnails during the session only — the blob is not persisted to localStorage. A `// ponytail:` comment marks this ceiling.

### A9: Reg no regex
Spec says `^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$`. Indian registration numbers actually vary (e.g., `KA01AB1234`, `DL3CAX4321`). Decision: **use the spec's regex exactly** after normalizing input (uppercase, strip spaces/hyphens). The seed data will produce conforming values.

### A10: Driver license number regex
Spec says `^[A-Z]{2}[0-9]{2}\s?[0-9]{11}$` with "tolerant normalization." Decision: normalize by uppercasing and stripping spaces, then validate against `^[A-Z]{2}\d{2}\d{11}$` (15 chars total). This matches the Indian DL format (state code + RTO code + 11 digits).

---

## Phase 2: Mock API & Store

### A11: Failure injection and latency controls
Configured via `devApiConfig` in `src/api/client.ts`. Default latency is 300–800ms in development, 0 in test environment (`import.meta.env.MODE === 'test'`). Failure rate is 0 by default and configurable up to 100% via dev panel with a `forceFailNext` one-shot trigger for testing optimistic update rollback.

### A12: Validation precedence — cycle check before role restriction
When moving a vendor, `wouldCreateCycle()` is evaluated before role compatibility. Moving under self or a descendant is fundamentally a topological violation, so it must return `CYCLE_DETECTED` consistently even if the target role would also violate the hierarchy.

### A13: Driver availability state machine
The `Driver` model tracks `availability: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY'`. The driver status toggle switches between `AVAILABLE` and `OFF_DUTY`. `ON_TRIP` is reserved for active rides and cannot be toggled manually.

### A14: Bidirectional driver-vehicle assignment
Assigning a driver updates both `vehicle.assignedDriverId` and `driver.assignedVehicleId`. Unassigning clears both fields simultaneously. If a vehicle is deactivated or blocked, its assigned driver remains associated but is flagged as unavailable in assignment comboboxes.

### A15: Section 15 Error Code Catalog Conformance
All error codes strictly conform to Section 15's exact error catalog (`src/api/errors.ts`):
- Role placement rule violations map to `INVALID_PARENT_ROLE` (not `ROLE_RESTRICTION`).
- Parent or ancestor suspensions map to `ACCOUNT_SUSPENDED` (not `SUSPENDED_PARENT`).
- Vehicle compliance deficiencies map to `VEHICLE_NON_COMPLIANT` (not `NON_COMPLIANT_VEHICLE`).
- Attempting to move the root vendor maps to `PERMISSION_DENIED` with a descriptive message ("Root vendor cannot be moved"), as there is no `ROOT_VENDOR_IMMUTABLE` in Section 15.
- Symmetrical vehicle assignment conflict uses `VEHICLE_ALREADY_ASSIGNED` alongside Section 15's `DRIVER_ALREADY_ASSIGNED`. Standard API codes `VALIDATION_ERROR`, `NOT_FOUND`, and `CONFLICT` are retained for HTTP API completeness.

---

## Phase 4: Move Profile Modal & Change Role

### A16: Combobox Virtualization Threshold
When valid parent options exceed 100 items (e.g., in the 5,000-vendor stress test mode), `@tanstack/react-virtual` is engaged with fixed 44px row heights to keep DOM nodes bounded to ~10 visible elements. When options count is ≤ 100, a standard scrollable list is rendered.

### A17: Combobox Option Row Content
Screen 3 displays vendor name rows. Section 14/F2 states: "Each option: name (primary), email (secondary), tiny child-count." We display name as primary (`text-sm font-medium text-slate-800`), email as secondary (`text-xs text-slate-400`), and a small child-count badge (`bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-[10px]`) on the right. This maintains the clean style of Screen 3 while satisfying the spec's disambiguation requirement.

### A18: Change Role Conflict Resolution
If a vendor has children that are incompatible with the proposed new role (`allowedChildRoles`), the modal displays a specific inline error banner naming each blocking child and their role (`ROLE_CHANGE_CONFLICT`), disabling the submit button until those children are moved.

### A19: Undo Toast Lifecycle
The post-move Undo toast uses a 5,000ms duration with Sonner. Clicking "Undo" invokes `moveVendor(vendorId, previousParentId)`, restoring the exact prior state and recording an audit entry. If another move occurs while an Undo toast is active, the active toast is dismissed to prevent out-of-order race conditions.

### A20: Change Role Pre-filtering (Condition a vs Condition b)
Per Spec F3, candidate roles in the 'Select New Role' dropdown are strictly pre-filtered to roles allowed under the node's current parent (`isRoleAllowedUnder(role, parentVendor.role)`). If the node has existing children that would be incompatible with a candidate role (Condition b, e.g. converting a Sub Vendor with children to a Deployment Associate), the option is present but selecting it triggers the inline `ROLE_CHANGE_CONFLICT` warning banner and blocks submission until the children are moved.

---

## Phase 5: Permissions & Delegation (F4, F5)

### A21: Delegation Visibility and Descendant Scope
Delegation creation is strictly restricted to direct and indirect descendants of the delegator (`getDescendantIds(currentUserId, childrenIndex)`). Vendors with no descendants in their subtree (such as leaf Deployment Associates) see a clean informational message indicating delegation is only available for vendors with team members in their subtree.

### A22: Acting on Behalf Multi-delegation Resolution
If a user receives active delegations from multiple delegators, the top navbar provides an "Acting on behalf of" control that allows selecting which delegator's perspective to assume or switching back to their own direct identity. While active, the top banner reminds the user of the active delegation and displays their allowed scope chips.

### A23: Permission Matrix Ancestor Walk for Blocking Tooltip
When a permission is directly granted to a vendor (`vendor.grantedPermissions.includes(perm)`) but blocked by an ancestor (`!effectivePermissions.includes(perm)`), the matrix uses `findPermissionBlocker(vendor.id, perm, vendorsById)` to identify the first ancestor up the hierarchy whose granted set lacks that permission, displaying `"Blocked by {ancestor.name}"` in a tooltip with a striped/grey visual indicator.

