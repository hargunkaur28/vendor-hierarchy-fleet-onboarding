import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { resetDb } from '@/api/client';
import { CompactTreeView } from './CompactTreeView';
import { HorizontalTreeView } from './HorizontalTreeView';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { TreeToolbar } from './TreeToolbar';
import { Header } from '@/components/layout/Header';

describe('Phase 8: Tree Views, Role Filter & Keyboard Shortcuts', () => {
  beforeEach(async () => {
    resetDb();
    await useAppStore.getState().initApp();
  });

  describe('CompactTreeView', () => {
    it('renders flattened hierarchy with role badges and handles expand/collapse', async () => {
      render(
        <MemoryRouter>
          <CompactTreeView />
        </MemoryRouter>,
      );

      // Verify root admin is rendered
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();

      // Find expand/collapse button for admin
      const collapseBtn = screen.getByRole('button', { name: /^collapse admin's \d+/i });
      expect(collapseBtn).toBeInTheDocument();

      // Click to collapse
      await act(async () => {
        fireEvent.click(collapseBtn);
      });
      expect(useAppStore.getState().expandedIds.has('admin')).toBe(false);

      // Click to re-expand
      const expandBtn = screen.getByRole('button', { name: /^expand admin's \d+/i });
      await act(async () => {
        fireEvent.click(expandBtn);
      });
      expect(useAppStore.getState().expandedIds.has('admin')).toBe(true);
    });

    it('selects vendor on row click', async () => {
      render(
        <MemoryRouter>
          <CompactTreeView />
        </MemoryRouter>,
      );

      const adminRow = document.getElementById('compact-node-admin');
      expect(adminRow).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(adminRow!);
      });

      expect(useAppStore.getState().selectedVendorId).toBe('admin');
    });
  });

  describe('HorizontalTreeView', () => {
    it('renders left-to-right hierarchy without any curved SVG connectors', () => {
      const { container } = render(
        <MemoryRouter>
          <HorizontalTreeView />
        </MemoryRouter>,
      );

      // Admin node is rendered
      expect(screen.getByText('admin')).toBeInTheDocument();

      // Confirm orthogonal connectors are used and NO bezier curve SVG paths exist
      const svgPaths = container.querySelectorAll('path');
      svgPaths.forEach((path) => {
        const d = path.getAttribute('d') || '';
        // Bezier curves use C, S, Q, or T in SVG path data
        expect(d).not.toMatch(/[CcSsQqTt]/);
      });
    });

    it('expands with ArrowRight and collapses with ArrowLeft strictly per spec', async () => {
      render(
        <MemoryRouter>
          <HorizontalTreeView />
        </MemoryRouter>,
      );

      const adminNode = document.getElementById('horiz-node-admin');
      expect(adminNode).toBeInTheDocument();

      // Initially expanded
      expect(useAppStore.getState().expandedIds.has('admin')).toBe(true);

      // ArrowLeft collapses
      fireEvent.keyDown(adminNode!, { key: 'ArrowLeft', code: 'ArrowLeft' });
      expect(useAppStore.getState().expandedIds.has('admin')).toBe(false);

      // ArrowRight expands
      fireEvent.keyDown(adminNode!, { key: 'ArrowRight', code: 'ArrowRight' });
      expect(useAppStore.getState().expandedIds.has('admin')).toBe(true);
    });
  });

  describe('TreeToolbar Role Filter', () => {
    it('allows filtering by role via the Role filter dropdown', async () => {
      render(
        <MemoryRouter>
          <TreeToolbar />
        </MemoryRouter>,
      );

      // Role filter button is present
      const roleFilterBtn = screen.getByRole('button', { name: /select roles/i });
      expect(roleFilterBtn).toBeInTheDocument();

      // Open dropdown
      await act(async () => {
        fireEvent.click(roleFilterBtn);
      });

      // Select 'Group Vendor'
      const groupVendorOption = screen.getByRole('option', { name: /group vendor/i });
      await act(async () => {
        fireEvent.click(groupVendorOption);
      });

      // Filter should be updated in store
      expect(useAppStore.getState().searchFilters.roles).toContain('GROUP_VENDOR');
    });
  });

  describe('KeyboardShortcutsModal', () => {
    it('renders shortcuts list and handles close', () => {
      let closed = false;
      render(
        <KeyboardShortcutsModal isOpen={true} onClose={() => { closed = true; }} />,
      );

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      expect(screen.getByText('Focus tree search filter')).toBeInTheDocument();
      expect(screen.getByText('Expand selected node')).toBeInTheDocument();
      expect(screen.getByText('Collapse selected node')).toBeInTheDocument();

      // Click got it button
      fireEvent.click(screen.getByRole('button', { name: /got it/i }));
      expect(closed).toBe(true);
    });
  });

  describe('Header Notification Bell', () => {
    it('renders live expiry badge count on the notification bell', () => {
      render(
        <MemoryRouter>
          <Header />
        </MemoryRouter>,
      );

      const bellBtn = screen.getByRole('button', { name: /notifications/i });
      expect(bellBtn).toBeInTheDocument();
      expect(bellBtn).toHaveAttribute('title', expect.stringMatching(/expiring documents/i));
    });
  });
});
