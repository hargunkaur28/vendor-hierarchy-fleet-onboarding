import React from 'react';
import {
  Users,
  Car,
  AlertTriangle,
  FileCheck2,
  FileWarning,
  UserCheck,
} from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard';

interface StatCardsGridProps {
  stats: DashboardStats;
}

export const StatCardsGrid: React.FC<StatCardsGridProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {/* 1. Sub-Vendors */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
        <div className="h-1 bg-indigo-600 w-full" />
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Sub-Vendors
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.totalSubVendors}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Direct reporting vendors</p>
          </div>
        </div>
      </div>

      {/* 2. Active Fleet */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
        <div className="h-1 bg-emerald-600 w-full" />
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Cabs
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span>{stats.activeVehicles}</span>
              <span className="text-xs font-medium text-slate-400">/ {stats.totalVehicles} total</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {stats.inactiveVehicles} inactive
            </p>
          </div>
        </div>
      </div>

      {/* 3. Non-Compliant & Blocked Vehicles */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
        <div className="h-1 bg-rose-600 w-full" />
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Non-Compliant
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-rose-600 tracking-tight">
              {stats.nonCompliantVehicles + stats.blockedVehicles}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {stats.blockedVehicles} blocked · {stats.nonCompliantVehicles} doc issues
            </p>
          </div>
        </div>
      </div>

      {/* 4. Pending Verifications */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
        <div className="h-1 bg-amber-500 w-full" />
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pending Docs
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.pendingVerificationsCount}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Awaiting verification</p>
          </div>
        </div>
      </div>

      {/* 5. Expired / Expiring Soon Docs */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
        <div className="h-1 bg-orange-500 w-full" />
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Doc Expiries
            </span>
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <FileWarning className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight flex items-baseline gap-1">
              <span className={stats.expiredDocsCount > 0 ? 'text-rose-600' : ''}>
                {stats.expiredDocsCount}
              </span>
              <span className="text-xs font-normal text-slate-400">expired</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {stats.expiringSoonDocsCount} expiring soon (≤ 30d)
            </p>
          </div>
        </div>
      </div>

      {/* 6. Drivers Available */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
        <div className="h-1 bg-blue-600 w-full" />
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Drivers Status
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span className="text-emerald-600">{stats.driversAvailable}</span>
              <span className="text-xs font-medium text-slate-400">/ {stats.driversTotal}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {stats.driversOnTrip} on trip · {stats.driversOffDuty} off duty
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
