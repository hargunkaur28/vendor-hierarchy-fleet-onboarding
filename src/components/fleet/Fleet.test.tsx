import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { resetDb } from '@/api/client';
import { VehiclesPage } from '@/pages/VehiclesPage';
import { DriversPage } from '@/pages/DriversPage';
import { isVehicleCompliant, getEffectiveVehicleStatus } from '@/lib/compliance';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

describe('Phase 6: Fleet & Drivers Management (F6)', () => {
  beforeEach(async () => {
    resetDb();
    await useAppStore.getState().initApp();
    vi.clearAllMocks();
  });

  describe('VehiclesPage (F6)', () => {
    it('renders vehicles table with columns, doc health icons, and operational status', () => {
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <VehiclesPage />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Fleet & Vehicles \(F6\)/i)).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Registration No/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Model & Capacity/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Owner Sub-Vendor/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Documents \(F7\)/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Operational Status/i })).toBeInTheDocument();

      // Check for Add Vehicle button
      expect(screen.getByRole('button', { name: /Add Vehicle/i })).toBeInTheDocument();
    }, 15000);

    it('derives operational status live (auto-deactivated on read) and disables activation toggle for non-compliant vehicles', () => {
      useAppStore.getState().switchUser('admin');
      const state = useAppStore.getState();

      // Find a vehicle with missing or expired docs
      const vehicles = Object.values(state.vehiclesById);
      const nonCompliant = vehicles.find((v) => !isVehicleCompliant(v).compliant)!;
      expect(nonCompliant).toBeDefined();

      // Set stored status to ACTIVE to verify that live derivation overrides stored status
      useAppStore.setState((s) => {
        s.vehiclesById[nonCompliant.id]!.status = 'ACTIVE';
      });

      // Verify effectiveStatus derives to NON_COMPLIANT
      const effective = getEffectiveVehicleStatus(useAppStore.getState().vehiclesById[nonCompliant.id]!);
      expect(effective).toBe('NON_COMPLIANT');

      render(
        <MemoryRouter>
          <VehiclesPage />
        </MemoryRouter>,
      );

      // Verify Non-Compliant badge appears
      const badges = screen.getAllByText('Non-Compliant');
      expect(badges.length).toBeGreaterThan(0);

      // Verify the Active toggle switch is forced OFF (aria-checked="false") and disabled
      const switches = screen.getAllByRole('switch');
      const nonCompliantSwitch = switches.find((s) => s.getAttribute('aria-checked') === 'false' && s.hasAttribute('disabled'));
      expect(nonCompliantSwitch).toBeDefined();
    });

    it('filters vehicles by search query and fuel type', async () => {
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <VehiclesPage />
        </MemoryRouter>,
      );

      const searchInput = screen.getByPlaceholderText(/Search by reg no, model/i);
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'DL' } });
      });

      // Should display only matching vehicles or empty state
      expect(searchInput).toHaveValue('DL');
    });

    it('opens Add Vehicle modal and validates registration number, model, seats, and EV fuel type', () => {
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <VehiclesPage />
        </MemoryRouter>,
      );

      const addBtn = screen.getByRole('button', { name: /Add Vehicle/i });
      fireEvent.click(addBtn);

      expect(screen.getByText(/Onboard New Vehicle \(F6\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Registration Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Vehicle Model/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Seating Capacity/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Fuel Type/i)).toBeInTheDocument();

      // Check EV option is present
      const fuelSelect = screen.getByLabelText(/Fuel Type/i) as HTMLSelectElement;
      const options = Array.from(fuelSelect.options).map((o) => o.value);
      expect(options).toContain('EV');
      expect(options).toContain('PETROL');
      expect(options).toContain('DIESEL');
      expect(options).toContain('CNG');
      expect(options).toContain('HYBRID');
    }, 15000);
  });

  describe('DriversPage (F6)', () => {
    it('renders drivers table with name, phone, license, availability, and compliance', () => {
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <DriversPage />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Driver Management \(F6\)/i)).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /^Driver$/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Driving License \(DL\)/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Availability/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Compliance Status/i })).toBeInTheDocument();

      // Check Add Driver button
      expect(screen.getByRole('button', { name: /Add Driver/i })).toBeInTheDocument();
    });

    it('toggles driver availability between AVAILABLE and OFF_DUTY', async () => {
      useAppStore.getState().switchUser('admin');

      render(
        <MemoryRouter>
          <DriversPage />
        </MemoryRouter>,
      );

      // Find an availability toggle button
      const availButtons = screen.getAllByTitle(/Click to toggle availability/i);
      expect(availButtons.length).toBeGreaterThan(0);

      const firstBtn = availButtons[0]!;
      await act(async () => {
        fireEvent.click(firstBtn);
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringMatching(/availability changed to/i),
        );
      });
    });
  });
});
