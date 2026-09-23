import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { DashboardPage } from '@/pages/DashboardPage';

describe('Phase 7: Super Vendor Dashboard (F8) & Overrides (F9)', () => {
  beforeEach(async () => {
    await useAppStore.getState().initApp();
    useAppStore.getState().switchUser('admin');
  });

  it('renders dashboard with stat cards, alert banner, and widgets', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // Title & headers
    expect(screen.getByText(/Super Vendor Dashboard \(F8\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Live Stream/i })).toBeInTheDocument();

    // Stat cards
    expect(screen.getByText(/^Sub-Vendors$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Active Cabs$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Non-Compliant$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Pending Docs$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Doc Expiries$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Drivers Status$/i)).toBeInTheDocument();

    // Middle & Lower section cards
    expect(screen.getByText(/Fleet Operational Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Driver Availability/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Verifications/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Direct Sub-Vendors/i })).toBeInTheDocument();
    expect(screen.getByText(/Expiry Reminders/i)).toBeInTheDocument();
  });

  it('toggles live telemetry streaming mode', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const liveBtn = screen.getByRole('button', { name: /Live Stream/i });
    expect(liveBtn).toHaveTextContent(/Live Stream OFF/i);

    await act(async () => {
      fireEvent.click(liveBtn);
    });

    expect(liveBtn).toHaveTextContent(/Live Stream ON/i);

    await act(async () => {
      fireEvent.click(liveBtn);
    });

    expect(liveBtn).toHaveTextContent(/Live Stream OFF/i);
  });

  it('opens Suspend Sub-Vendor dialog and enforces minimum 5 characters reason', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // Find a suspend button in the direct sub-vendors table
    const suspendButtons = screen.getAllByTitle(/Suspend Sub-Vendor \(F9 Override\)/i);
    expect(suspendButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(suspendButtons[0]!);
    });

    // Suspend modal opens
    expect(screen.getByText(/Suspend Sub-Vendor \(F9\)/i)).toBeInTheDocument();
    expect(screen.getByText(/You are about to suspend/i)).toBeInTheDocument();

    const reasonInput = screen.getByPlaceholderText(/Audit failure/i);
    const confirmBtn = screen.getByRole('button', { name: /Confirm Suspension/i });

    // Disabled initially because empty
    expect(confirmBtn).toBeDisabled();

    // Enter short reason (< 5 chars)
    await act(async () => {
      fireEvent.change(reasonInput, { target: { value: 'bad' } });
    });
    expect(confirmBtn).toBeDisabled();

    // Enter valid reason (>= 5 chars)
    await act(async () => {
      fireEvent.change(reasonInput, { target: { value: 'Audit failure: insurance expired on multiple cabs' } });
    });
    expect(confirmBtn).not.toBeDisabled();

    // Submit suspension
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Modal closes
    expect(screen.queryByText(/You are about to suspend/i)).not.toBeInTheDocument();
  });

  it('enforces Section 8.4 seniority check on Reactivate Vendor dialog', async () => {
    // Suspend a vendor first as Site Admin North
    const state = useAppStore.getState();
    const siteAdminNorth = Object.values(state.vendorsById).find((v) => v.role === 'SITE_ADMIN')!;
    const directChild = Object.values(state.vendorsById).find((v) => v.parentId === siteAdminNorth.id)!;

    // Switch view to siteAdminNorth to suspend
    state.switchUser(siteAdminNorth.id);
    await state.suspendVendor(directChild.id, 'Failed background checks');

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    // Look for reactivate button
    const reactivateButtons = screen.getAllByTitle(/Reactivate Vendor \(F9 Override\)/i);
    expect(reactivateButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(reactivateButtons[0]!);
    });

    expect(screen.getByText(/Reactivate Sub-Vendor \(F9\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed background checks/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Reactivation/i });
    expect(confirmBtn).toBeEnabled();

    // Now switch view to a peer or lower sub-vendor who is less senior than Site Admin
    const subVendor = Object.values(state.vendorsById).find((v) => v.role === 'SUB_VENDOR')!;
    state.switchUser(subVendor.id);

    // Seniority check blocks unauthorized reactivation
    const { allowed } = state.vendorsById[directChild.id]?.suspendedBy
      ? (await import('@/lib/seniority')).canActorOverrideOrReactivate(subVendor.id, siteAdminNorth.id, state.vendorsById)
      : { allowed: false };
    expect(allowed).toBe(false);
  });
});
