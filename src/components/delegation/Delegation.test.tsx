import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { resetDb } from '@/api/client';
import { PermissionMatrix } from './PermissionMatrix';
import { DelegationTable } from './DelegationTable';
import { DelegateDialog } from './DelegateDialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

describe('Phase 5: Permissions & Delegation (F4, F5)', () => {
  beforeEach(async () => {
    resetDb();
    await useAppStore.getState().initApp();
    vi.clearAllMocks();
  });

  describe('PermissionMatrix (F4)', () => {
    it('renders direct sub-vendors and 6 permission toggle switches', () => {
      // Set current user as admin or group vendor
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <PermissionMatrix />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Permission Grant Matrix/i)).toBeInTheDocument();
      expect(screen.getAllByText('Manage Team').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Onboard Fleet').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Onboard Drivers').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Verify Documents').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Manage Bookings').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Manage Payments').length).toBeGreaterThan(0);
      expect(screen.getByText('Effective Permissions')).toBeInTheDocument();

      // Should render rows for site-admin sub-vendors under admin
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(0);
    });

    it('toggles permission grant and updates store optimistically with toast', async () => {
      // View as Demo Group Vendor (gv-demo-group-vendor)
      useAppStore.getState().switchUser('gv-demo-group-vendor');

      render(
        <MemoryRouter>
          <PermissionMatrix />
        </MemoryRouter>,
      );

      // Find first switch for Demo Sub Vendor 1
      const switches = screen.getAllByRole('switch');
      const firstSwitch = switches[0]!;
      const wasChecked = firstSwitch.getAttribute('aria-checked') === 'true';

      await act(async () => {
        fireEvent.click(firstSwitch);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/(Granted|Revoked)/),
        );
        expect(firstSwitch.getAttribute('aria-checked')).toBe(String(!wasChecked));
      });
    });

    it('displays inherited-blocked badge when permission is granted but blocked by ancestor', () => {
      // Find or setup a sub-vendor with a permission not held by its parent
      const state = useAppStore.getState();
      const sv = state.vendorsById['sv-demo-sub-vendor-1']!;
      const parent = state.vendorsById[sv.parentId!]!;

      // Parent (Group Vendor) lacks MANAGE_PAYMENTS
      expect(parent.grantedPermissions).not.toContain('MANAGE_PAYMENTS');

      // Grant MANAGE_PAYMENTS directly to Sub Vendor
      useAppStore.setState((s) => {
        s.vendorsById['sv-demo-sub-vendor-1']!.grantedPermissions.push('MANAGE_PAYMENTS');
      });

      // View as Group Vendor
      useAppStore.getState().switchUser('gv-demo-group-vendor');

      render(
        <MemoryRouter>
          <PermissionMatrix />
        </MemoryRouter>,
      );

      // Should display "Blocked" indicator on the blocked cell
      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });
  });

  describe('DelegateDialog (F5)', () => {
    it('populates descendants in subtree and allows selecting scope', async () => {
      useAppStore.getState().switchUser('gv-demo-group-vendor');
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <DelegateDialog isOpen={true} onClose={() => {}} />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Delegate Authority/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();

      // Click "Delegate everything" shortcut
      const delegateEverythingBtn = screen.getByText(/Delegate everything/i);
      await user.click(delegateEverythingBtn);

      // Select a delegate
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'sv-demo-sub-vendor-1' } });

      // Warning banner should display
      await waitFor(() => {
        expect(screen.getByText(/will be able to perform these actions in your name/i)).toBeInTheDocument();
      });

      // Confirm Delegation button should be enabled
      const confirmBtn = screen.getByRole('button', { name: /Confirm Delegation/i });
      expect(confirmBtn).toBeEnabled();

      // Submit delegation
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining('Successfully delegated'),
        );
      });
    });
  });

  describe('DelegationTable & Acting on Behalf (F5)', () => {
    it('renders delegations created by current user and allows toggling status', async () => {
      useAppStore.getState().switchUser('gv-demo-group-vendor');

      render(
        <MemoryRouter>
          <DelegationTable onOpenCreate={() => {}} />
        </MemoryRouter>,
      );

      // Seed del-1 is created by gv-demo-group-vendor
      expect(screen.getByText('Delegated Authority Roster')).toBeInTheDocument();
      const statusSwitches = screen.getAllByRole('switch');
      expect(statusSwitches.length).toBeGreaterThan(0);

      // Toggle status switch
      await act(async () => {
        fireEvent.click(statusSwitches[0]!);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/Delegation for .* (enabled|disabled)/),
        );
      });
    });

    it('enables acting on behalf and displays top banner in AppLayout', async () => {
      // View as Demo Sub Vendor 1 (who has active delegation del-1 from Demo Group Vendor)
      useAppStore.getState().switchUser('sv-demo-sub-vendor-1');

      render(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>,
      );

      // Should see "Act for Demo Group Vendor" button in header or table
      const actForBtn = screen.getByRole('button', { name: /Act for Demo Group Vendor/i });
      expect(actForBtn).toBeInTheDocument();

      // Click to act on behalf
      await act(async () => {
        fireEvent.click(actForBtn);
      });

      // Banner should appear
      await waitFor(() => {
        expect(screen.getByText(/You are acting on behalf of/i)).toBeInTheDocument();
        expect(screen.getByText('Demo Group Vendor')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Exit Acting Mode/i })).toBeInTheDocument();
      });

      // Exit acting mode
      const exitBtn = screen.getByRole('button', { name: /Exit Acting Mode/i });
      await act(async () => {
        fireEvent.click(exitBtn);
      });

      await waitFor(() => {
        expect(screen.queryByText(/You are acting on behalf of/i)).not.toBeInTheDocument();
      });
    });
  });
});
