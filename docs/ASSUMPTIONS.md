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

