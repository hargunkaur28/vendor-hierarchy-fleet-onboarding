import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { resetDb } from '@/api/client';
import { HierarchyTree } from './HierarchyTree';
import { TreeToolbar } from './TreeToolbar';
import { RoleLegend } from './RoleLegend';
import { Header } from '@/components/layout/Header';

describe('Phase 3: Hierarchy Tree & App Shell Components', () => {
  beforeEach(async () => {
    resetDb();
    await useAppStore.getState().initApp();
  });

  describe('HierarchyTree Rendering & Expansion', () => {
    it('renders root admin node with name and email', () => {
      render(
        <MemoryRouter>
          <HierarchyTree />
        </MemoryRouter>,
      );

      const adminNode = screen.getByText('admin');
      expect(adminNode).toBeInTheDocument();
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });

    it('renders child count badges and toggles expansion on click', async () => {
      render(
        <MemoryRouter>
          <HierarchyTree />
        </MemoryRouter>,
      );

      // Find expand/collapse button for root admin specifically
      const badgeBtn = screen.getByRole('button', { name: /^collapse admin's \d+/i });
      expect(badgeBtn).toBeInTheDocument();

      // Initially root is expanded, clicking collapses
      await act(async () => {
        fireEvent.click(badgeBtn);
      });

      expect(useAppStore.getState().expandedIds.has('admin')).toBe(false);

      // Clicking again re-expands
      await act(async () => {
        fireEvent.click(badgeBtn);
      });

      expect(useAppStore.getState().expandedIds.has('admin')).toBe(true);
    });
  });

  describe('TreeToolbar & Search', () => {
    it('focuses search input when pressing "/" globally', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <TreeToolbar />
        </MemoryRouter>,
      );

      const searchInput = screen.getByPlaceholderText('Search by name, email or Phone No.');
      expect(document.activeElement).not.toBe(searchInput);

      await user.keyboard('/');
      expect(document.activeElement).toBe(searchInput);
    });

    it('clears search input when pressing Escape inside search input', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <TreeToolbar />
        </MemoryRouter>,
      );

      const searchInput = screen.getByPlaceholderText('Search by name, email or Phone No.');
      await user.type(searchInput, 'Regional');

      // Immediate input response (zero lag)
      expect(searchInput).toHaveValue('Regional');

      // Debounced search updates store
      await waitFor(() => {
        expect(useAppStore.getState().searchFilters.search).toBe('Regional');
      });

      await user.keyboard('{Escape}');
      expect(searchInput).toHaveValue('');
      expect(useAppStore.getState().searchFilters.search).toBe('');
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates tree with ArrowDown (to child) and ArrowUp (to parent)', async () => {
      render(
        <MemoryRouter>
          <HierarchyTree />
        </MemoryRouter>,
      );

      const adminNode = document.getElementById('node-admin');
      expect(adminNode).toBeInTheDocument();

      // Focus root node
      adminNode?.focus();
      expect(document.activeElement).toBe(adminNode);

      // Press ArrowDown to navigate to first child
      fireEvent.keyDown(adminNode!, { key: 'ArrowDown', code: 'ArrowDown' });

      const children = useAppStore.getState().childrenIndex['admin'] || [];
      const firstChildId = children[0]!;
      const firstChildEl = document.getElementById(`node-${firstChildId}`);

      expect(document.activeElement).toBe(firstChildEl);
      expect(useAppStore.getState().selectedVendorId).toBe(firstChildId);

      // Press ArrowUp on child to navigate back to parent
      fireEvent.keyDown(firstChildEl!, { key: 'ArrowUp', code: 'ArrowUp' });
      expect(document.activeElement).toBe(adminNode);
      expect(useAppStore.getState().selectedVendorId).toBe('admin');
    });

    it('collapses with ArrowLeft and expands with ArrowRight', async () => {
      render(
        <MemoryRouter>
          <HierarchyTree />
        </MemoryRouter>,
      );

      const adminNode = document.getElementById('node-admin');
      adminNode?.focus();

      // Initially expanded
      expect(useAppStore.getState().expandedIds.has('admin')).toBe(true);

      // Press ArrowLeft to collapse
      fireEvent.keyDown(adminNode!, { key: 'ArrowLeft', code: 'ArrowLeft' });
      expect(useAppStore.getState().expandedIds.has('admin')).toBe(false);

      // Press ArrowRight to expand
      fireEvent.keyDown(adminNode!, { key: 'ArrowRight', code: 'ArrowRight' });
      expect(useAppStore.getState().expandedIds.has('admin')).toBe(true);
    });

    it('sets DOM focus on the card div when clicked and allows arrow navigation', async () => {
      render(
        <MemoryRouter>
          <HierarchyTree />
        </MemoryRouter>,
      );

      const adminNode = document.getElementById('node-admin')!;
      expect(adminNode).toBeInTheDocument();

      // Ensure activeElement is initially not the admin node
      (document.activeElement as HTMLElement)?.blur?.();

      // Clicking the card must focus the card div itself
      fireEvent.mouseDown(adminNode);
      fireEvent.click(adminNode);

      expect(document.activeElement).toBe(adminNode);
      expect(useAppStore.getState().selectedVendorId).toBe('admin');

      // Now pressing ArrowDown directly on activeElement works without manual .focus()
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', code: 'ArrowDown' });

      const children = useAppStore.getState().childrenIndex['admin'] || [];
      const firstChildId = children[0]!;
      const firstChildEl = document.getElementById(`node-${firstChildId}`);

      expect(document.activeElement).toBe(firstChildEl);
      expect(useAppStore.getState().selectedVendorId).toBe(firstChildId);
    });

    it('navigates across siblings with ArrowRight and ArrowLeft', async () => {
      render(
        <MemoryRouter>
          <HierarchyTree />
        </MemoryRouter>,
      );

      const children = useAppStore.getState().childrenIndex['admin'] || [];
      expect(children.length).toBeGreaterThanOrEqual(2);

      const firstSiblingId = children[0]!;
      const secondSiblingId = children[1]!;

      const firstSiblingEl = document.getElementById(`node-${firstSiblingId}`)!;
      firstSiblingEl.focus();
      expect(document.activeElement).toBe(firstSiblingEl);

      // Ensure it is collapsed so ArrowRight moves to next sibling instead of collapsing
      if (useAppStore.getState().expandedIds.has(firstSiblingId)) {
        useAppStore.getState().toggleExpanded(firstSiblingId);
      }
      expect(useAppStore.getState().expandedIds.has(firstSiblingId)).toBe(false);

      // If it has children and collapsed: first ArrowRight expands it
      fireEvent.keyDown(firstSiblingEl, { key: 'ArrowRight', code: 'ArrowRight' });
      expect(useAppStore.getState().expandedIds.has(firstSiblingId)).toBe(true);

      // Next ArrowRight with siblings moves to next sibling
      fireEvent.keyDown(firstSiblingEl, { key: 'ArrowRight', code: 'ArrowRight' });
      const secondSiblingEl = document.getElementById(`node-${secondSiblingId}`);
      expect(document.activeElement).toBe(secondSiblingEl);
      expect(useAppStore.getState().selectedVendorId).toBe(secondSiblingId);

      // ArrowLeft moves back to previous sibling
      fireEvent.keyDown(secondSiblingEl!, { key: 'ArrowLeft', code: 'ArrowLeft' });
      expect(document.activeElement).toBe(firstSiblingEl);
      expect(useAppStore.getState().selectedVendorId).toBe(firstSiblingId);
    });

    it('selects vendor when pressing Enter or Space', async () => {
      render(
        <MemoryRouter>
          <HierarchyTree />
        </MemoryRouter>,
      );

      const children = useAppStore.getState().childrenIndex['admin'] || [];
      const targetChildId = children[0]!;
      const targetEl = document.getElementById(`node-${targetChildId}`)!;

      // Change store selection away from target
      await act(async () => {
        useAppStore.getState().setSelectedVendorId('admin');
      });

      targetEl.focus();
      await act(async () => {
        fireEvent.keyDown(targetEl, { key: 'Enter', code: 'Enter' });
      });

      expect(useAppStore.getState().selectedVendorId).toBe(targetChildId);
    });
  });

  describe('RoleLegend', () => {
    it('renders all 5 role labels with correct legend items', () => {
      render(<RoleLegend />);
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Site Admin')).toBeInTheDocument();
      expect(screen.getByText('Group Vendor')).toBeInTheDocument();
      expect(screen.getByText('Sub Vendor')).toBeInTheDocument();
      expect(screen.getByText('Deployment Associate')).toBeInTheDocument();
    });
  });

  describe('Header View-As Switcher (Section 4A.5)', () => {
    it('renders current user identity and switches perspective on selection', async () => {
      render(
        <MemoryRouter>
          <Header title="My Team" />
        </MemoryRouter>,
      );

      // Initially logged in as admin
      expect(useAppStore.getState().currentUserId).toBe('admin');

      // Open View As dropdown
      const switcherBtn = screen.getByRole('button', { name: /switch user perspective/i });
      fireEvent.click(switcherBtn);

      // Pick a site admin or sub vendor
      const vendors = Object.values(useAppStore.getState().vendorsById);
      const targetVendor = vendors.find((v) => v.role === 'SITE_ADMIN')!;
      expect(targetVendor).toBeDefined();

      const optionBtn = screen.getByRole('option', { name: new RegExp(targetVendor.name, 'i') });
      fireEvent.click(optionBtn);

      // Perspective should now be switched to targetVendor
      expect(useAppStore.getState().currentUserId).toBe(targetVendor.id);
    });
  });
});
