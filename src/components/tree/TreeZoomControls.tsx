import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface TreeZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
}

export const TreeZoomControls: React.FC<TreeZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetZoom,
}) => {
  return (
    <div
      className="absolute bottom-5 right-5 z-20 bg-white/95 backdrop-blur-xs border border-slate-200/90 shadow-lg rounded-xl p-1 flex items-center gap-1 text-xs select-none"
      role="toolbar"
      aria-label="Tree zoom controls"
    >
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= 0.2}
        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
        title="Zoom Out"
        aria-label="Zoom out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onResetZoom}
        className="px-2 py-1 font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer min-w-[50px] text-center"
        title="Current zoom (click to reset to 100%)"
        aria-label="Current zoom level"
      >
        {Math.round(zoom * 100)}%
      </button>

      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= 2.0}
        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
        title="Zoom In"
        aria-label="Zoom in"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />

      <button
        type="button"
        onClick={onFitToScreen}
        className="flex items-center gap-1.5 px-2.5 py-1 font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        title="Fit whole tree to screen"
        aria-label="Fit whole tree to screen"
      >
        <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline">Fit to Screen</span>
      </button>

      <button
        type="button"
        onClick={onResetZoom}
        className="flex items-center gap-1 px-2 py-1 font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        title="Reset zoom to 100%"
        aria-label="Reset zoom to 100%"
      >
        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  );
};
