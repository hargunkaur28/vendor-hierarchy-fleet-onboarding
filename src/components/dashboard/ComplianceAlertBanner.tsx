import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { DashboardStats } from '@/lib/dashboard';

interface ComplianceAlertBannerProps {
  stats: DashboardStats;
}

export const ComplianceAlertBanner: React.FC<ComplianceAlertBannerProps> = ({ stats }) => {
  const hasIssues =
    stats.nonCompliantVehicles > 0 ||
    stats.blockedVehicles > 0 ||
    stats.expiredDocsCount > 0 ||
    stats.pendingVerificationsCount > 0;

  if (!hasIssues) {
    return (
      <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">
            All fleet vehicles and drivers in your subtree are fully compliant with valid certification.
          </span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200">
          100% Compliant
        </span>
      </div>
    );
  }

  return (
    <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="p-1 rounded-md bg-rose-100/80 text-rose-700 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold text-rose-900">Attention Required:</span>{' '}
          <span className="text-rose-800">
            {stats.blockedVehicles > 0 && `${stats.blockedVehicles} blocked vehicle(s) · `}
            {stats.nonCompliantVehicles > 0 && `${stats.nonCompliantVehicles} non-compliant cab(s) · `}
            {stats.expiredDocsCount > 0 && `${stats.expiredDocsCount} expired document(s) · `}
            {stats.pendingVerificationsCount > 0 && `${stats.pendingVerificationsCount} pending document review(s)`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {stats.nonCompliantVehicles > 0 && (
          <Link
            to="/vehicles"
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <span>Review Fleet</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
        {stats.pendingVerificationsCount > 0 && (
          <Link
            to="/documents"
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <span>Verification Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
};
