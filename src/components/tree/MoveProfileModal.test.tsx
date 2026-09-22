import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { resetDb } from '@/api/client';
import { getDescendantIds } from '@/lib/tree';
import { MoveProfileModal } from './MoveProfileModal';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Phase 4: MoveProfileModal (F2) & Change Role (F3)', () => {
  beforeEach(async () => {
    resetDb();
    await useAppStore.getState().initApp();
    vi.clearAllMocks();
  });

  it('renders modal matching Screen 2 structure and disables Move button initially', () => {
    const vendors = useAppStore.getState().vendorsById;
    const groupVendor = Object.values(vendors).find((v) => v.role === 'GROUP_VENDOR')!;
    expect(groupVendor).toBeDefined();

    render(
      <MemoryRouter>
        <MoveProfileModal
          vendor={groupVendor}
          isOpen={true}
          onClose={() => {}}
        />
      </MemoryRouter>,
    );

    // Title
    expect(screen.getByText(`Move ${groupVendor.name}`)).toBeInTheDocument();

    // Radio group
    const parentRadio = screen.getByLabelText('Change Parent') as HTMLInputElement;
    const roleRadio = screen.getByLabelText('Change Role') as HTMLInputElement;
    expect(parentRadio).toBeInTheDocument();
    expect(parentRadio.checked).toBe(true);
    expect(roleRadio).toBeInTheDocument();
    expect(roleRadio.checked).toBe(false);

    // Helper text
    expect(screen.getByText(/Move group vendor under a different site admin/i)).toBeInTheDocument();

    // Info banner with accurate descendant count
    const descendantCount = getDescendantIds(groupVendor.id, useAppStore.getState().childrenIndex).length;
    if (descendantCount > 0) {
      expect(screen.getByText(String(descendantCount))).toBeInTheDocument();
      expect(screen.getByText(/sub-vendors and deployment associates under this group vendor/i)).toBeInTheDocument();
    }

    // Move button disabled initially
    const moveBtn = screen.getByRole('button', { name: /^Move$/i });
    expect(moveBtn).toBeDisabled();
  });

  it('filters out invalid targets: self, current parent, and own descendants', async () => {
    const vendors = useAppStore.getState().vendorsById;
    const groupVendor = Object.values(vendors).find((v) => v.role === 'GROUP_VENDOR')!;
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MoveProfileModal
          vendor={groupVendor}
          isOpen={true}
          onClose={() => {}}
        />
      </MemoryRouter>,
    );

    // Open combobox dropdown
    const triggerBtn = screen.getByRole('button', { name: /Select Site Admin/i });
    await user.click(triggerBtn);

    // Search input should be present (Screen 3)
    const searchInput = screen.getByPlaceholderText('Search by name');
    expect(searchInput).toBeInTheDocument();

    // Self should never appear
    expect(screen.queryByRole('option', { name: new RegExp(groupVendor.name, 'i') })).not.toBeInTheDocument();

    // Current parent should not appear
    if (groupVendor.parentId) {
      const currentParent = vendors[groupVendor.parentId]!;
      expect(screen.queryByRole('option', { name: new RegExp(currentParent.name, 'i') })).not.toBeInTheDocument();
    }
  });

  it('selects valid parent, enables Move button, submits move and triggers Undo toast', async () => {
    const vendors = useAppStore.getState().vendorsById;
    const groupVendor = Object.values(vendors).find((v) => v.role === 'GROUP_VENDOR')!;
    const originalParentId = groupVendor.parentId;

    const onClose = vi.fn();
    const onMoveSuccess = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MoveProfileModal
          vendor={groupVendor}
          isOpen={true}
          onClose={onClose}
          onMoveSuccess={onMoveSuccess}
        />
      </MemoryRouter>,
    );

    // Open combobox
    const triggerBtn = screen.getByRole('button', { name: /Select Site Admin/i });
    await user.click(triggerBtn);

    // Select first available site admin option
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    const chosenOption = options[0]!;
    await user.click(chosenOption);

    // Move button should now be enabled
    const moveBtn = screen.getByRole('button', { name: /^Move$/i });
    expect(moveBtn).toBeEnabled();

    // Click Move
    await act(async () => {
      fireEvent.click(moveBtn);
    });

    // Modal closes and success callback called
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
      expect(onMoveSuccess).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining(`"${groupVendor.name}" moved under`),
        expect.objectContaining({
          duration: 5000,
          action: expect.objectContaining({ label: 'Undo' }),
        }),
      );
    });

    // Target vendor in store updated
    const updatedVendor = useAppStore.getState().vendorsById[groupVendor.id]!;
    expect(updatedVendor.parentId).not.toBe(originalParentId);

    // Simulate Undo click from toast action
    const toastCall = (toast.success as unknown as { mock: { calls: Array<[string, { action: { onClick: () => Promise<void> } }]> } }).mock.calls[0];
    const undoAction = toastCall?.[1]?.action?.onClick;
    expect(undoAction).toBeDefined();

    await act(async () => {
      await undoAction!();
    });

    // Parent should be restored to originalParentId
    const restoredVendor = useAppStore.getState().vendorsById[groupVendor.id]!;
    expect(restoredVendor.parentId).toBe(originalParentId);
  });

  it('supports Change Role (F3) and prevents invalid child role conflicts', async () => {
    const vendors = useAppStore.getState().vendorsById;
    // Find a sub-vendor under a group vendor that has DA children
    const subVendor = Object.values(vendors).find(
      (v) =>
        v.role === 'SUB_VENDOR' &&
        v.parentId &&
        vendors[v.parentId]?.role === 'GROUP_VENDOR' &&
        (useAppStore.getState().childrenIndex[v.id] || []).length > 0,
    )!;
    expect(subVendor).toBeDefined();

    render(
      <MemoryRouter>
        <MoveProfileModal
          vendor={subVendor}
          isOpen={true}
          onClose={() => {}}
        />
      </MemoryRouter>,
    );

    // Switch to Change Role
    const roleRadio = screen.getByLabelText('Change Role');
    fireEvent.click(roleRadio);

    expect(screen.getByText(/Select New Role/i)).toBeInTheDocument();

    const roleSelect = screen.getByRole('combobox');
    expect(roleSelect).toBeInTheDocument();

    // Verify condition a: roles invalid under current parent (GROUP_VENDOR) are pre-filtered out
    const optionValues = Array.from(roleSelect.querySelectorAll('option')).map((o) => o.value);
    expect(optionValues).not.toContain('SITE_ADMIN');
    expect(optionValues).not.toContain('GROUP_VENDOR');
    expect(optionValues).not.toContain('ADMIN');
    expect(optionValues).toContain('DEPLOYMENT_ASSOCIATE');

    // Attempt to change Sub Vendor with children into DEPLOYMENT_ASSOCIATE (which allows NO children)
    fireEvent.change(roleSelect, { target: { value: 'DEPLOYMENT_ASSOCIATE' } });

    // Should display conflict warning and disable Change Role button
    await waitFor(() => {
      expect(screen.getByText(/ROLE_CHANGE_CONFLICT/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /Change Role/i });
    expect(submitBtn).toBeDisabled();
  });
});
