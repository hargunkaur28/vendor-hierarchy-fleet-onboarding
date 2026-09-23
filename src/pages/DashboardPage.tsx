import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Download,
  Activity,
  Plus,
  Car,
  UserCheck,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { computeDashboardStats } from '@/lib/dashboard';
import { StatCardsGrid } from '@/components/dashboard/StatCardsGrid';
import { ComplianceAlertBanner } from '@/components/dashboard/ComplianceAlertBanner';
import { FleetStatusDonut } from '@/components/dashboard/FleetStatusDonut';
import { SubVendorsTable } from '@/components/dashboard/SubVendorsTable';
import { PendingVerificationsWidget } from '@/components/dashboard/PendingVerificationsWidget';
import { DriverAvailabilityWidget } from '@/components/dashboard/DriverAvailabilityWidget';
import { ExpiryRemindersWidget } from '@/components/dashboard/ExpiryRemindersWidget';
import { VehicleFormDialog } from '@/components/fleet/VehicleFormDialog';
import { DriverFormDialog } from '@/components/drivers/DriverFormDialog';
import { authorize } from '@/lib/permissions';
import { toast } from 'sonner';

export const DashboardPage: React.FC = () => {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const childrenIndex = useAppStore((s) => s.childrenIndex);
  const vehiclesById = useAppStore((s) => s.vehiclesById);
  const driversById = useAppStore((s) => s.driversById);
  const delegationsById = useAppStore((s) => s.delegationsById);

  const currentUser = vendorsById[currentUserId];

  // Live simulation mode
  const [isLiveActive, setIsLiveActive] = useState(false);

  // Quick modals
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);

  // Permission checks
  const delegationsList = Object.values(delegationsById);
  const canOnboardFleet = authorize(
    { actorId: currentUserId, permission: 'ONBOARD_FLEET', targetVendorId: currentUserId },
    vendorsById,
    delegationsList,
  ).allowed;
  const canOnboardDrivers = authorize(
    { actorId: currentUserId, permission: 'ONBOARD_DRIVERS', targetVendorId: currentUserId },
    vendorsById,
    delegationsList,
  ).allowed;

  // Single aggregation pass O(V + D + Veh)
  const dashboardStats = useMemo(() => {
    return computeDashboardStats(
      currentUserId,
      vendorsById,
      childrenIndex,
      vehiclesById,
      driversById,
    );
  }, [currentUserId, vendorsById, childrenIndex, vehiclesById, driversById]);

  // Live simulation: flips a random driver availability every 5 seconds
  useEffect(() => {
    if (!isLiveActive) return;

    const interval = setInterval(() => {
      const drivers = Object.values(driversById);
      if (drivers.length === 0) return;

      const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
      if (!randomDriver) return;

      const nextStatus = randomDriver.availability === 'AVAILABLE' ? 'ON_TRIP' : 'AVAILABLE';
      useAppStore.setState((state) => {
        if (state.driversById[randomDriver.id]) {
          state.driversById[randomDriver.id]!.availability = nextStatus;
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isLiveActive, driversById]);

  // Export CSV Compliance Report
  const handleExportCsv = () => {
    const headers = [
      'Sub-Vendor Name',
      'Role',
      'Status',
      'Total Cabs',
      'Active Cabs',
      'Inactive Cabs',
      'Non-Compliant Cabs',
      'Available Drivers',
      'Pending Docs',
      'Compliance Rate (%)',
      'Risk Assessment',
    ];

    const rows = dashboardStats.directSubVendors.map((row) => [
      `"${row.vendor.name.replace(/"/g, '""')}"`,
      row.vendor.role,
      row.vendor.status,
      row.totalVehicles,
      row.activeVehicles,
      row.inactiveVehicles,
      row.nonCompliantVehicles,
      row.availableDrivers,
      row.pendingDocsCount,
      `${row.complianceRate}%`,
      row.riskLevel,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `compliance_report_${currentUser?.name.replace(/\s+/g, '_') ?? 'vendor'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Compliance report exported successfully.');
  };

  return (
    <div className="space-y-5 min-w-0">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-600" />
            <span>Super Vendor Dashboard (F8)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {currentUser?.name ?? 'Admin'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational fleet telemetry, compliance metrics, and subtree oversight.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Live Simulation Toggle (Spec Section 14 P2) */}
          <button
            type="button"
            onClick={() => {
              const next = !isLiveActive;
              setIsLiveActive(next);
              if (next) toast.info('Live fleet telemetry simulation started (updates every 5s).');
              else toast.info('Live simulation stopped.');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              isLiveActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-400/30'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle simulated driver telemetry updates"
          >
            <Activity className={`w-3.5 h-3.5 ${isLiveActive ? 'animate-pulse text-emerald-600' : 'text-slate-400'}`} />
            <span>Live Stream {isLiveActive ? 'ON' : 'OFF'}</span>
          </button>

          {/* Export CSV Report */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            title="Export CSV Compliance Report"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Report</span>
          </button>

          {/* Quick Onboard Actions */}
          <button
            type="button"
            onClick={() => {
              if (!canOnboardFleet) {
                toast.error("Requires ONBOARD_FLEET permission.");
                return;
              }
              setIsAddVehicleOpen(true);
            }}
            disabled={!canOnboardFleet}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors select-none ${
              canOnboardFleet
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-2xs'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <Car className="w-3.5 h-3.5" />
            <span>Add Vehicle</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canOnboardDrivers) {
                toast.error("Requires ONBOARD_DRIVERS permission.");
                return;
              }
              setIsAddDriverOpen(true);
            }}
            disabled={!canOnboardDrivers}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors select-none ${
              canOnboardDrivers
                ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <UserCheck className="w-3.5 h-3.5" />
            <span>Add Driver</span>
          </button>
        </div>
      </div>

      {/* Two-State Compliance Alert Banner */}
      <ComplianceAlertBanner stats={dashboardStats} />

      {/* Elevated Stat Cards Grid (Section 4A.6) */}
      <StatCardsGrid stats={dashboardStats} />

      {/* Middle Row: Donut Chart + Driver Availability + Pending Verifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Fleet Status Donut */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 tracking-tight">
              Fleet Operational Status
            </h4>
            <span className="text-[11px] font-semibold text-emerald-600">
              {dashboardStats.overallComplianceRate}% Compliant
            </span>
          </div>
          <FleetStatusDonut distribution={dashboardStats.fleetStatusDistribution} />
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
            Derived live on every evaluation (Section 14 F7)
          </div>
        </div>

        {/* Driver Availability Widget */}
        <DriverAvailabilityWidget
          available={dashboardStats.driversAvailable}
          onTrip={dashboardStats.driversOnTrip}
          offDuty={dashboardStats.driversOffDuty}
          total={dashboardStats.driversTotal}
        />

        {/* Pending Verifications Widget */}
        <PendingVerificationsWidget
          items={dashboardStats.pendingVerifications}
          totalPendingCount={dashboardStats.pendingVerificationsCount}
        />
      </div>

      {/* Lower Row: Direct Sub-Vendors Table + Expiry Reminders Widget */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3.5 min-w-0">
        <div className="xl:col-span-2 min-w-0">
          <SubVendorsTable subVendors={dashboardStats.directSubVendors} />
        </div>

        <div className="min-w-0">
          <ExpiryRemindersWidget
            reminders={dashboardStats.expiryReminders}
            expiredCount={dashboardStats.expiredDocsCount}
            expiringSoonCount={dashboardStats.expiringSoonDocsCount}
          />
        </div>
      </div>

      {/* Add Vehicle Dialog */}
      {isAddVehicleOpen && (
        <VehicleFormDialog
          isOpen={isAddVehicleOpen}
          onClose={() => setIsAddVehicleOpen(false)}
        />
      )}

      {/* Add Driver Dialog */}
      {isAddDriverOpen && (
        <DriverFormDialog
          isOpen={isAddDriverOpen}
          onClose={() => setIsAddDriverOpen(false)}
        />
      )}
    </div>
  );
};
