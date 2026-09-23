import React from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, ArrowRight } from 'lucide-react';

interface DriverAvailabilityWidgetProps {
  available: number;
  onTrip: number;
  offDuty: number;
  total: number;
}

export const DriverAvailabilityWidget: React.FC<DriverAvailabilityWidgetProps> = ({
  available,
  onTrip,
  offDuty,
  total,
}) => {
  const availPct = total > 0 ? Math.round((available / total) * 100) : 0;
  const onTripPct = total > 0 ? Math.round((onTrip / total) * 100) : 0;
  const offDutyPct = total > 0 ? Math.round((offDuty / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 tracking-tight">
              Driver Availability
            </h4>
            <p className="text-[10px] text-slate-400">Roster operational status</p>
          </div>
        </div>

        <span className="text-xs font-bold text-slate-800">
          {total} Total
        </span>
      </div>

      <div className="p-4 space-y-3.5 flex-1">
        {/* Availability stacked bar */}
        <div className="space-y-1">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${availPct}%` }}
              title={`Available: ${available} (${availPct}%)`}
            />
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${onTripPct}%` }}
              title={`On Trip: ${onTrip} (${onTripPct}%)`}
            />
            <div
              className="bg-slate-300 h-full transition-all duration-300"
              style={{ width: `${offDutyPct}%` }}
              title={`Off Duty: ${offDuty} (${offDutyPct}%)`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>{availPct}% available</span>
            <span>{onTripPct}% active trips</span>
          </div>
        </div>

        {/* Detailed counts */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="p-2 bg-emerald-50/70 border border-emerald-100 rounded-lg">
            <div className="text-base font-bold text-emerald-700">{available}</div>
            <div className="text-[10px] font-medium text-emerald-800">Available</div>
          </div>

          <div className="p-2 bg-blue-50/70 border border-blue-100 rounded-lg">
            <div className="text-base font-bold text-blue-700">{onTrip}</div>
            <div className="text-[10px] font-medium text-blue-800">On Trip</div>
          </div>

          <div className="p-2 bg-slate-100/70 border border-slate-200 rounded-lg">
            <div className="text-base font-bold text-slate-700">{offDuty}</div>
            <div className="text-[10px] font-medium text-slate-600">Off Duty</div>
          </div>
        </div>
      </div>

      <div className="p-2.5 bg-slate-50/75 border-t border-slate-100 text-right">
        <Link
          to="/drivers"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <span>Manage Drivers</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
