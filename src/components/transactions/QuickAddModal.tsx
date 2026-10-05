import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Check, 
  Calendar as CalendarIcon, 
  Wallet as WalletIcon, 
  FileText, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpDown
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionType } from '../../types/finance';
import { CategoryIcon, formatCurrency } from '../common/Icons';
import { parseFormattedNumber, formatAmountDisplay } from '../common/CurrencyInput';
import { TimeWheelPicker } from '../common/TimeWheelPicker';
import { useBackButton } from '../../hooks/useBackButton';
import { useDelayedUnmount } from '../../hooks/useDelayedUnmount';


interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, defaultAccountId }) => {
  useBackButton(isOpen, onClose);
  const { state, accountBalances, addTransaction, triggerHaptic } = useFinance();

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

  // Modal stack: each sub-modal has its own independent open state so tapping outside
  // only closes the topmost sub-modal, never the whole QuickAdd.
  const [activeRightPanel, setActiveRightPanel] = useState<'datetime' | 'account' | null>(null);
  const [showAccountPickerModal, setShowAccountPickerModal] = useState(false);
  const [showDateTimePickerModal, setShowDateTimePickerModal] = useState(false);

  const openRightPanel = (panel: 'datetime' | 'account' | null) => {
    setActiveRightPanel(panel);
  };

  const openAccountPicker = () => setShowAccountPickerModal(true);
  const closeAccountPicker = () => setShowAccountPickerModal(false);
  const openDateTimePicker = () => setShowDateTimePickerModal(true);
  const closeDateTimePicker = () => setShowDateTimePickerModal(false);



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

  // Panels stay mounted for the length of their collapse so they slide back behind the main
  // card instead of vanishing the instant selection changes.
  const renderedRightPanel = useDelayedUnmount(activeRightPanel);
  const renderedLeftCategory = useDelayedUnmount(
    hasSubcategories && displayCategory ? displayCategory.id : null
  );

  // Keep the account picker mounted during its close animation.
  const renderedAccountPicker = useDelayedUnmount(showAccountPickerModal);
  const renderedDateTimePicker = useDelayedUnmount(showDateTimePickerModal);

  // Quick Date format for badge
  const isToday = date === new Date().toISOString().split('T')[0];

  const handleOpenDateTime = () => {
    triggerHaptic();
    if (window.innerWidth >= 768) {
      openRightPanel(activeRightPanel === 'datetime' ? null : 'datetime');
    } else {
      openDateTimePicker();
    }
  };

  const handleOpenAccount = () => {
    triggerHaptic();
    if (window.innerWidth >= 768) {
      openRightPanel(activeRightPanel === 'account' ? null : 'account');
    } else {
      openAccountPicker();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none p-0 sm:p-4"
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
        className="flex items-stretch justify-center sm:gap-3 w-full max-w-full sm:max-w-4xl lg:max-w-6xl transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. LEFT SIDE PANEL: Subcategories (Behind Main Card z-10) */}
        <div 
          className={`hidden md:flex relative z-10 overflow-hidden transition-[width] ${
            hasSubcategories
              ? 'w-60 lg:w-64 duration-[340ms] ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto'
              : 'w-0 duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none'
          }`}
        >
          {renderedLeftCategory && (
            <div 
              className="w-60 lg:w-64 bg-[#0c0c10] border border-zinc-900 rounded-3xl flex flex-col p-4 overflow-y-auto shadow-2xl h-full font-mono shrink-0"
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
          )}
        </div>

        {/* 2. MAIN CARD: Category Grid (3 cols on PC), Amount Display, Note Input, Save Button (Elevated z-20 so side panels emerge behind it) */}
        <div className="relative z-20 w-full h-[100dvh] sm:h-[600px] lg:h-[620px] sm:max-h-[92vh] sm:w-[580px] lg:w-[620px] bg-[#0c0c10] sm:border border-zinc-800 rounded-none sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl safe-top safe-bottom select-none shrink-0">
          
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

          {/* Category Pill Grid or Transfer Flow (flex-1 fill so card height never changes) */}
          {type !== 'transfer' ? (
            /* Distinct keys: the two branches must not share a DOM node, otherwise React morphs
               the category grid into the transfer cards (and back), animating their geometry. */
            <div key={`category-grid-${type}`} className="animate-content-swap px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3.5">
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
                      className={`relative p-2.5 sm:p-4 rounded-2xl flex items-center gap-2 sm:gap-2.5 cursor-pointer transition-all border min-h-[54px] sm:min-h-[64px] ${
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
                        {isSelected && selectedSub && (
                          <div className="text-[9px] sm:text-[10px] text-zinc-700 truncate leading-tight font-medium mt-0.5" title={selectedSub.name}>
                            {selectedSub.name}
                          </div>
                        )}
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
            /* Redesigned Transfer Section: Top Account -> Clean Swap Row (No Overlap) -> Bottom Account */
            <div key="transfer-flow" className="animate-content-swap px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 overflow-y-auto flex flex-col font-mono space-y-0">
              {/* From Wallet Card */}
              <div className="w-full bg-[#14141a] p-4 rounded-2xl border border-zinc-800/80 hover:border-zinc-700 transition-colors">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">
                  From
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shrink-0">
                      <WalletIcon size={18} />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-white truncate">{state.accounts.find(a => a.id === selectedAccountId)?.name || 'Account'}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Balance: {formatCurrency(accountBalances[selectedAccountId] ?? 0, state.settings.currencySymbol)}
                      </div>
                    </div>
                  </div>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => {
                      triggerHaptic();
                      const val = e.target.value;
                      setSelectedAccountId(val);
                      if (val === toAccountId) {
                        const other = state.accounts.find(a => a.id !== val)?.id || '';
                        setToAccountId(other);
                      }
                    }}
                    className="bg-zinc-900 border border-zinc-700/80 text-white rounded-xl px-2.5 py-1.5 text-xs font-mono cursor-pointer focus:outline-none"
                  >
                    {state.accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Swap + Account Picker Row */}
              <div className="flex items-center justify-center gap-2 py-2.5 z-10">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    const from = selectedAccountId;
                    const to = toAccountId;
                    setSelectedAccountId(to);
                    setToAccountId(from);
                  }}
                  className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-300 hover:text-white flex items-center justify-center shadow-md active:scale-90 transition-all cursor-pointer"
                  title="Swap Accounts"
                >
                  <ArrowUpDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    if (window.innerWidth >= 768) {
                      openRightPanel(activeRightPanel === 'account' ? null : 'account');
                    } else {
                      openAccountPicker();
                    }
                  }}
                  className="text-[10px] font-mono font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Change Account
                </button>
              </div>

              {/* To Wallet Card */}
              <div className="w-full bg-[#14141a] p-4 rounded-2xl border border-zinc-800/80 hover:border-zinc-700 transition-colors">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">
                  To
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shrink-0">
                      <WalletIcon size={18} />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-white truncate">{state.accounts.find(a => a.id === toAccountId)?.name || 'Account'}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Balance: {formatCurrency(accountBalances[toAccountId] ?? 0, state.settings.currencySymbol)}
                      </div>
                    </div>
                  </div>
                  <select
                    value={toAccountId}
                    onChange={(e) => {
                      triggerHaptic();
                      setToAccountId(e.target.value);
                    }}
                    className="bg-zinc-900 border border-zinc-700/80 text-white rounded-xl px-2.5 py-1.5 text-xs font-mono cursor-pointer focus:outline-none"
                  >
                    {state.accounts.filter(a => a.id !== selectedAccountId).map(a => (
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
              {/* Left: Amount Value Input */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-mono text-zinc-200">
                  <span className="text-2xl sm:text-3xl font-bold text-zinc-400">{state.settings.currencySymbol}</span>
                  {!showNumpad ? (
                    <input
                      type="text"
                      value={amountStr}
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
                      {selectedAccount?.name || 'Account'}
                    </div>
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
        {/* Height is pinned to the main card so the TimeWheelPicker's h-full always resolves to a
            definite height. Without it the wheel's own content inflates the panel, which inflates
            the centering padding and breaks the whole modal layout (runaway resize loop). */}
        <div 
          className={`hidden md:flex justify-end relative z-10 overflow-hidden transition-[width] sm:h-[600px] lg:h-[620px] sm:max-h-[92vh] ${
            activeRightPanel
              ? 'w-60 lg:w-64 duration-[340ms] ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto'
              : 'w-0 duration-[240ms] ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none'
          }`}
        >
          {renderedRightPanel && (
            <div 
              className="w-60 lg:w-64 flex flex-col gap-3 overflow-y-auto no-scrollbar h-full font-mono shrink-0"
            >
              {renderedRightPanel === 'datetime' ? (
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
          )}
        </div>

      </div>

        {/* Popups & Modals */}
        {/* 1. Subcategory Picker Modal (For mobile click) */}
        {activeDropdownCatId && (
          <div 
            className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in cursor-pointer select-none"
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

        {/* 2. Shared Account Picker Sub-Modal (mobile) — same design as Expenses page account selector.
            Backdrop click closes ONLY this sub-modal, never the parent QuickAdd. */}
        {renderedAccountPicker && (
          <div 
            className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in cursor-pointer select-none"
            onClick={closeAccountPicker}
          >
            <div 
              className="w-full sm:max-w-xs bg-[#0c0c10] sm:border border-zinc-800 rounded-none sm:rounded-3xl sm:max-h-[85vh] flex flex-col shadow-2xl safe-bottom cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="flex justify-center py-2 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-zinc-700" />
              </div>

              <div className="flex items-center justify-between px-4 sm:px-5 pt-3 sm:pt-4 pb-2 sm:pb-3 border-b border-zinc-800/80 shrink-0">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Select Account</span>
                <button
                  type="button"
                  onClick={closeAccountPicker}
                  className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 p-2 sm:p-3">
                {state.accounts.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedAccountId(acc.id);
                        closeAccountPicker();
                      }}
                      className={`w-full py-3 px-4 rounded-xl flex items-center justify-between text-xs font-mono transition-all cursor-pointer min-h-[48px] ${
                        isSelected
                          ? 'bg-white text-black font-bold shadow-xs'
                          : 'bg-[#14141a] text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <WalletIcon size={14} className={isSelected ? 'text-black' : 'text-zinc-400'} />
                        <span className="font-bold truncate">{acc.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase">({acc.type})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {formatCurrency(accountBalances[acc.id] ?? 0, state.settings.currencySymbol)}
                        </span>
                        {isSelected && <Check size={14} strokeWidth={3} className="text-black" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!showNumpad && (
                <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-[#0c0c10] shrink-0 safe-bottom">
                  <button
                    type="button"
                    onClick={closeAccountPicker}
                    className="w-full py-2.5 bg-white hover:bg-zinc-200 text-black text-xs font-mono font-bold rounded-xl cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Shared DateTime Picker Sub-Modal (mobile) — backdrop closes only this sub-modal. */}
        {renderedDateTimePicker && (
          <div 
            className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in cursor-pointer select-none"
            onClick={closeDateTimePicker}
          >
            <div 
              className="w-full sm:max-w-sm bg-[#0c0c10] sm:border border-zinc-800 rounded-none sm:rounded-3xl sm:max-h-[85vh] flex flex-col shadow-2xl safe-bottom cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="flex justify-center py-2 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-zinc-700" />
              </div>

              <div className="flex items-center justify-between px-4 sm:px-5 pt-3 sm:pt-4 pb-2 sm:pb-3 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5 text-white">
                  <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300">
                    <CalendarIcon size={16} />
                  </div>
                  <span className="text-sm font-bold text-white uppercase tracking-wider">Date & Time</span>
                </div>
                <button
                  type="button"
                  onClick={closeDateTimePicker}
                  className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-3">
                {/* Calendar Widget */}
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

                {/* Time Wheel */}
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

                  <TimeWheelPicker
                    time={time}
                    setTime={setTime}
                    active={renderedDateTimePicker}
                    heightClass="h-48"
                    paddingClass="py-[80px]"
                    gradientBg="from-[#14141a]"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-[#0c0c10] shrink-0 safe-bottom">
                <button
                  type="button"
                  onClick={closeDateTimePicker}
                  className="w-full py-2.5 bg-white hover:bg-zinc-200 text-black text-xs font-mono font-bold rounded-xl cursor-pointer shadow-md transition-all active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
