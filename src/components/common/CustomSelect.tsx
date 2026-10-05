import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  sublabel?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  searchable,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Position state for portal
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
  } | null>(null);

  const shouldShowSearch = searchable !== undefined ? searchable : options.length >= 7;

  const filteredOptions = searchQuery
    ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Minimum desired menu height
    const desiredHeight = 220;
    // Prefer opening upward when space below is constrained and space above is sufficient
    const openUp = (spaceBelow < desiredHeight && spaceAbove > 140) || (spaceBelow < 160 && spaceAbove > spaceBelow);

    const availableHeight = openUp
      ? Math.max(100, spaceAbove - 20)
      : Math.max(100, spaceBelow - 20);
    const maxHeight = Math.min(availableHeight, 280);

    const minWidth = Math.max(rect.width, 180);
    let left = rect.left;
    if (left + minWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - minWidth - 8);
    }

    if (openUp) {
      setMenuPos({
        bottom: window.innerHeight - rect.top + 6,
        left,
        width: minWidth,
        maxHeight,
        openUp: true,
      });
    } else {
      setMenuPos({
        top: rect.bottom + 6,
        left,
        width: minWidth,
        maxHeight,
        openUp: false,
      });
    }
  }, [options.length]);

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setIsOpen(false);
      } else {
        updatePosition();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <div className={`relative select-none ${className}`}>
      {/* Selector Button */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-11 flex items-center justify-between gap-2.5 px-3.5 rounded-xl bg-[#16161d] hover:bg-[#1a1a24] border text-xs text-white transition-all cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${
          isOpen
            ? 'border-zinc-500 ring-2 ring-zinc-500/20 shadow-md'
            : 'border-zinc-800/80 hover:border-zinc-700'
        }`}
      >
        <span className="flex items-center gap-2.5 truncate">
          {selectedOption?.icon && (
            <span className="w-6 h-6 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-300 shrink-0">
              {selectedOption.icon}
            </span>
          )}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        {/* Custom styled arrow */}
        <ChevronDown
          size={14}
          className={`text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu (rendered in Portal to avoid modal clipping & overflow) */}
      {isOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPos.top !== undefined ? `${menuPos.top}px` : 'auto',
              bottom: menuPos.bottom !== undefined ? `${menuPos.bottom}px` : 'auto',
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              maxHeight: `${menuPos.maxHeight}px`,
            }}
            className="z-[250] bg-[#121217] border border-zinc-800 rounded-2xl p-1.5 shadow-2xl flex flex-col animate-fade-in backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input when options are numerous */}
            {shouldShowSearch && (
              <div className="p-1 pb-1.5 border-b border-zinc-800/80 mb-1 shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#181820] rounded-xl border border-zinc-800">
                  <Search size={13} className="text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="py-3 px-3 text-center text-xs text-zinc-500">
                  No options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-zinc-800 text-white font-bold shadow-sm'
                          : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {opt.icon && (
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-zinc-700 text-white' : 'bg-zinc-850 text-zinc-400'
                            }`}
                          >
                            {opt.icon}
                          </span>
                        )}
                        <div className="truncate">
                          <span className="truncate block font-medium">{opt.label}</span>
                          {opt.sublabel && (
                            <span className="text-[10px] text-zinc-500 block truncate font-mono">
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check size={13} className="text-white shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
