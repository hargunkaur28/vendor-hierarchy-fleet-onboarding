import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '↓ / ↑', desc: 'Navigate between sibling / tiered nodes' },
    { key: '→', desc: 'Expand selected node' },
    { key: '←', desc: 'Collapse selected node' },
    { key: 'Enter / Space', desc: 'Select focused vendor node' },
    { key: 'm / M', desc: 'Open Move Profile dialog (for movable roles)' },
    { key: 'e / E', desc: 'Open Edit Vendor dialog' },
    { key: '/', desc: 'Focus tree search filter' },
    { key: 'Esc', desc: 'Clear search filter or close open dialogs' },
    { key: '?', desc: 'Toggle this keyboard shortcuts dialog' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs w-full h-full border-none cursor-default"
        onClick={onClose}
        aria-label="Close shortcuts dialog backdrop"
      />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-600" />
            <h3 id="shortcuts-title" className="text-base font-semibold text-slate-900">
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0"
            >
              <span className="text-slate-600 text-xs sm:text-sm">{s.desc}</span>
              <kbd className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-md shadow-2xs shrink-0 ml-2">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
