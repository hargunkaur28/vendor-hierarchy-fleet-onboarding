import React from 'react';
import { Search } from 'lucide-react';

interface AuditFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  actionFilter: string;
  onActionFilterChange: (value: string) => void;
  targetTypeFilter: string;
  onTargetTypeFilterChange: (value: string) => void;
}

export const AuditFilters: React.FC<AuditFiltersProps> = ({
  search,
  onSearchChange,
  actionFilter,
  onActionFilterChange,
  targetTypeFilter,
  onTargetTypeFilterChange,
}) => {
  return (
    <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1 w-full">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search audit trail by actor, target ID, or action..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white"
        />
      </div>

      {/* Action Filter */}
      <div className="flex items-center gap-1.5 w-full md:w-auto">
        <label htmlFor="audit-action-filter" className="text-xs font-medium text-slate-500 whitespace-nowrap">
          Action:
        </label>
        <select
          id="audit-action-filter"
          value={actionFilter}
          onChange={(e) => onActionFilterChange(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium text-slate-700"
        >
          <option value="ALL">All Actions</option>
          <option value="MOVE_PROFILE">Move Profile</option>
          <option value="CHANGE_ROLE">Change Role</option>
          <option value="BLOCK_VEHICLE">Block Vehicle</option>
          <option value="UNBLOCK_VEHICLE">Unblock Vehicle</option>
          <option value="SUSPEND_VENDOR">Suspend Vendor</option>
          <option value="REACTIVATE_VENDOR">Reactivate Vendor</option>
          <option value="UPLOAD_DOCUMENT">Upload Document</option>
          <option value="REVIEW_DOCUMENT">Review Document</option>
          <option value="CREATE_DELEGATION">Create Delegation</option>
          <option value="REVOKE_DELEGATION">Revoke Delegation</option>
        </select>
      </div>

      {/* Target Type Filter */}
      <div className="flex items-center gap-1.5 w-full md:w-auto">
        <label htmlFor="audit-target-filter" className="text-xs font-medium text-slate-500 whitespace-nowrap">
          Target:
        </label>
        <select
          id="audit-target-filter"
          value={targetTypeFilter}
          onChange={(e) => onTargetTypeFilterChange(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium text-slate-700"
        >
          <option value="ALL">All Targets</option>
          <option value="VENDOR">Vendor</option>
          <option value="VEHICLE">Vehicle</option>
          <option value="DRIVER">Driver</option>
          <option value="DOCUMENT">Document</option>
          <option value="DELEGATION">Delegation</option>
        </select>
      </div>
    </div>
  );
};
