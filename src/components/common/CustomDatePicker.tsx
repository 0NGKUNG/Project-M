import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useBackButton } from '../../hooks/useBackButton';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export const CustomDateInput: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { triggerHaptic } = useFinance();
  useBackButton(isOpen, () => setIsOpen(false));

  const parsedDate = useMemo(() => {
    if (!value) return new Date();
    const parts = value.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date();
  }, [value]);

  const [calendarYear, setCalendarYear] = useState<number>(() => parsedDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => parsedDate.getMonth());

  const handleOpen = () => {
    if (disabled) return;
    triggerHaptic();
    setCalendarYear(parsedDate.getFullYear());
    setCalendarMonth(parsedDate.getMonth());
    setIsOpen(true);
  };

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
    const lastDayOfMonth = new Date(calendarYear, calendarMonth + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Mon = 0, Sun = 6

    const daysInMonth = lastDayOfMonth.getDate();
    const days: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];

    // Prev month padding
    const prevMonthLastDay = new Date(calendarYear, calendarMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        dateStr: '',
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(calendarMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      days.push({
        day: d,
        dateStr: `${calendarYear}-${monthStr}-${dayStr}`,
        isCurrentMonth: true,
      });
    }

    // Next month padding (fixed 42 cells)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        dateStr: '',
        isCurrentMonth: false,
      });
    }

    return days;
  }, [calendarYear, calendarMonth]);

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const formattedDisplay = useMemo(() => {
    if (!value) return placeholder;
    if (value === todayStr) return 'Today';
    const parts = value.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
    }
    return value;
  }, [value, todayStr, placeholder]);

  return (
    <>
      <div className={`relative ${className}`}>
        {label && (
          <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
            {label}
          </label>
        )}
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className="w-full h-11 bg-[#14141c] hover:bg-[#181822] border border-zinc-800/80 hover:border-zinc-700 rounded-xl px-3.5 flex items-center justify-between text-xs text-white font-mono cursor-pointer transition-colors active:scale-[0.99] select-none"
        >
          <div className="flex items-center gap-2.5 truncate">
            <CalendarIcon size={14} className="text-zinc-400 shrink-0" />
            <span className={value ? 'text-white font-semibold' : 'text-zinc-500'}>
              {formattedDisplay}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            {value ? value : ''}
          </span>
        </button>
      </div>

      {/* Date Picker Modal Drawer (Portal to document.body so never covered) */}
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="w-full sm:max-w-sm bg-[#0c0c10] border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 cursor-default safe-bottom"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-zinc-700/80 rounded-full mx-auto sm:hidden mb-1" />

              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-zinc-300" />
                  <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                    {label || 'Select Date'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Calendar Month Header & Navigation */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    const current = new Date(calendarYear, calendarMonth - 1, 1);
                    setCalendarYear(current.getFullYear());
                    setCalendarMonth(current.getMonth());
                  }}
                  className="w-8 h-8 rounded-xl bg-[#14141c] border border-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-xs font-mono font-bold text-white tracking-wide">
                  {new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'short', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    const next = new Date(calendarYear, calendarMonth + 1, 1);
                    setCalendarYear(next.getFullYear());
                    setCalendarMonth(next.getMonth());
                  }}
                  className="w-8 h-8 rounded-xl bg-[#14141c] border border-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 text-center font-mono">
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                  <span key={day} className="text-[9px] font-bold text-zinc-500 py-1">
                    {day}
                  </span>
                ))}
              </div>

              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7 gap-1 font-mono">
                {calendarDays.map((item, idx) => {
                  const isSelected = item.isCurrentMonth && item.dateStr === value;
                  const isTodayDate = item.dateStr === todayStr;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (item.dateStr) {
                          triggerHaptic();
                          onChange(item.dateStr);
                          setIsOpen(false);
                        }
                      }}
                      disabled={!item.isCurrentMonth}
                      className={`h-8 rounded-xl text-xs font-medium flex items-center justify-center transition-all cursor-pointer ${
                        !item.isCurrentMonth
                          ? 'text-zinc-700 pointer-events-none'
                          : isSelected
                          ? 'bg-white text-black font-bold shadow-md scale-105'
                          : isTodayDate
                          ? 'bg-zinc-800 text-white font-bold border border-zinc-700'
                          : 'text-zinc-300 hover:bg-zinc-800/80'
                      }`}
                    >
                      {item.day}
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions Footer */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80 font-mono">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    onChange(todayStr);
                    setIsOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-colors cursor-pointer text-center shadow-md"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
