import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, Check } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface ComboboxOption {
  id: string;
  label: string;
  secondary?: string;
  badge?: string | number;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  searchPlaceholder = 'Search by name',
  emptyText = 'No matching options found',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setHighlightedIndex(0);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.secondary && opt.secondary.toLowerCase().includes(query)),
    );
  }, [options, search]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === value),
    [options, value],
  );

  // Virtualizer for large lists (> 100 options) per Section 14/F2 & Assumption A16
  const isVirtualized = filteredOptions.length > 100;
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: isVirtualized ? filteredOptions.length : 0,
    getScrollElement: () => listContainerRef.current,
    estimateSize: () => 44,
    overscan: 5,
  });

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0,
        );
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1,
        );
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const active = filteredOptions[highlightedIndex];
        if (active) {
          handleSelect(active.id);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        break;
      }
    }
  };

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      {/* Trigger Button (Screen 2) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm rounded-lg border transition-colors ${
          isOpen
            ? 'bg-slate-50/80 border-indigo-500 ring-1 ring-indigo-500'
            : 'bg-white border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedOption ? 'font-medium text-slate-800' : 'text-slate-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {/* Popover Dropdown (Screen 3) */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2"
          role="listbox"
          aria-label={placeholder}
        >
          {/* Search Input Pinned at Top (Screen 3) */}
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
              aria-label={searchPlaceholder}
            />
          </div>

          {/* Options List */}
          <div
            ref={listContainerRef}
            className="max-h-56 overflow-y-auto divide-y-0 thin-scrollbar"
            tabIndex={-1}
          >
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {emptyText}
              </div>
            ) : isVirtualized ? (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const opt = filteredOptions[virtualRow.index];
                  if (!opt) return null;
                  const isSelected = opt.id === value;
                  const isHighlighted = virtualRow.index === highlightedIndex;

                  return (
                    <div
                      key={opt.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(opt.id)}
                        onMouseEnter={() => setHighlightedIndex(virtualRow.index)}
                        className={`w-full h-full flex items-center justify-between px-3 py-1.5 text-left text-xs rounded transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-900 font-medium'
                            : isHighlighted
                              ? 'bg-slate-100/80 text-slate-900'
                              : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-medium">{opt.label}</p>
                          {opt.secondary && (
                            <p className="text-[11px] text-slate-400 truncate">
                              {opt.secondary}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge !== undefined && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded">
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredOptions.map((opt, index) => {
                  const isSelected = opt.id === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelect(opt.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-900 font-medium'
                          : isHighlighted
                            ? 'bg-slate-100/80 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-medium">{opt.label}</p>
                        {opt.secondary && (
                          <p className="text-[11px] text-slate-400 truncate">
                            {opt.secondary}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.badge !== undefined && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
