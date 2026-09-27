import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowDownRight, ArrowUpRight, ArrowRightLeft, Calendar, Clock, FileText, Check } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionType } from '../../types/finance';
import { CategoryIcon } from '../common/Icons';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string;
}

const getCurrentTimeStr = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ isOpen, onClose, defaultAccountId }) => {
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
  const [time, setTime] = useState<string>(() => getCurrentTimeStr());
  const [note, setNote] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Parent categories (no parentId)
  const parentCategories = state.categories.filter(
    (c) => !c.parentId && c.type === (type === 'income' ? 'income' : 'expense')
  );

  // Subcategories for the selected parent category
  const availableSubcategories = state.categories.filter(
    (c) => c.parentId === selectedCategoryId
  );

  // Update selected account whenever defaultAccountId or state.accounts changes
  useEffect(() => {
    if (defaultAccountId) {
      setSelectedAccountId(defaultAccountId);
    } else if (state.accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(state.accounts[0].id);
    }
  }, [defaultAccountId, state.accounts, isOpen]);

  // Focus hidden input on desktop when modal opens so typing works immediately
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);


  // Ensure an active parent category is selected
  useEffect(() => {
    if (parentCategories.length > 0 && (!selectedCategoryId || !parentCategories.find(c => c.id === selectedCategoryId))) {
      setSelectedCategoryId(parentCategories[0].id);
      setSelectedSubcategoryId(undefined);
    }
  }, [type, parentCategories, selectedCategoryId]);

  // Global Keyboard listener for Laptop/PC keyboard input
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in note or date input
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
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadPress('back');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const parsedAmount = parseFloat(amountStr);
        if (parsedAmount > 0) {
          executeSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, amountStr, type, selectedCategoryId, selectedAccountId, toAccountId, date, note]);

  if (!isOpen) return null;

  // Numpad & Keyboard processor
  const handleKeypadPress = (val: string) => {
    triggerHaptic();
    if (val === 'C') {
      setAmountStr('0');
      return;
    }
    if (val === 'back') {
      if (amountStr.length <= 1) {
        setAmountStr('0');
      } else {
        setAmountStr(amountStr.slice(0, -1));
      }
      return;
    }
    if (val === '.') {
      if (!amountStr.includes('.')) {
        setAmountStr(amountStr + '.');
      }
      return;
    }
    if (amountStr === '0') {
      setAmountStr(val);
    } else {
      const parts = amountStr.split('.');
      if (parts[1] && parts[1].length >= 2) return;
      if (amountStr.length > 10) return;
      setAmountStr(amountStr + val);
    }
  };

  const executeSubmit = () => {
    const parsedAmount = parseFloat(amountStr);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSubmit();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Hidden input to capture physical keyboard focus without bringing up mobile software keyboard */}
      <input
        ref={inputRef}
        type="text"
        className="opacity-0 absolute -top-9999px left-0 pointer-events-none"
        readOnly
      />

      <div 
        className="w-full max-w-md bg-[#0e0e11] border-t sm:border border-zinc-800 sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-zinc-900">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Fast Entry <span className="hidden sm:inline text-zinc-600 font-mono">(NumPad Enabled)</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Type Switcher */}
        <div className="flex p-2 gap-1.5 bg-[#121216] mx-4 mt-3 rounded-2xl">
          <button
            type="button"
            onClick={() => { triggerHaptic(); setType('expense'); }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'expense'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ArrowDownRight size={14} className={type === 'expense' ? 'text-rose-400' : ''} />
            Expense
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic(); setType('income'); }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'income'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ArrowUpRight size={14} className={type === 'income' ? 'text-emerald-400' : ''} />
            Income
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic(); setType('transfer'); }}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              type === 'transfer'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ArrowRightLeft size={14} className={type === 'transfer' ? 'text-blue-400' : ''} />
            Transfer
          </button>
        </div>

        {/* Big Amount Screen */}
        <div className="px-6 py-3.5 flex flex-col items-center justify-center">
          <div className="text-xs text-zinc-500 font-mono tracking-wider mb-1">
            {type === 'expense' ? 'AMOUNT SPENT' : type === 'income' ? 'AMOUNT RECEIVED' : 'AMOUNT TO TRANSFER'}
          </div>
          <div className="flex items-baseline justify-center gap-1 text-white font-mono font-medium">
            <span className="text-2xl text-zinc-500">{state.settings.currencySymbol}</span>
            <span className="text-4xl sm:text-5xl tracking-tight font-bold">{amountStr}</span>
          </div>
        </div>

        {/* Scrollable details */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-2">
          {/* Account Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider px-1 block">
              Target Wallet / Account
            </label>
            <div className="grid grid-cols-2 gap-2">
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
                    className={`py-2 px-3 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-white text-black font-bold shadow-md'
                        : 'bg-[#14141a] text-zinc-300 hover:bg-[#1a1a22]'
                    }`}
                  >
                    <span className="text-xs truncate">{acc.name}</span>
                    <span className={`text-[10px] font-mono uppercase ${isSelected ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {acc.type}
                    </span>
                  </button>
                );
              })}
            </div>

            {type === 'transfer' && (
              <div className="pt-2">
                <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider px-1 block mb-1">
                  Destination Wallet
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {state.accounts
                    .filter((acc) => acc.id !== selectedAccountId)
                    .map((acc) => {
                      const isTarget = toAccountId === acc.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setToAccountId(acc.id);
                          }}
                          className={`py-2 px-3 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between ${
                            isTarget
                              ? 'bg-blue-500 text-white font-bold shadow-md'
                              : 'bg-[#14141a] text-zinc-300 hover:bg-[#1a1a22]'
                          }`}
                        >
                          <span className="text-xs truncate">{acc.name}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Categories Grid (for income/expense) */}
          {type !== 'transfer' && (
            <div className="pt-1 space-y-2">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block px-1">
                Category
              </span>
              <div className="grid grid-cols-4 gap-2">
                {parentCategories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedCategoryId(cat.id);
                        setSelectedSubcategoryId(undefined);
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-200 text-black shadow-sm font-semibold'
                          : 'bg-[#141418] text-zinc-400 hover:bg-[#1a1a20] hover:text-white'
                      }`}
                    >
                      <div className="mb-1">
                        <CategoryIcon name={cat.icon} size={16} />
                      </div>
                      <span className="text-[10px] truncate max-w-full">{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Subcategories Selector (if any exist for selected parent) */}
              {availableSubcategories.length > 0 && (
                <div className="pt-1.5 space-y-1">
                  <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider block px-1">
                    Subcategory (optional)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedSubcategoryId(undefined);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-mono transition-all cursor-pointer ${
                        selectedSubcategoryId === undefined
                          ? 'bg-white text-black font-bold'
                          : 'bg-[#141418] text-zinc-400 hover:text-white'
                      }`}
                    >
                      General
                    </button>
                    {availableSubcategories.map((sub) => {
                      const isSubSelected = selectedSubcategoryId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setSelectedSubcategoryId(sub.id);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-mono transition-all cursor-pointer ${
                            isSubSelected
                              ? 'bg-white text-black font-bold'
                              : 'bg-[#141418] text-zinc-400 hover:text-white'
                          }`}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date, Time, and Optional Note */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {/* Custom Date Selector */}
              <div className="flex items-center gap-2 bg-[#141418] border border-zinc-900 rounded-2xl px-3 py-2">
                <Calendar size={14} className="text-zinc-400 shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[8px] font-mono uppercase text-zinc-500">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-xs text-white focus:outline-none w-full font-mono"
                  />
                </div>
              </div>

              {/* Custom Time Selector (defaults to now) */}
              <div className="flex items-center gap-2 bg-[#141418] border border-zinc-900 rounded-2xl px-3 py-2">
                <Clock size={14} className="text-zinc-400 shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-mono uppercase text-zinc-500">Time</span>
                    <button
                      type="button"
                      onClick={() => setTime(getCurrentTimeStr())}
                      className="text-[8px] text-zinc-400 hover:text-white font-mono cursor-pointer"
                    >
                      Now
                    </button>
                  </div>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="bg-transparent text-xs text-white focus:outline-none w-full font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Note input */}
            <div className="flex items-center gap-2 bg-[#141418] border border-zinc-900 rounded-2xl px-3 py-2">
              <FileText size={14} className="text-zinc-500 shrink-0" />
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-full"
              />
            </div>
          </div>
        </div>

        {/* Tactile Keypad (Mobile on-screen, plus PC physical keyboard support) */}
        <div className="bg-[#0b0b0e] border-t border-zinc-900 p-3 grid grid-cols-4 gap-2">
          {['1', '2', '3'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeypadPress(k)}
              className="py-3 bg-[#15151a] hover:bg-[#202027] active:scale-95 text-white font-mono text-lg font-medium rounded-2xl cursor-pointer"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleKeypadPress('C')}
            className="py-3 bg-[#1a1415] hover:bg-rose-950/40 text-rose-400 font-mono text-sm font-semibold rounded-2xl cursor-pointer"
          >
            CLR
          </button>

          {['4', '5', '6'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeypadPress(k)}
              className="py-3 bg-[#15151a] hover:bg-[#202027] active:scale-95 text-white font-mono text-lg font-medium rounded-2xl cursor-pointer"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleKeypadPress('back')}
            className="py-3 bg-[#18181f] text-zinc-400 hover:text-white font-mono text-sm rounded-2xl cursor-pointer"
          >
            ⌫
          </button>

          {['7', '8', '9'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeypadPress(k)}
              className="py-3 bg-[#15151a] hover:bg-[#202027] active:scale-95 text-white font-mono text-lg font-medium rounded-2xl cursor-pointer"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleKeypadPress('.')}
            className="py-3 bg-[#15151a] text-white font-mono text-lg rounded-2xl cursor-pointer"
          >
            .
          </button>

          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            className="col-span-2 py-3 bg-[#15151a] hover:bg-[#202027] active:scale-95 text-white font-mono text-lg font-medium rounded-2xl cursor-pointer"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={parseFloat(amountStr) <= 0}
            className="col-span-2 py-3 bg-white hover:bg-zinc-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-black font-semibold text-sm rounded-2xl flex items-center justify-center gap-1 shadow-lg cursor-pointer"
          >
            <Check size={18} strokeWidth={2.5} />
            <span>Save Entry</span>
          </button>
        </div>
      </div>
    </div>
  );
};
