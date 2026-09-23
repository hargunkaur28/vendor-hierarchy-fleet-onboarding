# Vendor Management System: 3–4 Minute Demo Script

This script provides an exact step-by-step walkthrough to demonstrate all core capabilities, security controls, algorithmic guarantees, and UX refinements of the platform.

---

## Pre-flight Checklist
1. Ensure the app is running locally at `http://localhost:5173`.
2. Open the **Developer Panel** (top-right sliders icon ⚙️) and click **"Reset to Golden Seed"** to ensure clean initial data.
3. Keep DevTools console open if you want to inspect instant search timings or network calls.

---

## Step 1: Admin Perspective & Executive Dashboard (0:00 – 0:30)
1. **Navigate to `/dashboard`**:
   - Notice the high-level KPI cards with colored accent borders: **Total Sub-Vendors**, **Fleet Vehicles**, **Driver Availability Rate**, and **Document Verification Backlog**.
   - Review the **Fleet Operational Status** donut chart showing clean segment rendering.
   - Point out the **Live Telemetry Mode** toggle switch: flipping it turns on real-time simulated telemetry updates with an active green pulse.
2. **Review Direct Sub-Vendors Table**:
   - Inspect the sub-vendors breakdown with risk-level badges (`Low Risk`, `Medium Risk`, `High Risk`).
   - Notice the horizontal scroll containment that prevents table overflow on small displays.

---

## Step 2: Organization Hierarchy Tree & Multi-View Explorer (0:30 – 1:15)
1. **Navigate to `/team`**:
   - Show the **Vertical Tree** with crisp, right-angle connector lines and child count badges.
   - Press `/` on your keyboard: notice the search input is automatically focused with high-visibility outline.
   - Type `"Airport"` or select the **Airport** tag filter: watch matching nodes auto-expand while irrelevant nodes collapse, with ancestors preserved for context.
   - Open the **Select Roles** dropdown and check **Group Vendor**: observe instant filtering by role.
2. **Toggle View Modes**:
   - Click **"Horizontal"** in the toolbar: view the left-to-right org chart with strictly orthogonal connector lines (no curved bezier SVG paths).
   - Click **"Compact"**: notice the virtualized indented list rendering depth guidelines, role chips, and inline action buttons.
3. **Keyboard Shortcuts**:
   - Press `?` anywhere outside an input field to trigger the **Keyboard Shortcuts** modal.
   - Point out navigation keys (`ArrowDown`/`ArrowUp`), strict expansion (`ArrowRight`) and collapse (`ArrowLeft`), selection (`Enter`/`Space`), and actions (`m` move, `e` edit).

---

## Step 3: Move Profile, Cycle Prevention & Undo (1:15 – 1:50)
1. **Open Move Profile**:
   - On the hierarchy tree, click **"Move Profile"** on **"GV North Mobility"** (`gv-north-mobility`).
   - Point out the dynamic warning banner: *"Moving this Group Vendor will also move its 2 direct reports and 3 total subtree members."*
2. **Cycle Prevention in Combobox**:
   - Open the **"Select New Parent Vendor"** searchable dropdown.
   - Notice that `"GV North Mobility"` (itself), its existing parent, and its descendants (`sub-delhi-cabs`) are **strictly excluded** from selectable options, preventing cycle formation.
3. **Optimistic Move & Undo**:
   - Select `"SA Site Admin"` and click **"Move Profile"**.
   - Notice the hierarchy tree updates instantly (optimistic UI), accompanied by a success toast with an **"Undo"** action.
   - Click **"Undo"**: observe the tree seamlessly revert back to its exact prior parent.

---

## Step 4: Error Handling & Diagnostics Simulation (1:50 – 2:20)
1. **Open the Developer Diagnostics Panel** (top-right sliders icon):
   - Notice the dataset counters (Vendors, Vehicles, Drivers) and the **Mock API Latency Slider** (0–1500 ms).
2. **Trigger Force Invalid Move**:
   - Click **"Force Invalid Move (Demo Step 3)"**:
   - The app deliberately attempts to move the root administrator under a child node.
   - Observe the immediate error feedback: the API rejects the move with a `CYCLE_DETECTED` violation, and the UI displays a clear, actionable error toast without corrupting state.
3. **Load 5,000 Vendors (Stress Test)**:
   - Click **"Load 5,000 Vendors"**:
   - Observe 5,000 nodes generated and loaded in $<100$ ms.
   - Test search and expand/collapse in the Compact view: explain the $<10$ ms cached search key execution.
   - Click **"Reset to Golden Seed"**, confirm the dialog, and return to standard demo data.

---

## Step 5: Permission Matrix & "View As" Perspective (2:20 – 2:55)
1. **Navigate to `/delegation`**:
   - View the **Permission Matrix (F4)** listing direct sub-vendors with 6 capability toggles:
     - `VIEW_FINANCIALS`, `MANAGE_PAYMENTS`, `ONBOARD_DRIVERS`, `EDIT_VEHICLE_SPECS`, `APPROVE_DOCUMENTS`, `MANAGE_BOOKINGS`.
   - Toggle OFF `MANAGE_PAYMENTS` for **"Delhi Cabs"** (`sub-delhi-cabs`).
2. **Switch Perspective ("View As")**:
   - In the top header, click the **"View as"** switcher dropdown and select **"Delhi Cabs (Sub Vendor)"**.
   - Notice the header updates to reflect the Delhi Cabs perspective.
   - Hover over `MANAGE_PAYMENTS`: notice the toggle is disabled with a clear tooltip: *"Blocked by GV North Mobility"*.

---

## Step 6: Delegation & Acting on Behalf (2:55 – 3:30)
1. **Create Scoped Delegation (F5)**:
   - While viewing as a senior vendor, click **"Delegate Access"**.
   - Select a direct or indirect descendant vendor as delegate and select a restricted scope (e.g. `APPROVE_DOCUMENTS`).
   - Click **"Grant Delegation"**.
2. **Assume Delegated Perspective**:
   - Switch identity to the delegate.
   - Click **"Act for Delegator"** in the top navbar.
   - Notice the prominent blue top banner: *"You are acting on behalf of [Delegator]. Permitted actions are restricted to your delegated scope: Document Approvals."*
   - Verify that actions performed are stamped with delegation attribution in the audit logs.

---

## Step 7: Fleet Compliance, Document Expiries & Audit (3:30 – 4:00)
1. **Navigate to `/vehicles`**:
   - Point out the **Operational Status Badges** (`OPERATIONAL`, `NON_COMPLIANT`, `BLOCKED`).
   - Find a vehicle marked **Non-Compliant**: observe that its Active toggle is clamped **OFF and disabled**, with hover tooltips detailing the exact missing or expired document.
2. **Inspect Expiry Reminders Tab on `/documents`**:
   - Click the header **Notification Bell** with its live red badge: watch it deep-link straight to `/documents?tab=expiries`.
   - Point out the urgency countdown cards: **Expired**, **$\le 7$ Days**, **8–15 Days**, and **16–30 Days**.
   - Click **"Upload Renewal"** to demonstrate instant document renewal workflow.
3. **Verify Audit Trail (`/audit`)**:
   - Navigate to `/audit` to inspect immutable audit events.
   - Point out the exact audit records from the Move Profile, Role Change, and Delegated operations with timestamps and actor attribution.

---

## Summary
The demo illustrates a production-grade, enterprise-ready system:
- **Resilient**: Algorithmic cycle prevention, atomic reparenting, and optimistic updates with rollback.
- **Performant**: 5,000-vendor virtualized stress mode with sub-10ms search lookups.
- **Secure**: Strict 5-tier role validation, ancestor permission intersection, and seniority-enforced administrative overrides.
- **Accessible**: Full keyboard navigation, ARIA attributes, and reduced-motion compliance.
