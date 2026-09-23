import React from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2, ArrowRight, Car, User, Clock } from 'lucide-react';
import type { PendingDocWidgetDetail } from '@/lib/dashboard';

interface PendingVerificationsWidgetProps {
  items: PendingDocWidgetDetail[];
  totalPendingCount: number;
}

export const PendingVerificationsWidget: React.FC<PendingVerificationsWidgetProps> = ({
  items,
  totalPendingCount,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 tracking-tight">
              Pending Verifications
            </h4>
            <p className="text-[10px] text-slate-400">Oldest unreviewed documents</p>
          </div>
        </div>

        {totalPendingCount > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {totalPendingCount} total
          </span>
        )}
      </div>

      <div className="p-3 divide-y divide-slate-50 flex-1">
        {items.length === 0 ? (
          <div className="h-36 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
            <FileCheck2 className="w-6 h-6 text-slate-300 mb-1" />
            <p>Verification queue is clear</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="py-2 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 rounded bg-slate-100 text-slate-600 shrink-0">
                  {item.entityType === 'VEHICLE' ? (
                    <Car className="w-3.5 h-3.5" />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">
                    {item.entityName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {item.ownerVendorName} · {item.docType}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-300" />
                <span>{item.uploadedAt.slice(0, 10)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2.5 bg-slate-50/75 border-t border-slate-100 text-right">
        <Link
          to="/documents"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <span>Open Verification Queue</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
