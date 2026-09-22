import React, { useState } from 'react';
import { Shield, KeyRound, UserCheck } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DelegationTable } from '@/components/delegation/DelegationTable';
import { PermissionMatrix } from '@/components/delegation/PermissionMatrix';
import { DelegateDialog } from '@/components/delegation/DelegateDialog';

export const DelegationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'delegations' | 'matrix'>('delegations');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const actingOnBehalfOf = useAppStore((s) => s.actingOnBehalfOf);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const delegator = actingOnBehalfOf ? vendorsById[actingOnBehalfOf] : null;

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto thin-scrollbar p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Delegation & Permissions (F4, F5)
            </h1>
            {actingOnBehalfOf && delegator && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Acting as {delegator.name}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            Manage granular authority delegation and direct operational permissions across your vendor subtree.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('delegations')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors select-none cursor-pointer ${
              activeTab === 'delegations'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Delegated Authority (F5)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors select-none cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Permission Matrix (F4)</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="min-h-0 flex-1">
        {activeTab === 'delegations' ? (
          <DelegationTable onOpenCreate={() => setIsCreateOpen(true)} />
        ) : (
          <PermissionMatrix />
        )}
      </div>

      {/* Create Delegation Modal */}
      <DelegateDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
};

export default DelegationPage;
