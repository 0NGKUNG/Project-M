import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Trash2,
  AlertTriangle,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  ArrowUpDown
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import type { Transaction, TransactionType } from '../../types/finance';
import { CategoryIcon, formatCurrency } from '../common/Icons';
import { formatAmountDisplay, evaluateAmountExpression, parseFormattedNumber } from '../common/CurrencyInput';
import { TimeWheelPicker } from '../common/TimeWheelPicker';
import { useBackButton } from '../../hooks/useBackButton';

interface EditTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
}

const getCurrentTimeStr = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  onClose,
}) => {
  useBackButton(true, onClose);
  const { state, accountBalances, updateTransaction, deleteTransaction, triggerHaptic } = useFinance();


  const [type, setType] = useState<TransactionType>(transaction.type);
  const [amountStr, setAmountStr] = useState<string>(() => String(transaction.amount));
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(transaction.categoryId);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>(transaction.subcategoryId);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(transaction.accountId);
  const [toAccountId, setToAccountId] = useState<string>(
    transaction.toAccountId || state.accounts.find((a) => a.id !== transaction.accountId)?.id || state.accounts[0]?.id || ''
  );
  const [date, setDate] = useState<string>(transaction.date);
  const [time, setTime] = useState<string>(transaction.time || getCurrentTimeStr());
  const [note, setNote] = useState<string>(transaction.note || '');

  // UI state
  const [showNumpad, setShowNumpad] = useState<boolean>(() => window.innerWidth < 768);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Desktop side panel & mobile drawer states
  const [activeRightPanel, setActiveRightPanel] = useState<'datetime' | 'account' | null>(null);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [activeDropdownCatId, setActiveDropdownCatId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastCategoryWithSubsRef = useRef<typeof state.categories[0] | null>(null);

  // Custom Calendar state for Date Picker
  const [calendarYear, setCalendarYear] = useState<number>(() => {
    const d = new Date(transaction.date);
    return isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  });
  const [calendarMonth, setCalendarMonth] = useState<number>(() => {
    const d = new Date(transaction.date);
    return isNaN(d.getMonth()) ? new Date().getMonth() : d.getMonth();
  });

  // Cleanup active delete timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  // Compute month calendar days grid (42 cells: 6 weeks fixed)
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    const startOffset = (firstDayIndex + 6) % 7;
    const days: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        dateStr: '',
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(calendarMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        day: d,
        dateStr: `${calendarYear}-${mStr}-${dStr}`,
        isCurrentMonth: true,
      });
    }

    // Next month padding to keep fixed 6 rows (42 total cells)
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

  // Top level categories matching type
  const parentCategories = state.categories.filter(
    (c) => !c.parentId && c.type === (type === 'income' ? 'income' : 'expense')
  );

  const getSubcategories = (catId: string) => state.categories.filter((c) => c.parentId === catId);

  // Responsive resize handler
  useEffect(() => {
    const handleResize = () => {
      setShowNumpad(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowDateTimePicker(false);
        setShowAccountPicker(false);
      } else {
        setActiveRightPanel(null);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const openRightPanel = (panel: 'datetime' | 'account' | null) => {
    triggerHaptic();
    setActiveRightPanel(panel);
  };

  // Two-tap inline delete handler
  const handleDeleteClick = () => {
    triggerHaptic();
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = setTimeout(() => {
        setIsConfirmingDelete(false);
      }, 3500);
    } else {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      deleteTransaction(transaction.id);
      onClose();
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

  const handleSave = () => {
    const computed = evaluateAmountExpression(amountStr);
    const parsedAmount = parseFormattedNumber(computed);
    if (!parsedAmount || parsedAmount <= 0) return;

    updateTransaction({
      ...transaction,
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

    onClose();
  };

  const selectedAccount = state.accounts.find((a) => a.id === selectedAccountId);
  const selectedCategory = state.categories.find((c) => c.id === selectedCategoryId);
  const selectedSub = state.categories.find((c) => c.id === selectedSubcategoryId);
  const currentSubcategories = selectedCategory ? getSubcategories(selectedCategory.id) : [];
  const hasSubcategories = type !== 'transfer' && currentSubcategories.length > 0;

  if (selectedCategory && currentSubcategories.length > 0) {
    lastCategoryWithSubsRef.current = selectedCategory;
  }
  const displayCategory = hasSubcategories ? selectedCategory : (lastCategoryWithSubsRef.current || selectedCategory);
  const displaySubcategories = displayCategory ? getSubcategories(displayCategory.id) : [];

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

      {/* Multi-Panel Wrapper for Desktop */}
      <div 
        className="flex items-stretch justify-center sm:gap-3 w-full max-w-full sm:max-w-4xl lg:max-w-6xl transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. LEFT PANEL: Subcategories (Desktop) */}
        <div 
          className={`hidden md:flex justify-end relative z-10 overflow-hidden transition-all duration-300 ease-out ${
            hasSubcategories ? 'w-60 lg:w-64 opacity-100 translate-x-0 pointer-events-auto' : 'w-0 opacity-0 translate-x-16 pointer-events-none'
          }`}
        >
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
        </div>

        {/* 2. MAIN CARD: Responsive Form */}
        <div className="relative z-20 w-full h-[100dvh] sm:h-[600px] lg:h-[620px] sm:max-h-[92vh] sm:w-[580px] lg:w-[620px] bg-[#0c0c10] sm:border border-zinc-900 rounded-none sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl safe-top safe-bottom select-none shrink-0">
          
          {/* Top Bar: Back/Close + Type Switcher Pills + Inline Delete Button */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-2 shrink-0 border-b border-zinc-900/50">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Close"
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
                    {t === 'expense' ? (
                      <span className="flex items-center gap-1.5">
                        <ArrowDownRight size={13} className={isAct ? 'text-rose-500' : 'text-rose-400'} />
                        Expense
                      </span>
                    ) : t === 'income' ? (
                      <span className="flex items-center gap-1.5">
                        <ArrowUpRight size={13} className={isAct ? 'text-emerald-500' : 'text-emerald-400'} />
                        Income
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <ArrowRightLeft size={13} className={isAct ? 'text-blue-500' : 'text-blue-400'} />
                        Transfer
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Inline Two-Tap Delete Button in Top Bar */}
            <button
              type="button"
              onClick={handleDeleteClick}
              className={`h-8 rounded-xl flex items-center justify-center gap-1.5 px-2.5 transition-all cursor-pointer font-mono text-xs font-bold ${
                isConfirmingDelete
                  ? 'bg-rose-600 text-white shadow-lg animate-pulse ring-2 ring-rose-500/50'
                  : 'bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400'
              }`}
              title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete transaction'}
            >
              {isConfirmingDelete ? (
                <>
                  <AlertTriangle size={14} className="shrink-0" />
                  <span className="hidden xs:inline">Confirm?</span>
                </>
              ) : (
                <Trash2 size={15} />
              )}
            </button>
          </div>

          {/* Category Grid or Transfer Flow (flex-1 fill so card height never changes) */}
          {type !== 'transfer' ? (
            <div className="px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 overflow-y-auto">
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
                        if (selectedCategoryId !== cat.id) {
                          setSelectedSubcategoryId(undefined);
                        }
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
                        <div className="text-[11px] sm:text-xs font-bold truncate leading-snug" title={cat.name}>
                          {cat.name}
                        </div>
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
                            if (window.innerWidth < 768) {
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

              {/* Mobile Subcategory Inline Dropdown Drawer */}
              {activeDropdownCatId && (
                <div className="md:hidden mt-3 p-3 bg-[#101014] border border-zinc-800 rounded-2xl space-y-2 animate-fade-in font-mono">
                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider pb-1 border-b border-zinc-900">
                    <span>Subcategory</span>
                    <button
                      type="button"
                      onClick={() => setActiveDropdownCatId(null)}
                      className="text-zinc-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedSubcategoryId(undefined);
                        setActiveDropdownCatId(null);
                      }}
                      className={`p-2 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                        selectedSubcategoryId === undefined ? 'bg-white text-black font-bold' : 'bg-[#16161d] text-zinc-300'
                      }`}
                    >
                      <span className="truncate">General</span>
                      {selectedSubcategoryId === undefined && <Check size={12} strokeWidth={3} />}
                    </button>
                    {getSubcategories(activeDropdownCatId).map((sub) => {
                      const isSubSelected = selectedSubcategoryId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setSelectedSubcategoryId(sub.id);
                            setActiveDropdownCatId(null);
                          }}
                          className={`p-2 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                            isSubSelected ? 'bg-white text-black font-bold' : 'bg-[#16161d] text-zinc-300'
                          }`}
                        >
                          <span className="truncate">{sub.name}</span>
                          {isSubSelected && <Check size={12} strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Redesigned Transfer Section: Top Account -> Clean Swap Row (No Overlap) -> Bottom Account */
            <div className="px-4 sm:px-6 py-4 sm:py-6 flex-1 min-h-0 overflow-y-auto flex flex-col justify-start sm:justify-center font-mono space-y-0">
              {/* From Wallet Card */}
              <div className="w-full bg-[#14141a] p-4 rounded-2xl border border-zinc-800/80 hover:border-zinc-700 transition-all">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">
                  From
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shrink-0">
                      <WalletIcon size={18} />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-white truncate">{state.accounts.find(a => a.id === selectedAccountId)?.name || 'Wallet'}</div>
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

              {/* Clean Swap Button Row - No negative margins, no overlapping borders */}
              <div className="flex items-center justify-center py-2.5 z-10">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    const from = selectedAccountId;
                    const to = toAccountId;
                    setSelectedAccountId(to);
                    setToAccountId(from);
                  }}
                  className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-300 hover:text-white flex items-center justify-center shadow-md active:scale-90 transition-all cursor-pointer"
                  title="Swap Wallets"
                >
                  <ArrowUpDown size={15} />
                </button>
              </div>

              {/* To Wallet Card */}
              <div className="w-full bg-[#14141a] p-4 rounded-2xl border border-zinc-800/80 hover:border-zinc-700 transition-all">
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">
                  To
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shrink-0">
                      <WalletIcon size={18} />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-white truncate">{state.accounts.find(a => a.id === toAccountId)?.name || 'Wallet'}</div>
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
              {/* Left: Amount Label & Value Input */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-mono text-zinc-200">
                  <span className="text-2xl sm:text-3xl font-bold text-zinc-400">{state.settings.currencySymbol}</span>
                  {!showNumpad ? (
                    <input
                      type="text"
                      value={amountStr}
                      onFocus={(e) => {
                        if (amountStr === '0') e.target.select();
                      }}
                      onClick={(e) => {
                        if (amountStr === '0') (e.target as HTMLInputElement).select();
                      }}
                      onBlur={() => {
                        if (!amountStr || !amountStr.trim()) setAmountStr('0');
                      }}
                      onChange={(e) => {
                        let clean = e.target.value.replace(/[^0-9.+\-\s]/g, '');
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
                            handleSave();
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
                      {selectedAccount?.name || 'Wallet'}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>


          {/* Note / Memo Section */}
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

          {/* Touch Keypad Grid for Mobile (shown by default!) */}
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
                          handleSave();
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

          {/* Desktop Bottom Action Bar */}
          {!showNumpad && (
            <div className="px-5 sm:px-6 py-3.5 bg-[#0a0a0d] border-t border-zinc-900 flex items-center justify-between shrink-0 font-mono">
              <button
                type="button"
                onClick={handleDeleteClick}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs font-bold ${
                  isConfirmingDelete
                    ? 'bg-rose-600 text-white shadow-lg animate-pulse ring-2 ring-rose-500/50'
                    : 'text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                <Trash2 size={15} />
                <span>{isConfirmingDelete ? 'Confirm Delete?' : 'Delete'}</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={parseFormattedNumber(amountStr) <= 0}
                  className="px-6 py-2.5 bg-white hover:bg-zinc-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-black text-xs font-bold rounded-xl cursor-pointer shadow-lg transition-all flex items-center gap-2"
                >
                  <Check size={16} strokeWidth={3} />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. RIGHT PANEL: Date & Time or Account Selector (Desktop) */}
        <div 
          className={`hidden md:flex relative z-10 overflow-hidden transition-all duration-300 ease-out ${
            activeRightPanel ? 'w-60 lg:w-64 opacity-100 translate-x-0 pointer-events-auto' : 'w-0 opacity-0 -translate-x-12 pointer-events-none'
          }`}
        >
          <div 
            className="w-60 lg:w-64 bg-[#0c0c10] border border-zinc-900 rounded-3xl flex flex-col p-4 shadow-2xl h-full font-mono shrink-0"
          >
            {activeRightPanel === 'datetime' && (
              <div className="flex flex-col h-full animate-fade-in space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900 shrink-0">
                  <div className="flex items-center gap-2 text-white">
                    <CalendarIcon size={14} className="text-zinc-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Date & Time</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openRightPanel(null)}
                    className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Calendar Widget */}
                <div className="bg-[#14141a] border border-zinc-800/80 rounded-2xl p-2.5 space-y-2 shrink-0">
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        const current = new Date(calendarYear, calendarMonth - 1, 1);
                        setCalendarYear(current.getFullYear());
                        setCalendarMonth(current.getMonth());
                      }}
                      className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span className="text-[11px] font-bold text-white tracking-wide">
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
                      className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                      <span key={idx} className="text-[8px] font-bold text-zinc-500 py-0.5">
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
                          className={`h-5.5 rounded-full text-[10px] font-medium flex items-center justify-center transition-all cursor-pointer ${
                            !item.isCurrentMonth
                              ? 'text-zinc-700 pointer-events-none'
                              : isSelected
                              ? 'bg-white text-black font-bold shadow-xs scale-105'
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

                {/* Time Wheel Picker */}
                <div className="bg-[#14141a] border border-zinc-800/80 rounded-2xl p-2.5 flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between px-1 mb-1 shrink-0">
                    <span className="text-[9px] uppercase font-bold text-zinc-400">Select Time</span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setTime(getCurrentTimeStr());
                      }}
                      className="text-[9px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Set to Now
                    </button>
                  </div>

                  <div className="flex-1 flex items-center justify-center w-full min-h-[140px]">
                    <TimeWheelPicker
                      time={time}
                      setTime={setTime}
                      active={activeRightPanel === 'datetime'}
                      heightClass="h-44"
                      paddingClass="py-[72px]"
                      gradientBg="from-[#14141a]"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeRightPanel === 'account' && (
              <div className="flex flex-col h-full animate-fade-in space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900 shrink-0">
                  <div className="flex items-center gap-2 text-white">
                    <WalletIcon size={14} className="text-zinc-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Select Wallet</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openRightPanel(null)}
                    className="w-6 h-6 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto">
                  {state.accounts.map((acc) => {
                    const isSelected = selectedAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setSelectedAccountId(acc.id);
                        }}
                        className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white text-black font-bold shadow-xs'
                            : 'bg-[#14141a] text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <WalletIcon size={13} className={isSelected ? 'text-black' : 'text-zinc-500'} />
                          <span className="font-bold">{acc.name}</span>
                        </div>
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Mobile Quick Wallet Modal */}
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

        {/* 5. Mobile Custom Date & Time Modal */}
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

              {/* Time Wheel Picker */}
              <div className="bg-[#14141a] border border-zinc-800/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Select Time</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setTime(getCurrentTimeStr());
                    }}
                    className="text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Set to Now
                  </button>
                </div>

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
    </div>
  );
};
