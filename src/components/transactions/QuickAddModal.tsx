import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Check, 
  Calendar as CalendarIcon, 
  Wallet as WalletIcon, 
  FileText, 
  ChevronDown, 
  X,
  Plus,
  Minus
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import type { TransactionType } from '../../types/finance';
import { CategoryIcon } from '../common/Icons';
import { useBackButton } from '../../hooks/useBackButton';

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
  
  // Quick subcategory dropdown modal/drawer
  const [activeDropdownCatId, setActiveDropdownCatId] = useState<string | null>(null);

  // Hidden account picker & note quick prompt
  const [showAccountPicker, setShowAccountPicker] = useState<boolean>(false);
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Top level categories
  const parentCategories = state.categories.filter(
    (c) => !c.parentId && c.type === (type === 'income' ? 'income' : 'expense')
  );

  const getSubcategories = (catId: string) => state.categories.filter((c) => c.parentId === catId);

  // Sync selected account
  useEffect(() => {
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
  }, [isOpen, amountStr, type, selectedCategoryId, selectedSubcategoryId, selectedAccountId, toAccountId, date, note]);

  if (!isOpen) return null;

  // Numpad handler
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
    if (val === '+') {
      // Simple convenience: add 100 or round up
      const cur = parseFloat(amountStr) || 0;
      setAmountStr(String(cur + 100));
      return;
    }
    if (val === '-') {
      const cur = parseFloat(amountStr) || 0;
      setAmountStr(String(Math.max(0, cur - 100)));
      return;
    }

    if (amountStr === '0') {
      setAmountStr(val);
    } else {
      const parts = amountStr.split('.');
      if (parts[1] && parts[1].length >= 2) return;
      if (amountStr.length > 9) return;
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

  // Quick Date format for badge (e.g., Today / YYYY-MM-DD)
  const isToday = date === new Date().toISOString().split('T')[0];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <input
        ref={inputRef}
        type="text"
        className="opacity-0 absolute -top-9999px left-0 pointer-events-none"
        readOnly
      />

      <div 
        className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-md bg-[#0c0c10] sm:border border-zinc-900 sm:rounded-2xl flex flex-col justify-between overflow-hidden shadow-2xl safe-top safe-bottom select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top App Bar: Back icon + Type Switcher Pills */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2 shrink-0 border-b border-zinc-900/50">
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
                  className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold capitalize transition-all cursor-pointer ${
                    isAct ? 'bg-white text-black shadow-xs' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {t === 'expense' ? 'Expense' : t === 'income' ? 'Income' : 'Transfer'}
                </button>
              );
            })}
          </div>

          <div className="w-8" /> {/* Balance spacer */}
        </div>

        {/* Category Pill Grid (Reference Top Section) */}
        {type !== 'transfer' ? (
          <div className="px-4 py-3 flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                    className={`relative p-3 rounded-2xl flex items-center gap-2.5 cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-zinc-200 text-black border-white shadow-md'
                        : 'bg-[#14141a] text-zinc-300 border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-black text-white' : 'bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      <CategoryIcon name={cat.icon || 'Tag'} size={15} />
                    </div>

                    <div className="truncate flex-1 min-w-0">
                      <div className="text-xs font-bold truncate leading-tight">{cat.name}</div>
                      {isSelected && selectedSub ? (
                        <div className="text-[10px] text-zinc-700 truncate leading-tight font-medium mt-0.5">
                          {selectedSub.name}
                        </div>
                      ) : hasSubs ? (
                        <div className={`text-[10px] truncate leading-tight mt-0.5 ${isSelected ? 'text-zinc-600' : 'text-zinc-500 font-mono'}`}>
                          {subs.length} sub
                        </div>
                      ) : null}
                    </div>

                    {/* Small dropdown arrow pill if it has subcategories */}
                    {hasSubs && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic();
                          setSelectedCategoryId(cat.id);
                          setActiveDropdownCatId(activeDropdownCatId === cat.id ? null : cat.id);
                        }}
                        className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
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

            {/* Inline Subcategory Bar if active category has subcategories */}
            {selectedCategory && getSubcategories(selectedCategory.id).length > 0 && (
              <div className="mt-3 p-2.5 rounded-2xl bg-[#14141a] border border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold px-1 shrink-0">
                  Sub:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setSelectedSubcategoryId(undefined);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer ${
                    selectedSubcategoryId === undefined
                      ? 'bg-white text-black font-bold shadow-xs'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  All / General
                </button>
                {getSubcategories(selectedCategory.id).map((sub) => {
                  const isSub = selectedSubcategoryId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedSubcategoryId(sub.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer ${
                        isSub ? 'bg-white text-black font-bold shadow-xs' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {sub.name}
                    </button>
                  );
                })}
              </div>
            )}
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
                  className="w-full bg-[#14141a] rounded-xl px-3 py-2 text-xs text-white border border-zinc-800 focus:outline-none font-mono"
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
                  className="w-full bg-[#14141a] rounded-xl px-3 py-2 text-xs text-white border border-zinc-800 focus:outline-none font-mono"
                >
                  {state.accounts.filter(a => a.id !== selectedAccountId).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Amount Display & Quick Note Strip (Center) */}
        <div className="px-6 py-2 flex items-center justify-between border-t border-zinc-900/60 bg-[#0e0e13]">
          <div className="flex-1 truncate pr-2">
            <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
              {type === 'expense' ? 'Amount' : type === 'income' ? 'Received' : 'Transfer'}
            </div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl text-zinc-500 font-medium">{state.settings.currencySymbol}</span>
              <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight truncate">
                {amountStr}
              </span>
            </div>
          </div>

          {/* Quick Note Badge */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 font-mono transition-colors cursor-pointer max-w-[140px] truncate"
            >
              <FileText size={12} className="text-zinc-500 shrink-0" />
              <span className="truncate">{note ? note : 'Add Note'}</span>
            </button>
          </div>
        </div>

        {/* Note input popup drawer if clicked */}
        {showNoteInput && (
          <div className="px-4 py-2 bg-[#121218] border-t border-zinc-900 flex items-center gap-2 animate-fade-in">
            <input
              type="text"
              placeholder="Add memo/note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
              className="flex-1 bg-[#181822] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none border border-zinc-800"
            />
            <button
              type="button"
              onClick={() => setShowNoteInput(false)}
              className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-xl cursor-pointer"
            >
              OK
            </button>
          </div>
        )}

        {/* ─── Bottom Reference Layout: Keypad (Left) + Quick Attributes (Right) ─── */}
        <div className="p-3 bg-[#0a0a0d] border-t border-zinc-900 flex gap-2">
          {/* Keypad 3 cols (1-9, ., 0, backspace) + Operator col (+, -, etc.) */}
          <div className="flex-[3] grid grid-cols-4 gap-1.5">
            {['1', '2', '3'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className="py-3 bg-[#14141a] hover:bg-[#1e1e26] active:scale-95 text-white font-mono text-lg font-bold rounded-2xl cursor-pointer"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress('+')}
              className="py-3 bg-[#181822] hover:bg-zinc-800 text-zinc-300 font-mono text-base font-bold rounded-2xl cursor-pointer flex items-center justify-center"
              title="+100"
            >
              <Plus size={16} />
            </button>

            {['4', '5', '6'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className="py-3 bg-[#14141a] hover:bg-[#1e1e26] active:scale-95 text-white font-mono text-lg font-bold rounded-2xl cursor-pointer"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress('-')}
              className="py-3 bg-[#181822] hover:bg-zinc-800 text-zinc-300 font-mono text-base font-bold rounded-2xl cursor-pointer flex items-center justify-center"
              title="-100"
            >
              <Minus size={16} />
            </button>

            {['7', '8', '9'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className="py-3 bg-[#14141a] hover:bg-[#1e1e26] active:scale-95 text-white font-mono text-lg font-bold rounded-2xl cursor-pointer"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress('back')}
              className="py-3 bg-[#1a1416] hover:bg-rose-950/40 text-rose-400 font-mono text-base font-bold rounded-2xl cursor-pointer"
            >
              ⌫
            </button>

            <button
              type="button"
              onClick={() => handleKeypadPress('.')}
              className="py-3 bg-[#14141a] hover:bg-[#1e1e26] active:scale-95 text-white font-mono text-lg font-bold rounded-2xl cursor-pointer"
            >
              .
            </button>

            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="py-3 bg-[#14141a] hover:bg-[#1e1e26] active:scale-95 text-white font-mono text-lg font-bold rounded-2xl cursor-pointer"
            >
              0
            </button>

            <button
              type="button"
              onClick={() => handleKeypadPress('C')}
              className="py-3 bg-[#14141a] hover:bg-zinc-800 text-zinc-500 hover:text-white font-mono text-xs font-bold rounded-2xl cursor-pointer"
            >
              CLR
            </button>

            {/* Checkmark submit button */}
            <button
              type="button"
              onClick={executeSubmit}
              disabled={parseFloat(amountStr) <= 0}
              className="py-3 bg-white hover:bg-zinc-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-black font-bold rounded-2xl flex items-center justify-center shadow-lg cursor-pointer transition-all"
            >
              <Check size={20} strokeWidth={3} />
            </button>
          </div>

          {/* Quick Attribute Tiles (Right Column matching reference) */}
          <div className="flex-1 flex flex-col gap-1.5">
            {/* 1. Date Pill */}
            <label className="flex flex-col items-center justify-center p-2 rounded-2xl bg-[#14141a] border border-zinc-800/80 hover:border-zinc-700 transition-colors cursor-pointer text-center relative overflow-hidden flex-1">
              <CalendarIcon size={14} className="text-zinc-400 mb-0.5" />
              <span className="text-[10px] font-mono font-bold text-white truncate max-w-full">
                {isToday ? 'Today' : date.slice(5)}
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer"
              />
            </label>

            {/* 2. Target Wallet Pill */}
            <button
              type="button"
              onClick={() => setShowAccountPicker(!showAccountPicker)}
              className="flex flex-col items-center justify-center p-2 rounded-2xl bg-[#14141a] border border-zinc-800/80 hover:border-zinc-700 transition-colors cursor-pointer text-center flex-1"
            >
              <WalletIcon size={14} className="text-zinc-400 mb-0.5" />
              <span className="text-[10px] font-mono font-bold text-white truncate max-w-full">
                {selectedAccount?.name || 'Wallet'}
              </span>
            </button>

            {/* 3. Category/Subcategory Quick Peek */}
            <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-[#14141a] border border-zinc-800/80 text-center flex-1">
              <CategoryIcon name={selectedCategory?.icon || 'Tag'} size={14} className="text-zinc-400 mb-0.5" />
              <span className="text-[9px] font-mono font-bold text-zinc-400 truncate max-w-full">
                {selectedSub?.name || selectedCategory?.name || 'Category'}
              </span>
            </div>
          </div>
        </div>

        {/* Popups & Modals */}
        {/* 1. Subcategory Picker Modal (Reference screenshot 2) */}
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
                {/* General / No subcategory option */}
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

                {/* Subcategories list */}
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

        {/* 2. Quick Wallet Selector Modal (Reference screenshot 4) */}
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
      </div>
    </div>
  );
};
