import React, { useState } from 'react';
import { X, Wrench, RefreshCw, AlertTriangle, Zap } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';

interface DevPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevPanel: React.FC<DevPanelProps> = ({ isOpen, onClose }) => {
  const failureRate = useAppStore((s) => s.failureRate);
  const setFailureRate = useAppStore((s) => s.setFailureRate);
  const autoFailNext = useAppStore((s) => s.autoFailNext);
  const setAutoFailNext = useAppStore((s) => s.setAutoFailNext);
  const resetDatabase = useAppStore((s) => s.resetDatabase);
  const vendorsById = useAppStore((s) => s.vendorsById);
  const vehiclesById = useAppStore((s) => s.vehiclesById);
  const driversById = useAppStore((s) => s.driversById);
  const moveVendor = useAppStore((s) => s.moveVendor);

  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const handleResetStandard = async () => {
    setIsResetting(true);
    try {
      await resetDatabase(false);
      toast.success('Database reset to golden scenario');
    } catch {
      toast.error('Failed to reset database');
    } finally {
      setIsResetting(false);
    }
  };

  const handleLoadStress = async () => {
    setIsResetting(true);
    const start = performance.now();
    try {
      await resetDatabase(true);
      const elapsed = (performance.now() - start).toFixed(1);
      toast.success(`5,000 stress vendors loaded in ${elapsed} ms`);
    } catch {
      toast.error('Failed to load stress dataset');
    } finally {
      setIsResetting(false);
    }
  };

  const handleForceInvalidMove = async () => {
    // Attempt to move root or cause a cycle to demonstrate error handling in UI
    try {
      await moveVendor('admin', 'sa-site-admin');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid move rejected');
    }
  };

  const vendorCount = Object.keys(vendorsById).length;
  const vehicleCount = Object.keys(vehiclesById).length;
  const driverCount = Object.keys(driversById).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-panel-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-2xs w-full h-full border-none cursor-default"
        onClick={onClose}
        aria-label="Close developer panel backdrop"
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            <h3 id="dev-panel-title" className="text-base font-semibold text-slate-900">
              Developer & Diagnostics Panel
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close developer panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-5">
          {/* Performance & Count Stats */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Current Dataset Metrics
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-lg font-bold text-slate-900">{vendorCount}</span>
                <p className="text-[10px] text-slate-500 font-medium">Vendors</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-lg font-bold text-slate-900">{vehicleCount}</span>
                <p className="text-[10px] text-slate-500 font-medium">Vehicles</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-lg font-bold text-slate-900">{driverCount}</span>
                <p className="text-[10px] text-slate-500 font-medium">Drivers</p>
              </div>
            </div>
          </div>

          {/* Network Failure Simulation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="failure-slider" className="text-xs font-semibold text-slate-900 block">
                  Simulated API Failure Rate
                </label>
                <p className="text-[11px] text-slate-500">Injects probabilistic network failures</p>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-md">
                {Math.round(failureRate * 100)}%
              </span>
            </div>
            <input
              id="failure-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={failureRate}
              onChange={(e) => setFailureRate(parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs font-medium text-slate-700">One-shot force fail next API call</div>
              <button
                type="button"
                onClick={() => setAutoFailNext(!autoFailNext)}
                className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  autoFailNext
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {autoFailNext ? 'Active (Will Fail)' : 'Inactive'}
              </button>
            </div>
          </div>

          {/* Quick Demo Actions */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <h4 className="text-xs font-semibold text-slate-700">Demo Shortcuts</h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleForceInvalidMove}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Force Invalid Move (Demo Step 3)
              </button>

              <button
                type="button"
                onClick={handleLoadStress}
                disabled={isResetting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                Load 5,000 Vendors (Stress Test)
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetStandard}
            disabled={isResetting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            Reset to Golden Seed
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
