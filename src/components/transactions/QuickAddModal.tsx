import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Check, 
  Calendar as CalendarIcon, 
  Wallet as WalletIcon, 
  FileText, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionType } from '../../types/finance';
import { CategoryIcon } from '../common/Icons';
import { parseFormattedNumber, formatAmountDisplay } from '../common/CurrencyInput';
import { useBackButton } from '../../hooks/useBackButton';

interface WheelColumnProps {
  items: (number | string)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatItem?: (item: number | string) => string;
  isPeriod?: boolean;
  paddingClass?: string;
  active?: boolean;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  items,
  selectedIndex,
  onSelect,
  formatItem = (item) => String(item),
  isPeriod = false,
  paddingClass: _unusedPaddingClass = 'py-[72px]',
  active = true,
}) => {
  const { triggerHaptic } = useFinance();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const lastActiveIndexRef = useRef(selectedIndex);
  const pointerHistoryRef = useRef<Array<{ y: number; time: number }>>([]);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const wheelAccumulatorRef = useRef(0);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstActiveRef = useRef(true);
  const rafIdRef = useRef<number | null>(null);

  // Measure container height dynamically so the selected item is mathematically centered
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setContainerHeight(el.clientHeight);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Smooth ease-out cubic animation engine to guarantee single deterministic landing
  const animateTo = (targetScroll: number, onComplete?: () => void) => {
    const el = containerRef.current;
    if (!el) return;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    isProgrammaticScrollRef.current = true;
    const startScroll = el.scrollTop;
    const distance = targetScroll - startScroll;

    if (Math.abs(distance) < 0.5) {
      el.scrollTop = targetScroll;
      isProgrammaticScrollRef.current = false;
      onComplete?.();
      return;
    }

    const duration = Math.min(280, Math.max(160, Math.abs(distance) * 1.5));
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic: 1 - (1 - t)^3
      const easeOut = 1 - Math.pow(1 - progress, 3);
      el.scrollTop = startScroll + distance * easeOut;

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(step);
      } else {
        el.scrollTop = targetScroll;
        rafIdRef.current = null;
        isProgrammaticScrollRef.current = false;
        onComplete?.();
      }
    };

    rafIdRef.current = requestAnimationFrame(step);
  };

  // Cleanup active RAF and wheel timer on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, []);

  // Reset first-active flag when inactive so next open is instant
  useEffect(() => {
    if (!active) {
      isFirstActiveRef.current = true;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
  }, [active]);

  // Instant positioning on initial open (before paint) or smooth scroll for external updates (e.g. Set to Now)
  useLayoutEffect(() => {
    if (active && containerRef.current && !isDraggingRef.current) {
      if (isFirstActiveRef.current) {
        // Initial open: instantaneous positioning with zero delay or visible change
        isProgrammaticScrollRef.current = true;
        containerRef.current.scrollTop = selectedIndex * 32;
        lastActiveIndexRef.current = selectedIndex;
        isFirstActiveRef.current = false;
        const frame = requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
        return () => cancelAnimationFrame(frame);
      } else if (selectedIndex !== lastActiveIndexRef.current) {
        // External update while already open (e.g. "Set to Now"): smooth animate
        lastActiveIndexRef.current = selectedIndex;
        animateTo(selectedIndex * 32);
      }
    }
  }, [active, selectedIndex, containerHeight]);

  // Scroll listener: only for passive native scroll events when not animating or dragging
  const handleScroll = () => {
    if (isProgrammaticScrollRef.current || isDraggingRef.current || !containerRef.current) return;
    const currentScroll = containerRef.current.scrollTop;
    const rawIndex = Math.round(currentScroll / 32);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, rawIndex));

    if (clampedIndex !== lastActiveIndexRef.current) {
      lastActiveIndexRef.current = clampedIndex;
      triggerHaptic();
      onSelect(clampedIndex);
    }
  };

  // Wheel listener: accumulates delta and smoothly steps by 1 item (32px)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    wheelAccumulatorRef.current += e.deltaY;
    if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    wheelTimeoutRef.current = setTimeout(() => {
      wheelAccumulatorRef.current = 0;
    }, 200);

    if (Math.abs(wheelAccumulatorRef.current) >= 24) {
      const step = wheelAccumulatorRef.current > 0 ? 1 : -1;
      wheelAccumulatorRef.current = 0;
      const currentIndex = Math.round(containerRef.current.scrollTop / 32);
      const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + step));
      if (nextIndex !== lastActiveIndexRef.current) {
        lastActiveIndexRef.current = nextIndex;
        triggerHaptic();
        onSelect(nextIndex);
        animateTo(nextIndex * 32);
      }
    }
  };

  // Direct pointer drag (Mouse + Touch unified) with momentum flick physics
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isProgrammaticScrollRef.current = false;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startYRef.current = e.clientY;
    startScrollTopRef.current = el.scrollTop;
    pointerHistoryRef.current = [{ y: e.clientY, time: performance.now() }];

    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture is unsupported or fails
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const el = containerRef.current;
    const deltaY = e.clientY - startYRef.current;

    if (Math.abs(deltaY) > 3) {
      hasMovedRef.current = true;
    }

    el.scrollTop = startScrollTopRef.current - deltaY;

    const now = performance.now();
    pointerHistoryRef.current.push({ y: e.clientY, time: now });
    pointerHistoryRef.current = pointerHistoryRef.current.filter((p) => now - p.time <= 100);

    const rawIndex = Math.round(el.scrollTop / 32);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, rawIndex));
    if (clampedIndex !== lastActiveIndexRef.current) {
      lastActiveIndexRef.current = clampedIndex;
      triggerHaptic();
      onSelect(clampedIndex);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    isDraggingRef.current = false;
    const el = containerRef.current;

    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const now = performance.now();
    const history = pointerHistoryRef.current.filter((p) => now - p.time <= 100);
    let velocity = 0;
    if (history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];
      const dt = newest.time - oldest.time;
      const dy = newest.y - oldest.y;
      if (dt > 10) {
        velocity = dy / dt; // px/ms
      }
    }

    // Momentum projection if flicked, otherwise settle cleanly to closest item
    const momentumDistance = -velocity * 180;
    const projectedScroll = el.scrollTop + momentumDistance;
    const targetIndex = Math.max(0, Math.min(items.length - 1, Math.round(projectedScroll / 32)));

    lastActiveIndexRef.current = targetIndex;
    triggerHaptic();
    onSelect(targetIndex);

    // Single deterministic ease-out glide to target without any CSS snap oscillation
    animateTo(targetIndex * 32);
  };

  const handleItemClick = (idx: number) => {
    if (hasMovedRef.current) return;
    if (!containerRef.current) return;

    lastActiveIndexRef.current = idx;
    triggerHaptic();
    onSelect(idx);
    animateTo(idx * 32);
  };

  const paddingY = containerHeight > 0 ? Math.max(0, (containerHeight - 32) / 2) : 80;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        touchAction: 'none',
        paddingTop: `${paddingY}px`,
        paddingBottom: `${paddingY}px`,
      }}
      className="col-span-2 h-full overflow-y-auto no-scrollbar cursor-grab active:cursor-grabbing select-none"
    >
      {items.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        const label = formatItem(item);
        return (
          <div
            key={idx}
            onClick={() => handleItemClick(idx)}
            className={`h-8 flex items-center justify-center cursor-pointer transition-all duration-150 select-none ${
              isSelected
                ? isPeriod
                  ? 'text-white text-lg font-black scale-105'
                  : 'text-white text-2xl font-black scale-105'
                : isPeriod
                ? 'text-zinc-500 text-sm font-bold hover:text-zinc-300'
                : 'text-zinc-500 text-base font-bold hover:text-zinc-300'
            }`}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
};

interface TimeWheelPickerProps {
  time: string;
  setTime: (newTime: string) => void;
  active?: boolean;
  heightClass?: string;
  paddingClass?: string;
  gradientBg?: string;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS: ('AM' | 'PM')[] = ['AM', 'PM'];

const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({
  time,
  setTime,
  active = true,
  heightClass = 'h-44',
  paddingClass = 'py-[72px]',
  gradientBg = 'from-[#0c0c10]',
}) => {
  const [rawH = '12', rawM = '00'] = (time || '12:00').split(':');
  const currentH24 = parseInt(rawH, 10) || 0;
  const hour12Num = currentH24 % 12 || 12;
  const hourIndex = hour12Num - 1; // 0..11
  const minIndex = Math.max(0, Math.min(59, parseInt(rawM, 10) || 0)); // 0..59
  const isPM = currentH24 >= 12;
  const periodIndex = isPM ? 1 : 0; // 0 = AM, 1 = PM

  const handleHourSelect = (idx: number) => {
    const selectedH12 = idx + 1; // 1..12
    let new24H = selectedH12 % 12;
    if (isPM) new24H += 12;
    const newTime = `${String(new24H).padStart(2, '0')}:${rawM.padStart(2, '0')}`;
    if (newTime !== time) {
      setTime(newTime);
    }
  };

  const handleMinSelect = (idx: number) => {
    const newTime = `${rawH.padStart(2, '0')}:${String(idx).padStart(2, '0')}`;
    if (newTime !== time) {
      setTime(newTime);
    }
  };

  const handlePeriodSelect = (idx: number) => {
    let new24H = hour12Num % 12;
    if (idx === 1) new24H += 12; // idx 1 = PM
    const newTime = `${String(new24H).padStart(2, '0')}:${rawM.padStart(2, '0')}`;
    if (newTime !== time) {
      setTime(newTime);
    }
  };

  const gradientVia = gradientBg.includes('14141a') ? 'via-[#14141a]/80' : 'via-[#0c0c10]/80';
  const gradientH = 'h-9';

  return (
    <div className={`relative overflow-hidden ${heightClass} w-full flex items-center justify-center pt-1`}>
      {/* Top & Bottom Gradient Fading Overlay Mask */}
      <div className={`absolute inset-x-0 top-0 ${gradientH} bg-gradient-to-b ${gradientBg} ${gradientVia} to-transparent z-20 pointer-events-none`} />
      <div className={`absolute inset-x-0 bottom-0 ${gradientH} bg-gradient-to-t ${gradientBg} ${gradientVia} to-transparent z-20 pointer-events-none`} />

      {/* Columns layout: [Hour] : [Minute] [AM/PM] */}
      <div className="grid grid-cols-7 w-full text-center z-0 h-full items-center font-mono">
        {/* Hours Column (span 2) */}
        <WheelColumn
          items={HOURS}
          selectedIndex={hourIndex}
          onSelect={handleHourSelect}
          formatItem={(h) => String(h).padStart(2, '0')}
          paddingClass={paddingClass}
          active={active}
        />

        {/* Colon Separator Column (span 1) */}
        <div className="col-span-1 z-20 text-white text-xl font-black flex items-center justify-center pointer-events-none select-none">
          :
        </div>

        {/* Minutes Column (span 2) */}
        <WheelColumn
          items={MINUTES}
          selectedIndex={minIndex}
          onSelect={handleMinSelect}
          formatItem={(m) => String(m).padStart(2, '0')}
          paddingClass={paddingClass}
          active={active}
        />

        {/* AM / PM Column (span 2) */}
        <WheelColumn
          items={PERIODS}
          selectedIndex={periodIndex}
          onSelect={handlePeriodSelect}
          formatItem={(p) => String(p)}
          isPeriod={true}
          paddingClass={paddingClass}
          active={active}
        />
      </div>
    </div>
  );
};

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, defaultAccountId }) => {
  useBackButton(isOpen, onClose);
  const { state, addTransaction, triggerHaptic } = useFinance();
  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(undefined);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    defaultAccountId || state.accounts[0]?.id || ''
  );
  const [toAccountId, setToAccountId] = useState<string>(state.accounts[1]?.id || state.accounts[0]?.id || '');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState<string>('');
  
  // Custom Calendar state for Date Picker
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());

  // Quick subcategory dropdown modal/drawer (for mobile or click)
  const [activeDropdownCatId, setActiveDropdownCatId] = useState<string | null>(null);

  // Selector state for Right Side Panel on PC / Modal on Mobile
  const [activeRightPanel, setActiveRightPanel] = useState<'datetime' | 'account' | null>(null);
  const [lastRightPanel, setLastRightPanel] = useState<'datetime' | 'account'>('account');

  const openRightPanel = (panel: 'datetime' | 'account' | null) => {
    if (panel) setLastRightPanel(panel);
    setActiveRightPanel(panel);
  };

  // Hidden account picker fallback flag for mobile compatibility
  const [showAccountPicker, setShowAccountPicker] = useState<boolean>(false);

  // Auto-detect layout: hide numpad on PC/desktop screens (>=768px), show on mobile (<768px)
  const [showNumpad, setShowNumpad] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return true;
  });
  const [time, setTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [showDateTimePicker, setShowDateTimePicker] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const lastCategoryWithSubsRef = useRef<any>(undefined);

  // Helper to generate full days matrix for the active month (Mon-Sun layout)
  const calendarDays = React.useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
    const lastDayOfMonth = new Date(calendarYear, calendarMonth + 1, 0);
    
    // Day of week index (Monday = 0, Sunday = 6)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Convert Sunday from 0 to 6

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

    // Next month padding to keep fixed 6 rows (42 total cells) so card height never changes
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

  // Top level categories
  const parentCategories = state.categories.filter(
    (c) => !c.parentId && c.type === (type === 'income' ? 'income' : 'expense')
  );

  const getSubcategories = (catId: string) => state.categories.filter((c) => c.parentId === catId);

  // Sync selected account & auto-reset date/time to NOW when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowNumpad(window.innerWidth < 768);
      const now = new Date();
      setDate(now.toISOString().split('T')[0]);
      setCalendarYear(now.getFullYear());
      setCalendarMonth(now.getMonth());
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setTime(`${hh}:${mm}`);
    } else {
      setActiveRightPanel(null);
    }
    if (defaultAccountId) {
      setSelectedAccountId(defaultAccountId);
    } else if (state.accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(state.accounts[0].id);
    }
  }, [defaultAccountId, state.accounts, isOpen]);

  // Ensure default category selected
  useEffect(() => {
    if (parentCategories.length > 0 && (!selectedCategoryId || !parentCategories.find(c => c.id === selectedCategoryId))) {
      setSelectedCategoryId(parentCategories[0].id);
      setSelectedSubcategoryId(undefined);
    }
  }, [type, parentCategories, selectedCategoryId]);

  // Keyboard navigation & physical numpad
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (target !== inputRef.current) return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleKeypadPress('.');
      } else if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === '=') {
        e.preventDefault();
        handleKeypadPress('=');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadPress('back');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (/[+-]/.test(amountStr)) {
          handleKeypadPress('=');
        } else {
          executeSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, amountStr, type, selectedCategoryId, selectedSubcategoryId, selectedAccountId, toAccountId, date, note]);

  if (!isOpen) return null;

  // Helper to evaluate simple expressions like "100 - 50" or "100 + 50"
  const evaluateAmountExpression = (expr: string): string => {
    try {
      // Replace non math chars
      const sanitized = expr.replace(/[^0-9.+-]/g, '');
      if (!sanitized) return '0';
      
      // Match numbers (including .5 or 5.) and operators
      const tokens = sanitized.match(/(\d+\.?\d*|\.\d+)|([+-])/g);
      if (!tokens || tokens.length === 0) return '0';

      let result = 0;
      let currentOp = '+';
      let startIndex = 0;

      if (tokens[0] === '+' || tokens[0] === '-') {
        currentOp = tokens[0];
        startIndex = 1;
      } else {
        result = parseFloat(tokens[0]) || 0;
        startIndex = 1;
      }

      for (let i = startIndex; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === '+' || token === '-') {
          currentOp = token;
        } else {
          const val = parseFloat(token) || 0;
          if (currentOp === '+') result += val;
          if (currentOp === '-') result -= val;
        }
      }

      return String(Math.max(0, parseFloat(result.toFixed(2))));
    } catch {
      return expr;
    }
  };

  // Numpad handler supporting calculator equations
  const handleKeypadPress = (val: string) => {
    triggerHaptic();
    if (val === 'C') {
      setAmountStr('0');
      return;
    }
    if (val === 'back') {
      const trimmed = amountStr.trimEnd();
      if (trimmed.length <= 1) {
        setAmountStr('0');
        return;
      }
      // If ends with an operator like " + " or " +", remove operator and surrounding spaces
      if (/[+-]\s*$/.test(amountStr)) {
        const cleaned = amountStr.replace(/\s*[+-]\s*$/, '');
        setAmountStr(cleaned || '0');
        return;
      }
      const next = amountStr.slice(0, -1).trimEnd();
      setAmountStr(next || '0');
      return;
    }
    if (val === '=') {
      const computed = evaluateAmountExpression(amountStr);
      setAmountStr(computed);
      return;
    }
    if (val === '+' || val === '-') {
      // If already ends with an operator, replace it
      if (/[+-]\s*$/.test(amountStr)) {
        const replaced = amountStr.replace(/[+-]\s*$/, `${val} `);
        setAmountStr(replaced);
      } else {
        setAmountStr(`${amountStr.trimEnd()} ${val} `);
      }
      return;
    }
    if (val === '.') {
      const lastToken = amountStr.split(/[+-]/).pop()?.trim() || '';
      if (lastToken.includes('.')) return;
      if (!lastToken) {
        setAmountStr(`${amountStr}0.`);
      } else {
        setAmountStr(`${amountStr}.`);
      }
      return;
    }

    const lastToken = amountStr.split(/[+-]/).pop()?.trim() || '';
    if (amountStr === '0' || amountStr === '' || lastToken === '0') {
      if (amountStr === '0' || amountStr === '') {
        setAmountStr(val);
      } else {
        setAmountStr(amountStr.replace(/0$/, val));
      }
    } else {
      if (amountStr.length > 30) return;
      setAmountStr(amountStr + val);
    }
  };

  const executeSubmit = () => {
    const computed = evaluateAmountExpression(amountStr);
    const parsedAmount = parseFormattedNumber(computed);
    if (!parsedAmount || parsedAmount <= 0) return;

    addTransaction({
      type,
      amount: parsedAmount,
      categoryId: type === 'transfer' ? 'transfer' : selectedCategoryId,
      subcategoryId: type === 'transfer' ? undefined : selectedSubcategoryId,
      accountId: selectedAccountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      date,
      time: time || undefined,
      note: note.trim() || undefined,
    });

    setAmountStr('0');
    setNote('');
    setSelectedSubcategoryId(undefined);
    onClose();
  };

  const selectedAccount = state.accounts.find((a) => a.id === selectedAccountId);
  const selectedCategory = state.categories.find((c) => c.id === selectedCategoryId);
  const selectedSub = state.categories.find((c) => c.id === selectedSubcategoryId);
  const currentSubcategories = selectedCategory ? getSubcategories(selectedCategory.id) : [];
  const hasSubcategories = type !== 'transfer' && currentSubcategories.length > 0;

  // Persist category with subcategories during closing animation so it slides out intact
  if (selectedCategory && currentSubcategories.length > 0) {
    lastCategoryWithSubsRef.current = selectedCategory;
  }
  const displayCategory = hasSubcategories ? selectedCategory : (lastCategoryWithSubsRef.current || selectedCategory);
  const displaySubcategories = displayCategory ? getSubcategories(displayCategory.id) : [];

  // Quick Date format for badge
  const isToday = date === new Date().toISOString().split('T')[0];

  const handleOpenDateTime = () => {
    triggerHaptic();
    if (window.innerWidth >= 768) {
      openRightPanel(activeRightPanel === 'datetime' ? null : 'datetime');
    } else {
      setShowDateTimePicker(true);
    }
  };

  const handleOpenAccount = () => {
    triggerHaptic();
    if (window.innerWidth >= 768) {
      openRightPanel(activeRightPanel === 'account' ? null : 'account');
    } else {
      setShowAccountPicker(true);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-xs animate-fade-in p-0 sm:p-4"
      onClick={onClose}
    >
      <input
        ref={inputRef}
        type="text"
        className="opacity-0 absolute -top-9999px left-0 pointer-events-none"
        readOnly
      />

      {/* Outer Wrapper for Side Panels & Main Card on Desktop */}
      <div 
        className="flex items-stretch justify-center gap-3 w-full max-w-full sm:max-w-4xl lg:max-w-6xl transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. LEFT SIDE PANEL: Subcategories (Behind Main Card z-10) */}
        <div 
          className={`hidden md:flex justify-end relative z-10 transition-all duration-300 ease-out ${
            hasSubcategories ? 'w-60 lg:w-64 opacity-100 pointer-events-auto' : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div 
            style={{
              transform: hasSubcategories ? 'translateX(0)' : 'translateX(calc(100% + 12px))'
            }}
            className="w-60 lg:w-64 bg-[#0c0c10] border border-zinc-900 rounded-3xl flex flex-col p-4 overflow-y-auto shadow-2xl h-full font-mono shrink-0 transition-transform duration-300 ease-out"
          >
            {displayCategory && (
              <div key={displayCategory.id} className="flex flex-col h-full animate-fade-in">
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-zinc-900 shrink-0">
                  <div className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-white shrink-0">
                    <CategoryIcon name={displayCategory.icon || 'Tag'} size={13} />
                  </div>
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider truncate">
                    {displayCategory.name}
                  </span>
                </div>
                
                <div className="space-y-2 font-mono flex-1 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setSelectedSubcategoryId(undefined);
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer min-h-[48px] ${
                      selectedSubcategoryId === undefined
                        ? 'bg-white text-black font-bold shadow-xs'
                        : 'bg-[#14141a] text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                    }`}
                  >
                    <span>All / General</span>
                    {selectedSubcategoryId === undefined && <Check size={14} strokeWidth={3} />}
                  </button>

                  {displaySubcategories.map((sub) => {
                    const isSubSelected = selectedSubcategoryId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setSelectedSubcategoryId(sub.id);
                        }}
                        className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer min-h-[48px] ${
                          isSubSelected
                            ? 'bg-white text-black font-bold shadow-xs'
                            : 'bg-[#14141a] text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <CategoryIcon name={sub.icon || 'Tag'} size={14} className={isSubSelected ? 'text-black' : 'text-zinc-500'} />
                          <span className="truncate">{sub.name}</span>
                        </div>
                        {isSubSelected && <Check size={14} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. MAIN CARD: Category Grid (3 cols on PC), Amount Display, Note Input, Save Button (Elevated z-20 so side panels emerge behind it) */}
        <div className="relative z-20 w-full sm:max-w-2xl md:w-[580px] lg:w-[620px] bg-[#0c0c10] sm:border border-zinc-900 sm:rounded-2xl md:rounded-3xl flex flex-col overflow-hidden shadow-2xl safe-top safe-bottom select-none shrink-0">
          
          {/* Top App Bar: Back icon + Type Switcher Pills */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-2 shrink-0 border-b border-zinc-900/50">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>

            {/* Type Segmented Pill */}
            <div className="flex bg-[#14141a] p-1 rounded-xl border border-zinc-800/80 gap-1">
              {(['expense', 'income', 'transfer'] as const).map((t) => {
                const isAct = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setType(t);
                    }}
                    className={`py-1.5 px-3 sm:px-5 rounded-lg text-xs font-mono font-bold capitalize transition-all cursor-pointer ${
                      isAct ? 'bg-white text-black shadow-xs' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {t === 'expense' ? 'Expense' : t === 'income' ? 'Income' : 'Transfer'}
                  </button>
                );
              })}
            </div>

            <div className="w-8" />
          </div>

          {/* Category Pill Grid (3 columns per row on PC view, taller with more vertical room) */}
          {type !== 'transfer' ? (
            <div className="px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-[280px] md:min-h-[340px] overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-3.5">
                {parentCategories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  const subs = getSubcategories(cat.id);
                  const hasSubs = subs.length > 0;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        triggerHaptic();
                        setSelectedCategoryId(cat.id);
                        setSelectedSubcategoryId(undefined);
                      }}
                      className={`relative p-3 sm:p-4 rounded-2xl flex items-center gap-2.5 cursor-pointer transition-all border min-h-[58px] sm:min-h-[64px] ${
                        isSelected
                          ? 'bg-zinc-200 text-black border-white shadow-md'
                          : 'bg-[#14141a] text-zinc-300 border-zinc-900 hover:border-zinc-800'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-black text-white' : 'bg-zinc-900 text-zinc-300'
                        }`}
                      >
                        <CategoryIcon name={cat.icon || 'Tag'} size={16} />
                      </div>

                      <div className="truncate flex-1 min-w-0">
                        <div className="text-[11px] sm:text-xs font-bold truncate leading-snug" title={cat.name}>{cat.name}</div>
                        {isSelected && selectedSub ? (
                          <div className="text-[9px] sm:text-[10px] text-zinc-700 truncate leading-tight font-medium mt-0.5" title={selectedSub.name}>
                            {selectedSub.name}
                          </div>
                        ) : hasSubs ? (
                          <div className={`text-[9px] sm:text-[10px] truncate leading-tight mt-0.5 ${isSelected ? 'text-zinc-600' : 'text-zinc-500 font-mono'}`}>
                            {subs.length} sub
                          </div>
                        ) : null}
                      </div>

                      {/* Mobile dropdown arrow for subcategories */}
                      {hasSubs && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic();
                            setSelectedCategoryId(cat.id);
                            if (window.innerWidth >= 768) {
                              // Left panel auto opens on PC
                            } else {
                              setActiveDropdownCatId(activeDropdownCatId === cat.id ? null : cat.id);
                            }
                          }}
                          className={`md:hidden w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                            isSelected ? 'bg-black/10 text-black hover:bg-black/20' : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                          title="Pick Subcategory"
                        >
                          <ChevronDown size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>


            </div>
          ) : (
            /* Transfer Wallet to Wallet selector */
            <div className="px-4 py-3 space-y-2">
              <div className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Transfer Between Wallets</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-zinc-500 font-mono block mb-1">From Wallet</span>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-[#14141a] rounded-xl px-3 py-2 text-xs text-white border border-zinc-800 focus-within:outline-none font-mono"
                  >
                    {state.accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[9px] text-zinc-500 font-mono block mb-1">To Wallet</span>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full bg-[#14141a] rounded-xl px-3 py-2 text-xs text-white border border-zinc-800 focus-within:outline-none font-mono"
                  >
                    {state.accounts.filter(a => a.id !== selectedAccountId).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Amount Display Card & Date/Wallet Selectors */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-zinc-900/60 bg-[#0e0e13]">
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              {/* Left: Amount Label & Value Input */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider mb-0.5">
                  {type === 'expense' ? 'Amount' : type === 'income' ? 'Received' : 'Transfer'}
                </div>
                <div className="flex items-center gap-1.5 font-mono text-zinc-200">
                  <span className="text-2xl sm:text-3xl font-bold text-zinc-400">{state.settings.currencySymbol}</span>
                  {!showNumpad ? (
                    <input
                      type="text"
                      value={amountStr}
                      onFocus={(e) => {
                        if (amountStr === '0') {
                          e.target.select();
                        }
                      }}
                      onClick={(e) => {
                        if (amountStr === '0') {
                          (e.target as HTMLInputElement).select();
                        }
                      }}
                      onBlur={() => {
                        if (!amountStr || !amountStr.trim()) {
                          setAmountStr('0');
                        }
                      }}
                      onChange={(e) => {
                        let clean = e.target.value.replace(/[^0-9.+\-\s]/g, '');
                        // Strip leading zeroes before digits (e.g. '020' -> '20', '00' -> '0')
                        clean = clean
                          .replace(/(^|[+\-\s])0+([1-9])/g, '$1$2')
                          .replace(/(^|[+\-\s])0+(0(?:\D|$))/g, '$1$2');
                        setAmountStr(clean);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === '=') {
                          e.preventDefault();
                          setAmountStr(evaluateAmountExpression(amountStr));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (/[+-]/.test(amountStr)) {
                            setAmountStr(evaluateAmountExpression(amountStr));
                          } else {
                            executeSubmit();
                          }
                        }
                      }}
                      className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight bg-transparent focus:outline-none w-64 transition-colors"
                      placeholder="0"
                      autoFocus
                    />
                  ) : (
                    <span className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight overflow-x-auto no-scrollbar whitespace-nowrap">
                      {formatAmountDisplay(amountStr)}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Date & Wallet Selectors */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                {/* Date & Time Pill */}
                <button
                  type="button"
                  onClick={handleOpenDateTime}
                  className={`flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border transition-all cursor-pointer shadow-sm group ${
                    activeRightPanel === 'datetime'
                      ? 'bg-white text-black border-white'
                      : 'bg-[#14141a] hover:bg-[#1b1b22] border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className={`hidden sm:flex w-8 h-8 rounded-lg items-center justify-center shrink-0 transition-colors ${
                    activeRightPanel === 'datetime' ? 'bg-black text-white' : 'bg-zinc-900 text-zinc-400 group-hover:text-white'
                  }`}>
                    <CalendarIcon size={15} />
                  </div>
                  <div className="text-center sm:text-left font-mono">
                    <div className={`text-xs font-bold leading-tight ${activeRightPanel === 'datetime' ? 'text-black' : 'text-white'}`}>
                      {isToday ? 'Today' : date}
                    </div>
                    <div className={`hidden sm:block text-[10px] leading-tight mt-0.5 ${activeRightPanel === 'datetime' ? 'text-zinc-700' : 'text-zinc-500'}`}>{time}</div>
                  </div>
                </button>

                {/* Wallet Pill */}
                <button
                  type="button"
                  onClick={handleOpenAccount}
                  className={`flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border transition-all cursor-pointer shadow-sm group ${
                    activeRightPanel === 'account'
                      ? 'bg-white text-black border-white'
                      : 'bg-[#14141a] hover:bg-[#1b1b22] border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className={`hidden sm:flex w-8 h-8 rounded-lg items-center justify-center shrink-0 transition-colors ${
                    activeRightPanel === 'account' ? 'bg-black text-white' : 'bg-zinc-900 text-zinc-400 group-hover:text-white'
                  }`}>
                    <WalletIcon size={15} />
                  </div>
                  <div className="text-center sm:text-left font-mono">
                    <div className={`text-xs font-bold leading-tight truncate max-w-[85px] sm:max-w-none ${activeRightPanel === 'account' ? 'text-black' : 'text-white'}`}>
                      {selectedAccount?.name || 'Wallet'}
                    </div>
                    <div className={`hidden sm:block text-[10px] leading-tight mt-0.5 ${activeRightPanel === 'account' ? 'text-zinc-700' : 'text-zinc-500'}`}>Account</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Note / Memo Section (Dedicated Full-Width Row Outside Amount Card) */}
          <div className="px-4 sm:px-6 py-2 sm:py-3 bg-[#0c0c10] border-t border-zinc-900/80">
            <label className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider block mb-1">
              Note / Memo
            </label>
            <div className="flex items-center gap-2.5 bg-[#14141a] rounded-2xl px-3.5 sm:px-4 py-2 sm:py-3 border border-zinc-800/80 focus-within:border-zinc-600 transition-all">
              <FileText size={16} className="text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Add memo, note, or description..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-white focus:outline-none font-mono placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Touch Keypad Grid for Mobile (showNumpad) matching mobile design reference */}
          {showNumpad && (() => {
            const hasPendingOp = /[+-]/.test(amountStr);
            return (
              <div className="px-4 py-2.5 sm:py-3 bg-[#0a0a0d] border-t border-zinc-900/80 space-y-2 shrink-0 font-mono">
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {/* Row 1: 1, 2, 3, + */}
                  {['1', '2', '3', '+'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKeypadPress(k)}
                      className={`py-3.5 sm:py-3 rounded-2xl font-bold text-base transition-all active:scale-95 cursor-pointer border ${
                        k === '+'
                          ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'
                          : 'bg-[#14141a] text-white border-zinc-800/80 hover:bg-zinc-800'
                      }`}
                    >
                      {k}
                    </button>
                  ))}

                  {/* Row 2: 4, 5, 6, - */}
                  {['4', '5', '6', '-'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKeypadPress(k)}
                      className={`py-3.5 sm:py-3 rounded-2xl font-bold text-base transition-all active:scale-95 cursor-pointer border ${
                        k === '-'
                          ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'
                          : 'bg-[#14141a] text-white border-zinc-800/80 hover:bg-zinc-800'
                      }`}
                    >
                      {k}
                    </button>
                  ))}

                  {/* Row 3: 7, 8, 9, back */}
                  {['7', '8', '9', 'back'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleKeypadPress(k)}
                      className={`py-3.5 sm:py-3 rounded-2xl font-bold text-base transition-all active:scale-95 cursor-pointer border flex items-center justify-center ${
                        k === 'back'
                          ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                          : 'bg-[#14141a] text-white border-zinc-800/80 hover:bg-zinc-800'
                      }`}
                    >
                      {k === 'back' ? '⌫' : k}
                    </button>
                  ))}

                  {/* Row 4: 0, ., C, = / Save */}
                  {['0', '.', 'C', hasPendingOp ? '=' : 'Save'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        if (k === 'Save') {
                          executeSubmit();
                        } else if (k === '=') {
                          handleKeypadPress('=');
                        } else {
                          handleKeypadPress(k);
                        }
                      }}
                      disabled={k === 'Save' && parseFormattedNumber(amountStr) <= 0}
                      className={`py-3.5 sm:py-3 rounded-2xl font-bold text-base transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                        k === 'Save'
                          ? 'bg-white text-black border-white hover:bg-zinc-200 disabled:opacity-30 disabled:pointer-events-none shadow-md'
                          : k === '='
                          ? 'bg-white text-black border-white hover:bg-zinc-200 font-black text-2xl shadow-md'
                          : k === 'C'
                          ? 'bg-red-950/40 text-red-400 border-red-900/50 hover:bg-red-900/50'
                          : 'bg-[#14141a] text-white border-zinc-800/80 hover:bg-zinc-800'
                      }`}
                    >
                      {k === 'Save' ? <Check size={18} strokeWidth={3} /> : k}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Save Transaction Action Button (Inside Main Card Bottom for Desktop) */}
          {!showNumpad && (
            <div className="px-5 sm:px-6 py-3.5 bg-[#0a0a0d] border-t border-zinc-900 flex justify-end shrink-0">
              <button
                type="button"
                onClick={executeSubmit}
                disabled={parseFormattedNumber(amountStr) <= 0}
                className="px-8 py-3 bg-white hover:bg-zinc-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-black font-mono text-sm font-bold rounded-2xl cursor-pointer shadow-lg transition-all flex items-center gap-2"
              >
                <Check size={18} strokeWidth={3} />
                <span>Save Transaction</span>
              </button>
            </div>
          )}

        </div>

        {/* 3. RIGHT SIDE PANEL: Date & Time or Account Selector (Behind Main Card z-10) */}
        <div 
          className={`hidden md:flex relative z-10 transition-all duration-300 ease-out ${
            activeRightPanel ? 'w-60 lg:w-64 opacity-100 pointer-events-auto' : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div 
            style={{
              transform: activeRightPanel ? 'translateX(0)' : 'translateX(calc(-100% - 12px))'
            }}
            className="w-60 lg:w-64 flex flex-col gap-3 overflow-y-auto no-scrollbar h-full font-mono shrink-0 transition-transform duration-300 ease-out"
          >
            {(activeRightPanel || lastRightPanel) === 'datetime' ? (
              <div key="datetime" className="flex flex-col gap-3 h-full animate-fade-in">
                
                {/* 1. TOP CARD: Calendar Card (Separate Card with Fixed 6-Row Grid) */}
                <div className="bg-[#0c0c10] border border-zinc-900 rounded-3xl p-4 shadow-2xl space-y-3 shrink-0">
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
                      className="w-7 h-7 rounded-xl bg-[#14141a] border border-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-bold text-white tracking-wide">
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
                      className="w-7 h-7 rounded-xl bg-[#14141a] border border-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                      <span key={day} className="text-[9px] font-bold text-zinc-500 py-1">
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Calendar Days Grid (Always 42 cells so height stays 100% fixed) */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((item, idx) => {
                      const isSelected = item.isCurrentMonth && item.dateStr === date;
                      const isTodayDate = item.dateStr === new Date().toISOString().split('T')[0];

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (item.dateStr) {
                              triggerHaptic();
                              setDate(item.dateStr);
                            }
                          }}
                          disabled={!item.isCurrentMonth}
                          className={`h-7 rounded-full text-xs font-medium flex items-center justify-center transition-all cursor-pointer ${
                            !item.isCurrentMonth
                              ? 'text-zinc-700/60 pointer-events-none'
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
                </div>

                {/* 2. MIDDLE CARD: Time Wheel Card (Expanded to fill available height matching main card) */}
                <div className="bg-[#0c0c10] border border-zinc-900 rounded-3xl p-3.5 sm:p-4 shadow-2xl flex-1 flex flex-col min-h-0 justify-between">
                  <div className="flex items-center justify-between px-1 shrink-0 mb-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Select Time</span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        const now = new Date();
                        const hh = String(now.getHours()).padStart(2, '0');
                        const mm = String(now.getMinutes()).padStart(2, '0');
                        setTime(`${hh}:${mm}`);
                      }}
                      className="text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Set to Now
                    </button>
                  </div>

                  {/* Time Wheel (flex-1 expands naturally to show 2 values up, center selected, 2 values down) */}
                  <div className="flex-1 min-h-[170px] relative overflow-hidden flex items-center justify-center">
                    <TimeWheelPicker
                      time={time}
                      setTime={setTime}
                      active={activeRightPanel === 'datetime'}
                      heightClass="h-full"
                      gradientBg="from-[#0c0c10]"
                    />
                  </div>
                </div>

                {/* 3. BOTTOM CARD: Standalone Card for Done Button */}
                <div className="bg-[#0c0c10] border border-zinc-900 rounded-3xl p-3 shadow-2xl shrink-0">
                  <button
                    type="button"
                    onClick={() => openRightPanel(null)}
                    className="w-full py-3.5 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-2xl cursor-pointer shadow-md transition-all active:scale-98"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Wallet/Account Selector Card */
              <div key="account" className="bg-[#0c0c10] border border-zinc-900 rounded-3xl p-4 shadow-2xl space-y-2 flex-1 overflow-y-auto animate-fade-in">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-900 shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Select Account</span>
                  <button
                    type="button"
                    onClick={() => openRightPanel(null)}
                    className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
                {state.accounts.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedAccountId(acc.id);
                        openRightPanel(null);
                      }}
                      className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-between text-xs transition-all cursor-pointer min-h-[48px] ${
                        isSelected
                          ? 'bg-white text-black font-bold'
                          : 'bg-[#14141a] text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <WalletIcon size={14} className={isSelected ? 'text-black' : 'text-zinc-400'} />
                        <span className="font-bold">{acc.name}</span>
                      </div>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

        {/* Popups & Modals */}
        {/* 1. Subcategory Picker Modal (For mobile click) */}
        {activeDropdownCatId && (
          <div 
            className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setActiveDropdownCatId(null)}
          >
            <div 
              className="w-full max-w-xs bg-[#101014] border border-zinc-800 rounded-2xl p-4 shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                    <CategoryIcon name={state.categories.find(c => c.id === activeDropdownCatId)?.icon || 'Tag'} size={13} />
                  </div>
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    {state.categories.find(c => c.id === activeDropdownCatId)?.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDropdownCatId(null)}
                  className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="space-y-1 max-h-60 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setSelectedCategoryId(activeDropdownCatId);
                    setSelectedSubcategoryId(undefined);
                    setActiveDropdownCatId(null);
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                    selectedCategoryId === activeDropdownCatId && selectedSubcategoryId === undefined
                      ? 'bg-white text-black font-bold'
                      : 'bg-[#14141a] text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>All / General</span>
                  {selectedCategoryId === activeDropdownCatId && selectedSubcategoryId === undefined && (
                    <Check size={14} strokeWidth={3} />
                  )}
                </button>

                {getSubcategories(activeDropdownCatId).map((sub) => {
                  const isSelected = selectedCategoryId === activeDropdownCatId && selectedSubcategoryId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedCategoryId(activeDropdownCatId);
                        setSelectedSubcategoryId(sub.id);
                        setActiveDropdownCatId(null);
                      }}
                      className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black font-bold'
                          : 'bg-[#14141a] text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CategoryIcon name={sub.icon || 'Tag'} size={13} className="text-zinc-400" />
                        <span className="truncate">{sub.name}</span>
                      </div>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2. Quick Wallet Selector Modal (Mobile) */}
        {showAccountPicker && (
          <div 
            className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setShowAccountPicker(false)}
          >
            <div 
              className="w-full max-w-xs bg-[#101014] border border-zinc-800 rounded-2xl p-4 shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Select Wallet</span>
                <button
                  type="button"
                  onClick={() => setShowAccountPicker(false)}
                  className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {state.accounts.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedAccountId(acc.id);
                        setShowAccountPicker(false);
                      }}
                      className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black font-bold'
                          : 'bg-[#14141a] text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <WalletIcon size={14} className={isSelected ? 'text-black' : 'text-zinc-400'} />
                        <span className="font-bold">{acc.name}</span>
                      </div>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. Custom Date & Time Selector Modal (Mobile) */}
        {showDateTimePicker && (
          <div 
            className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setShowDateTimePicker(false)}
          >
            <div 
              className="w-full max-w-sm bg-[#101014] border border-zinc-800 rounded-2xl md:rounded-3xl p-5 shadow-2xl space-y-4 font-mono max-h-[90vh] overflow-y-auto no-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2.5 text-white">
                  <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300">
                    <CalendarIcon size={16} />
                  </div>
                  <span className="text-sm font-bold uppercase tracking-wider">Date & Time</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDateTimePicker(false)}
                  className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* 1. TOP CARD: Calendar Widget */}
              <div className="bg-[#14141a] border border-zinc-800/80 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      const current = new Date(calendarYear, calendarMonth - 1, 1);
                      setCalendarYear(current.getFullYear());
                      setCalendarMonth(current.getMonth());
                    }}
                    className="w-7 h-7 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-bold text-white tracking-wide">
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
                    className="w-7 h-7 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                    <span key={day} className="text-[9px] font-bold text-zinc-500 py-1">
                      {day}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((item, idx) => {
                    const isSelected = item.isCurrentMonth && item.dateStr === date;
                    const isTodayDate = item.dateStr === new Date().toISOString().split('T')[0];

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (item.dateStr) {
                            triggerHaptic();
                            setDate(item.dateStr);
                          }
                        }}
                        disabled={!item.isCurrentMonth}
                        className={`h-7 rounded-full text-xs font-medium flex items-center justify-center transition-all cursor-pointer ${
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
              </div>

              {/* 2. BOTTOM CARD: Scrollable Time Wheel Picker */}
              <div className="bg-[#14141a] border border-zinc-800/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Select Time</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      const now = new Date();
                      const hh = String(now.getHours()).padStart(2, '0');
                      const mm = String(now.getMinutes()).padStart(2, '0');
                      setTime(`${hh}:${mm}`);
                    }}
                    className="text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Set to Now
                  </button>
                </div>

                {/* Time Wheel directly on outer card matching Desktop height & handlers */}
                <TimeWheelPicker
                  time={time}
                  setTime={setTime}
                  active={showDateTimePicker}
                  heightClass="h-56"
                  paddingClass="py-[96px]"
                  gradientBg="from-[#14141a]"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowDateTimePicker(false)}
                className="w-full py-3 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        )}
    </div>
  );
};
