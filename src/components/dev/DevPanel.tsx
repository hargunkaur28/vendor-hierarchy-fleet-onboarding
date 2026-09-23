import React, { useState } from 'react';
import { X, Wrench, RefreshCw, AlertTriangle, Zap, Activity } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { devApiConfig } from '@/api/client';
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

  const [latency, setLatency] = useState(devApiConfig.latencyMax);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!isOpen) return null;

  const handleLatencyChange = (val: number) => {
    setLatency(val);
    devApiConfig.latencyMax = val;
    devApiConfig.latencyMin = Math.round(val * 0.4);
  };

  const handleToggleFlakyNetwork = () => {
    if (failureRate === 0.15) {
      setFailureRate(0);
      devApiConfig.failureRate = 0;
      toast.info('Flaky network simulation disabled (0%)');
    } else {
      setFailureRate(0.15);
      devApiConfig.failureRate = 0.15;
      toast.warning('Flaky network simulation active (15% failure rate)');
    }
  };

  const handleResetStandard = async () => {
    setIsResetting(true);
    setShowResetConfirm(false);
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
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
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
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
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

          {/* Network Latency Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="latency-slider" className="text-xs font-semibold text-slate-900 block">
                  Mock API Latency
                </label>
                <p className="text-[11px] text-slate-500">Simulate slow connections (0 – 1500 ms)</p>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-md">
                {latency} ms
              </span>
            </div>
            <input
              id="latency-slider"
              type="range"
              min="0"
              max="1500"
              step="50"
              value={latency}
              onChange={(e) => handleLatencyChange(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Network Failure Simulation & Flaky Preset */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
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
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setFailureRate(val);
                devApiConfig.failureRate = val;
              }}
              className="w-full accent-indigo-600"
            />

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleToggleFlakyNetwork}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  failureRate === 0.15
                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Flaky Network Preset (15%)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAutoFailNext(!autoFailNext);
                  devApiConfig.forceFailNext = !autoFailNext;
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  autoFailNext
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {autoFailNext ? 'Next Call Fails (Active)' : 'Force Fail Next Call'}
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Force Invalid Move (Demo Step 3)
              </button>

              <button
                type="button"
                onClick={handleLoadStress}
                disabled={isResetting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
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
            onClick={() => setShowResetConfirm(true)}
            disabled={isResetting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            Reset to Golden Seed
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Confirmation Modal for Reset to Golden Seed */}
        {showResetConfirm && (
          <div className="absolute inset-0 bg-white/95 rounded-2xl p-6 flex flex-col justify-center items-center text-center z-20 animate-in fade-in duration-100">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
            <h4 className="text-sm font-bold text-slate-900">Reset to Golden Seed?</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              This will overwrite all current changes, vehicles, documents, and delegation records with the initial golden scenario dataset.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetStandard}
                disabled={isResetting}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
              >
                Yes, Reset Database
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
