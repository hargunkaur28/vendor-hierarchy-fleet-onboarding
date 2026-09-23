import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { AuditPage } from '@/pages/AuditPage';

describe('Phase 7: Audit Log (F10)', () => {
  beforeEach(async () => {
    await useAppStore.getState().initApp();
    useAppStore.getState().switchUser('admin');
  });

  it('renders audit page with table headers, filters, and refresh button', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <AuditPage />
        </MemoryRouter>,
      );
    });

    expect(screen.getByText(/Audit Trail \(F10\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search audit trail by actor/i)).toBeInTheDocument();

    // Table column headers
    expect(screen.getByRole('columnheader', { name: /Timestamp/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Actor/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Action/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Target/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Details/i })).toBeInTheDocument();
  });

  it('filters audit entries by action type', async () => {
    // Generate an audit event first
    const state = useAppStore.getState();
    const siteAdminNorth = Object.values(state.vendorsById).find((v) => v.role === 'SITE_ADMIN')!;
    const directChild = Object.values(state.vendorsById).find((v) => v.parentId === siteAdminNorth.id)!;
    await state.suspendVendor(directChild.id, 'Test suspension audit filter');

    await act(async () => {
      render(
        <MemoryRouter>
          <AuditPage />
        </MemoryRouter>,
      );
    });

    const actionSelect = screen.getByLabelText(/Action:/i);
    await act(async () => {
      fireEvent.change(actionSelect, { target: { value: 'SUSPEND_VENDOR' } });
    });

    expect(screen.getAllByText(/SUSPEND VENDOR/i).length).toBeGreaterThan(0);
  });

  it('displays delegation attribution badge when entry was executed under delegation', async () => {
    const { loadDb, saveDb, recordAudit } = await import('@/api/client');
    const db = loadDb();
    const siteAdmin = Object.values(db.vendors).find((v) => v.role === 'SITE_ADMIN');

    recordAudit(db, {
      actorId: 'admin',
      onBehalfOfId: siteAdmin?.id,
      action: 'ONBOARD_FLEET',
      targetType: 'VEHICLE',
      targetId: 'KA01ZZ9999',
      details: { model: 'Swift Dzire' },
    });
    saveDb(db);

    await act(async () => {
      render(
        <MemoryRouter>
          <AuditPage />
        </MemoryRouter>,
      );
    });

    expect(screen.getByText(/acting for/i)).toBeInTheDocument();
  });
});
