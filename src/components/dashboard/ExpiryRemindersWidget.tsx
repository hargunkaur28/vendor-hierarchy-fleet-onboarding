import React from 'react';
import { Link } from 'react-router-dom';
import { FileWarning, ArrowRight, AlertCircle } from 'lucide-react';
import type { ExpiryReminderDetail } from '@/lib/dashboard';

interface ExpiryRemindersWidgetProps {
  reminders: ExpiryReminderDetail[];
  expiredCount: number;
  expiringSoonCount: number;
}

export const ExpiryRemindersWidget: React.FC<ExpiryRemindersWidgetProps> = ({
  reminders,
  expiredCount,
  expiringSoonCount,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
            <FileWarning className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 tracking-tight">
              Expiry Reminders
            </h4>
            <p className="text-[10px] text-slate-400">Documents requiring renewal</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {expiredCount > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {expiredCount} expired
            </span>
          )}
          {expiringSoonCount > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {expiringSoonCount} soon
            </span>
          )}
        </div>
      </div>

      <div className="p-3 divide-y divide-slate-50 flex-1">
        {reminders.length === 0 ? (
          <div className="h-36 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
            <FileWarning className="w-6 h-6 text-slate-300 mb-1" />
            <p>No document expiries in the next 30 days</p>
          </div>
        ) : (
          reminders.slice(0, 5).map((item) => (
            <div key={item.id} className="py-2 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                  <span>{item.entityName}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                    {item.docType}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {item.ownerVendorName}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {item.isExpired ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-2.5 h-2.5" />
                    <span>Expired</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span>In {item.daysRemaining}d</span>
                  </span>
                )}
                <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                  {item.expiryDate.slice(0, 10)}
                </div>
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
          <span>View All Documents</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
