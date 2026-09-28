import React, { useRef, useState, useMemo } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Plus,
  CreditCard,
  LogOut,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Target,
  Tag,
  Keyboard,
  DollarSign,
  Wallet,
  CalendarDays,
  X,
  RefreshCw,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { supabase } from '../../db/supabaseClient';
import { CustomSelect } from '../common/CustomSelect';
import { CurrencyInput, parseFormattedNumber } from '../common/CurrencyInput';
import { CategoryIcon, formatCurrency } from '../common/Icons';
import type { Account, Budget, BudgetCategoryAllocation, Category } from '../../types/finance';
import { RecurringManager } from '../recurring/RecurringManager';
import { useBackButton } from '../../hooks/useBackButton';

type SettingsSubPage = null | 'goals' | 'categories' | 'recurring';

// ─── Row components ───────────────────────────────────────────────

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}> = ({ icon, title, subtitle, right, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 py-3.5 px-4 min-h-[58px] text-left transition-colors cursor-pointer first:rounded-t-2xl last:rounded-b-2xl ${
      onClick ? 'active:bg-zinc-900/60 hover:bg-zinc-900/40' : 'cursor-default'
    }`}
  >
    <div
      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        danger ? 'bg-rose-900/40 text-rose-400' : 'bg-zinc-900 text-zinc-300'
      }`}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className={`text-[13px] font-medium leading-tight ${danger ? 'text-rose-400' : 'text-white'}`}>{title}</div>
      {subtitle && <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{subtitle}</div>}
    </div>
    {right !== undefined ? (
      right
    ) : onClick ? (
      <ChevronRight size={15} className="text-zinc-600 shrink-0" />
    ) : null}
  </button>
);


const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500 px-1 pt-2 pb-1">{children}</div>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-[#101014] rounded-2xl border border-zinc-900/60 divide-y divide-zinc-900/70">
    {children}
  </div>
);

// ─── Sub-page 1: Spending Goals (Range + Category breakdown) ──────────

const GoalsSubPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { state, addBudget, updateBudget, deleteBudget } = useFinance();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Budget | null>(null);

  useBackButton(Boolean(showCreateModal || selectedGoal), () => {
    if (showCreateModal) setShowCreateModal(false);
    else if (selectedGoal) setSelectedGoal(null);
  });

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<Budget['period']>('monthly');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [categoryAllocations, setCategoryAllocations] = useState<BudgetCategoryAllocation[]>([]);
  const [tempCatId, setTempCatId] = useState('');
  const [tempCatAmount, setTempCatAmount] = useState('');

  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => state.categories.filter((c) => c.type === 'expense' && !c.parentId),
    [state.categories]
  );

  const openCreateModal = () => {
    const now = new Date();
    setEditingBudgetId(null);
    setName('Spending Goal');
    setPeriod('monthly');
    setAmount('');
    setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
    setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
    setCategoryAllocations([]);
    setTempCatId(expenseCategories[0]?.id || '');
    setTempCatAmount('');
    setShowCreateModal(true);
  };

  const openEditModal = (b: Budget) => {
    setEditingBudgetId(b.id);
    setName(b.name || 'Spending Goal');
    setPeriod(b.period || 'monthly');
    setAmount(String(b.amount));
    setStartDate(b.startDate || new Date().toISOString().split('T')[0]);
    setEndDate(b.endDate || new Date().toISOString().split('T')[0]);
    setCategoryAllocations(b.categories || []);
    setTempCatId(expenseCategories[0]?.id || '');
    setTempCatAmount('');
    setSelectedGoal(null);
    setShowCreateModal(true);
  };

  const handlePeriodChange = (newPeriod: Budget['period']) => {
    setPeriod(newPeriod);
    const now = new Date();
    if (newPeriod === 'daily') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (newPeriod === 'weekly') {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(sunday.toISOString().split('T')[0]);
    } else if (newPeriod === 'monthly') {
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
      setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
    }
  };

  const handleAddCategoryAllocation = () => {
    const amt = parseFormattedNumber(tempCatAmount);
    if (!tempCatId || !amt || amt <= 0) return;
    setCategoryAllocations((prev) => {
      const existing = prev.filter((a) => a.categoryId !== tempCatId);
      return [...existing, { categoryId: tempCatId, amount: amt }];
    });
    setTempCatAmount('');
  };

  const handleRemoveCategoryAllocation = (catId: string) => {
    setCategoryAllocations((prev) => prev.filter((a) => a.categoryId !== catId));
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = parseFormattedNumber(amount);
    if (!totalAmount || totalAmount <= 0) return;

    if (editingBudgetId) {
      updateBudget({
        id: editingBudgetId,
        name: name.trim() || 'Spending Goal',
        amount: totalAmount,
        period,
        startDate,
        endDate,
        categories: categoryAllocations,
      });
    } else {
      addBudget({
        name: name.trim() || 'Spending Goal',
        amount: totalAmount,
        period,
        startDate,
        endDate,
        categories: categoryAllocations,
      });
    }

    setShowCreateModal(false);
    setEditingBudgetId(null);
  };

  // Helper to compute spendings in range for a budget
  const getBudgetSpending = (budget: Budget) => {
    const start = budget.startDate ? new Date(budget.startDate) : null;
    const end = budget.endDate ? new Date(budget.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    const relevantTxs = state.transactions.filter((tx) => {
      if (tx.type !== 'expense') return false;
      const txDate = new Date(tx.date);
      if (start && txDate < start) return false;
      if (end && txDate > end) return false;
      return true;
    });

    const totalSpent = relevantTxs.reduce((sum, tx) => sum + tx.amount, 0);

    const categorySpent: Record<string, number> = {};
    relevantTxs.forEach((tx) => {
      categorySpent[tx.categoryId] = (categorySpent[tx.categoryId] || 0) + tx.amount;
    });

    return { totalSpent, categorySpent };
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 cursor-pointer hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-base font-bold text-white font-mono">SPENDING GOALS</h2>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <Plus size={13} strokeWidth={2.8} />
          New Goal
        </button>
      </div>

      {/* List of Goals matching reference 1 & 2 */}
      {state.budgets.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#101014] border border-zinc-900/60 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
            <Target size={18} />
          </div>
          <div className="text-xs text-zinc-400 font-medium">No spending goals set</div>
          <p className="text-[10px] text-zinc-600 max-w-xs mx-auto">
            Create a date range goal and allocate limits for categories like Food, Essentials, or Savings.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold cursor-pointer"
          >
            <Plus size={13} /> Add Goal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {state.budgets.map((b) => {
            const { totalSpent, categorySpent } = getBudgetSpending(b);
            const percent = Math.min(100, Math.round((totalSpent / b.amount) * 100));

            return (
              <div
                key={b.id}
                onClick={() => setSelectedGoal(b)}
                className="space-y-2 cursor-pointer active:scale-99 transition-all"
              >
                {/* Header row: Red-tinted period name (e.g. Monthly) + Date range */}
                <div className="flex items-center justify-between text-xs font-mono px-1">
                  <span className="font-bold text-rose-400">
                    {b.period === 'daily' ? 'Daily' : b.period === 'weekly' ? 'Weekly' : b.period === 'monthly' ? 'Monthly' : 'Custom Range'}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-bold">
                    {b.startDate} ━ {b.endDate}
                  </span>
                </div>

                {/* Overalls banner card (Reference styling) */}
                <div className="p-3.5 rounded-2xl bg-[#16161f] border border-zinc-800/80 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-xs font-bold text-white font-mono">Overalls</div>
                    <div className="text-xs text-zinc-400 font-mono mt-0.5">
                      {formatCurrency(b.amount, state.settings.currencySymbol)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-white font-mono">{percent}%</div>
                    <div className="text-xs text-zinc-400 font-mono mt-0.5">
                      {formatCurrency(totalSpent, state.settings.currencySymbol)}
                    </div>
                  </div>
                </div>

                {/* Subcategory mini chips row (Reference styling) */}
                {b.categories && b.categories.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-0.5">
                    {b.categories.map((catAlloc) => {
                      const cat = state.categories.find((c) => c.id === catAlloc.categoryId);
                      const catUsed = categorySpent[catAlloc.categoryId] || 0;
                      const catPercent = Math.min(100, Math.round((catUsed / catAlloc.amount) * 100));

                      return (
                        <div
                          key={catAlloc.categoryId}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-[#121218] border border-zinc-800/60 shrink-0 text-xs shadow-xs"
                        >
                          <div className="w-7 h-7 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-200">
                            <CategoryIcon name={cat?.icon || 'Tag'} size={13} />
                          </div>
                          <div>
                            <div className="text-[9px] font-bold text-zinc-300 font-mono">{catPercent}%</div>
                            <div className="text-[10px] text-white font-bold font-mono">
                              {formatCurrency(catAlloc.amount, state.settings.currencySymbol)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Detail & Action Sheet Modal (Matching 1st reference screenshot) */}
      {selectedGoal && (() => {
        const { totalSpent, categorySpent } = getBudgetSpending(selectedGoal);
        const percent = Math.min(100, Math.round((totalSpent / selectedGoal.amount) * 100));
        const remaining = Math.max(0, selectedGoal.amount - totalSpent);

        // Days left calculation
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = selectedGoal.endDate ? new Date(selectedGoal.endDate) : today;
        end.setHours(0, 0, 0, 0);
        const daysLeft = Math.max(1, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const dailyAllowance = (remaining / daysLeft).toFixed(2);

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
            onClick={() => setSelectedGoal(null)}
          >
            <div
              className="w-full sm:max-w-lg md:max-w-2xl lg:max-w-3xl bg-[#101014] rounded-t-2xl sm:rounded-2xl md:rounded-3xl border border-zinc-800 shadow-2xl cursor-default max-h-[92vh] overflow-y-auto p-5 sm:p-6 md:p-8 space-y-4 sm:space-y-5 transition-all duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Overalls Big Highlight Card */}
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-white font-mono">Overalls</div>
                  <div className="text-xs text-zinc-400 font-mono mt-0.5">
                    {formatCurrency(selectedGoal.amount, state.settings.currencySymbol)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs sm:text-sm font-bold text-white font-mono">{percent}%</div>
                  <div className="text-xs text-zinc-400 font-mono mt-0.5">
                    {formatCurrency(totalSpent, state.settings.currencySymbol)}
                  </div>
                </div>
              </div>

              {/* Category Breakdown list (Reference style cards) */}
              {selectedGoal.categories && selectedGoal.categories.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedGoal.categories.map((c) => {
                    const cat = state.categories.find((item) => item.id === c.categoryId);
                    const spent = categorySpent[c.categoryId] || 0;
                    const catPct = Math.min(100, Math.round((spent / c.amount) * 100));

                    return (
                      <div
                        key={c.categoryId}
                        className="p-3.5 rounded-2xl bg-[#16161d] border border-zinc-800/60 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-200">
                            <CategoryIcon name={cat?.icon || 'Tag'} size={15} />
                          </div>
                          <div className="font-bold text-white">{cat?.name || 'Category'}</div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-bold text-white text-xs">{catPct}%</div>
                          <div className="text-[11px] text-zinc-400 font-mono">
                            {formatCurrency(c.amount, state.settings.currencySymbol)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Stats Footer (Days Remaining, Daily Remaining) */}
              <div className="pt-3 border-t border-zinc-900 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-zinc-400">
                <div className="flex justify-between p-2 rounded-xl bg-[#16161d]/50">
                  <span>Period</span>
                  <span className="text-white capitalize">{selectedGoal.period}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-[#16161d]/50">
                  <span>Date Range</span>
                  <span className="text-white">{selectedGoal.startDate} ━ {selectedGoal.endDate}</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-[#16161d]/50">
                  <span>Days Remaining</span>
                  <span className="text-white font-bold">{daysLeft} days</span>
                </div>
                <div className="flex justify-between p-2 rounded-xl bg-[#16161d]/50">
                  <span>Daily Allowance</span>
                  <span className="text-emerald-400 font-bold">
                    {state.settings.currencySymbol}{dailyAllowance} / day
                  </span>
                </div>
              </div>

              {/* Action Buttons: Delete | Edit | Close */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    deleteBudget(selectedGoal.id);
                    setSelectedGoal(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-400 text-xs font-mono font-bold transition-colors cursor-pointer text-center"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(selectedGoal)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono font-bold transition-all cursor-pointer text-center"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGoal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-all cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Spending Goal Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl bg-[#101014] rounded-t-2xl sm:rounded-2xl md:rounded-3xl border border-zinc-800 shadow-2xl cursor-default max-h-[92vh] overflow-y-auto p-5 sm:p-6 md:p-8 space-y-4 sm:space-y-5 transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-bold text-white font-mono">Create Spending Goal</h3>

            <form onSubmit={handleSaveGoal} className="space-y-3">
              {/* Name */}
              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">Goal Name</label>
                <input
                  type="text"
                  placeholder="e.g. October Budget, Holiday Trip"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 bg-[#16161d] rounded-xl px-3.5 text-xs text-white focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                  required
                />
              </div>

              {/* Period selection */}
              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">Range Period</label>
                <div className="flex bg-[#16161d] p-1 rounded-xl border border-zinc-800/60 gap-1">
                  {(['daily', 'weekly', 'monthly', 'custom'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePeriodChange(p)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono capitalize transition-all cursor-pointer ${
                        period === p ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-11 bg-[#16161d] rounded-xl px-3.5 text-xs text-white font-mono focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-11 bg-[#16161d] rounded-xl px-3.5 text-xs text-white font-mono focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Total Overall Amount */}
              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                  Total Overall Limit
                </label>
                <CurrencyInput
                  currencySymbol={state.settings.currencySymbol}
                  type="number"
                  placeholder="e.g. 8000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-11 bg-[#16161d] rounded-xl px-3.5 text-sm text-white font-mono font-bold focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                  required
                />
              </div>

              {/* Category Breakdown Allocation Builder */}
              <div className="pt-2 border-t border-zinc-900 space-y-2">
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block">
                  Category Limits (Optional)
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <CustomSelect
                      value={tempCatId}
                      onChange={(val) => setTempCatId(val)}
                      options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                  <CurrencyInput
                    currencySymbol={state.settings.currencySymbol}
                    type="number"
                    placeholder="Limit"
                    value={tempCatAmount}
                    onChange={(e) => setTempCatAmount(e.target.value)}
                    className="w-full h-11 bg-[#16161d] rounded-xl px-3.5 text-xs text-white font-mono focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                    containerClassName="w-28 shrink-0"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategoryAllocation}
                    className="px-4 h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    Add
                  </button>
                </div>

                {categoryAllocations.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {categoryAllocations.map((alloc) => {
                      const cat = state.categories.find((c) => c.id === alloc.categoryId);
                      return (
                        <div
                          key={alloc.categoryId}
                          className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[#16161d] border border-zinc-800/60 text-xs"
                        >
                          <span className="text-zinc-200 font-medium truncate">{cat?.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white">
                              {formatCurrency(alloc.amount, state.settings.currencySymbol)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCategoryAllocation(alloc.categoryId)}
                              className="text-zinc-600 hover:text-rose-400 p-0.5 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl cursor-pointer active:scale-95 transition-all"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-page 2: Categories (Parent + Subcategory Management) ──────

const CategoriesSubPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { state, addCategory, deleteCategory } = useFinance();
  const [tab, setTab] = useState<'expense' | 'income'>('expense');

  // Modals
  const [selectedParentCat, setSelectedParentCat] = useState<Category | null>(null);
  const [showAddParentModal, setShowAddParentModal] = useState(false);
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Tag');

  useBackButton(
    Boolean(selectedParentCat || showAddParentModal || showAddSubModal),
    () => {
      if (showAddSubModal) setShowAddSubModal(false);
      else if (showAddParentModal) setShowAddParentModal(false);
      else if (selectedParentCat) setSelectedParentCat(null);
    }
  );

  // Filter top-level parents and their subcategories
  const parentCategories = useMemo(
    () => state.categories.filter((c) => c.type === tab && !c.parentId),
    [state.categories, tab]
  );

  const getSubcategories = (parentId: string) => {
    return state.categories.filter((c) => c.parentId === parentId);
  };

  const handleCreateParent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory({
      name: newCatName.trim(),
      type: tab,
      icon: newCatIcon || 'Tag',
    });
    setNewCatName('');
    setShowAddParentModal(false);
  };

  const handleCreateSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !selectedParentCat) return;
    addCategory({
      name: newCatName.trim(),
      type: tab,
      icon: 'Tag',
      parentId: selectedParentCat.id,
    });
    setNewCatName('');
    setShowAddSubModal(false);
  };

  const availableIcons = [
    'Utensils',
    'Coffee',
    'ShoppingCart',
    'Car',
    'Home',
    'Film',
    'ShoppingBag',
    'HeartPulse',
    'Laptop',
    'Briefcase',
    'Zap',
    'TrendingUp',
    'Wallet',
    'Target',
    'Tag',
  ];

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 cursor-pointer hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-base font-bold text-white font-mono">CATEGORIES</h2>
        </div>

        <button
          onClick={() => {
            setNewCatName('');
            setNewCatIcon('Tag');
            setShowAddParentModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <Plus size={13} strokeWidth={2.8} />
          Add Category
        </button>
      </div>

      {/* Expense / Income Pill Switcher */}
      <div className="flex bg-[#101014] p-1 rounded-xl border border-zinc-900 gap-1">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer capitalize ${
              tab === t ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t === 'expense' ? 'Expenses' : 'Income'}
          </button>
        ))}
      </div>

      {/* Grid of Categories (1 col mobile, 2 col sm, 3 col md, 4 col lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {parentCategories.map((cat) => {
          const subs = getSubcategories(cat.id);

          return (
            <div
              key={cat.id}
              onClick={() => setSelectedParentCat(cat)}
              className="p-3 rounded-2xl bg-[#101014] border border-zinc-900/60 hover:border-zinc-700 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-98 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors shrink-0">
                  <CategoryIcon name={cat.icon || 'Tag'} size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{cat.name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono leading-tight truncate">
                    {subs.length > 0 ? `${subs.length} subcategories` : 'No subcategories'}
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-zinc-600 font-mono group-hover:text-zinc-400 transition-colors shrink-0 px-1">
                ☰
              </div>
            </div>
          );
        })}
      </div>

      {parentCategories.length === 0 && (
        <div className="text-center text-xs text-zinc-600 py-12">No {tab} categories yet</div>
      )}

      {/* Parent Category Action Modal (Matching 3rd reference screenshot) */}
      {selectedParentCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
          onClick={() => setSelectedParentCat(null)}
        >
          <div
            className="w-full max-w-xs bg-[#101014] rounded-2xl p-5 border border-zinc-800 shadow-2xl space-y-4 cursor-default animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Category Banner Card */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white shrink-0">
                <CategoryIcon name={selectedParentCat.icon || 'Tag'} size={18} />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">{selectedParentCat.name}</div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">
                  {selectedParentCat.type} Category
                </div>
              </div>
            </div>

            {/* Subcategories list inside */}
            {(() => {
              const subs = getSubcategories(selectedParentCat.id);
              return (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-zinc-500 font-bold px-1">
                    Subcategories ({subs.length})
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {subs.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[#16161d] border border-zinc-800/60 text-xs"
                      >
                        <span className="text-zinc-200 truncate">{sub.name}</span>
                        <button
                          onClick={() => deleteCategory(sub.id)}
                          className="text-zinc-600 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {subs.length === 0 && (
                      <div className="text-[11px] text-zinc-600 italic py-2 px-1">No subcategories added yet</div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Add Subcategory Trigger Button */}
            <button
              onClick={() => {
                setNewCatName('');
                setShowAddSubModal(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#16161d] hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-white transition-all cursor-pointer"
            >
              <Plus size={14} /> Add Subcategory
            </button>

            {/* Modal Bottom Actions (Delete vs Done) */}
            <div className="flex items-center gap-2 pt-1 border-t border-zinc-900">
              <button
                onClick={() => {
                  deleteCategory(selectedParentCat.id);
                  setSelectedParentCat(null);
                }}
                className="flex-1 py-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-400 text-xs font-mono font-bold transition-colors cursor-pointer"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedParentCat(null)}
                className="flex-1 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-mono font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Subcategory Inline Modal */}
      {showAddSubModal && selectedParentCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
          onClick={() => setShowAddSubModal(false)}
        >
          <div
            className="w-full max-w-xs bg-[#101014] rounded-2xl p-5 border border-zinc-800 shadow-2xl space-y-3 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xs font-bold text-white font-mono">
              Add to {selectedParentCat.name}
            </h3>
            <form onSubmit={handleCreateSubcategory} className="space-y-3">
              <input
                type="text"
                placeholder="Subcategory name (e.g. Coffee, Taxi)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                autoFocus
                className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none border border-zinc-800/60"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-xl cursor-pointer"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Top-Level Category Modal */}
      {showAddParentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
          onClick={() => setShowAddParentModal(false)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md md:max-w-lg bg-[#101014] rounded-2xl md:rounded-3xl p-5 sm:p-6 md:p-8 border border-zinc-800 shadow-2xl space-y-4 sm:space-y-5 cursor-default transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-bold text-white font-mono capitalize">
              New {tab} Category
            </h3>
            <form onSubmit={handleCreateParent} className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Essentials, Savings, Entertainment"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  autoFocus
                  className="w-full bg-[#16161d] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none border border-zinc-800/60"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                  Icon
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-[#16161d] rounded-xl border border-zinc-800/60">
                  {availableIcons.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewCatIcon(ic)}
                      className={`p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                        newCatIcon === ic
                          ? 'bg-white text-black font-bold shadow-xs'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <CategoryIcon name={ic} size={15} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddParentModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Settings View ───────────────────────────────────────────

export const SettingsView: React.FC = () => {
  const {
    state,
    updateSettings,
    exportDataJSON,
    importDataJSON,
    clearAllData,
    addAccount,
    deleteAccount,
  } = useFinance();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [subPage, setSubPage] = useState<SettingsSubPage>(null);
  useBackButton(Boolean(subPage), () => setSubPage(null));
  const [showWallets, setShowWallets] = useState(false);
  const [showAddAcc, setShowAddAcc] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<Account['type']>('bank');
  const [newAccBalance, setNewAccBalance] = useState('0');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJSON(content);
        setImportStatus(success ? 'Backup restored!' : 'Invalid backup file.');
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    addAccount({
      name: newAccName.trim(),
      type: newAccType,
      initialBalance: parseFormattedNumber(newAccBalance),
      icon: newAccType === 'cash' ? 'Wallet' : 'CreditCard',
    });
    setNewAccName('');
    setNewAccBalance('0');
    setShowAddAcc(false);
  };

  // ── Sub-pages ──
  if (subPage === 'goals')
    return (
      <div className="space-y-6 pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
        <GoalsSubPage onBack={() => setSubPage(null)} />
      </div>
    );

  if (subPage === 'categories')
    return (
      <div className="space-y-6 pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
        <CategoriesSubPage onBack={() => setSubPage(null)} />
      </div>
    );

  if (subPage === 'recurring')
    return (
      <div className="space-y-6 pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
        <RecurringManager onBack={() => setSubPage(null)} />
      </div>
    );

  // ── Main Settings ──
  return (
    <div className="pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none space-y-3">
      <div className="h-8 flex items-center justify-between pt-1">
        <h2 className="text-xl font-bold tracking-tight text-white font-mono">SETTINGS</h2>
      </div>

      {importStatus && (
        <div className="p-3 rounded-xl bg-white text-black text-xs font-bold text-center animate-fade-in font-mono mb-3">
          {importStatus}
        </div>
      )}

      {/* ── Preferences ── */}
      <Card>
        {/* Currency Symbol + Code inline */}
        <div className="flex items-center gap-3 py-3.5 px-4 min-h-[58px]">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
            <DollarSign size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">Currency</div>
            <div className="text-[10px] text-zinc-500 font-mono">
              Active: {state.settings.currencySymbol} ({state.settings.currencyCode})
            </div>
          </div>
          <div className="w-40 shrink-0">
            <CustomSelect
              value={`${state.settings.currencySymbol}|${state.settings.currencyCode}`}
              onChange={(val) => {
                const [sym, code] = val.split('|');
                updateSettings({ currencySymbol: sym, currencyCode: code });
              }}
              options={[
                { value: '฿|THB', label: '฿ THB (Baht)' },
                { value: '$|USD', label: '$ USD (Dollar)' },
                { value: '€|EUR', label: '€ EUR (Euro)' },
                { value: '¥|JPY', label: '¥ JPY (Yen)' },
                { value: '£|GBP', label: '£ GBP (Pound)' },
                { value: 'S$|SGD', label: 'S$ SGD (Singapore)' },
                { value: 'A$|AUD', label: 'A$ AUD (Australia)' },
                { value: '₩|KRW', label: '₩ KRW (Won)' },
                { value: '¥|CNY', label: '¥ CNY (Yuan)' },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 py-3.5 px-4 min-h-[58px]">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
            <CalendarDays size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">Start Day of Week</div>
            <div className="text-[10px] text-zinc-500 font-mono">
              Calendar &amp; weekly calculations
            </div>
          </div>
          <div className="w-40 shrink-0">
            <CustomSelect
              value={String(state.settings.weekStartDay ?? 1)}
              onChange={(val) => {
                const day = parseInt(val, 10) as 0 | 1 | 6;
                updateSettings({ weekStartDay: day });
              }}
              options={[
                { value: '1', label: 'Monday' },
                { value: '0', label: 'Sunday' },
                { value: '6', label: 'Saturday' },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 py-3.5 px-4 min-h-[58px]">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
            <Keyboard size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">Quick Add Shortcut</div>
            <div className="text-[10px] text-zinc-500">Press key anywhere to add transaction</div>
          </div>
          <input
            type="text"
            maxLength={1}
            value={state.settings.quickAddKeybind || 'n'}
            onChange={(e) => {
              const val = e.target.value.trim().toLowerCase();
              if (val) updateSettings({ quickAddKeybind: val });
            }}
            className="w-10 h-9 text-center bg-[#16161d] rounded-xl text-xs font-mono font-bold text-white uppercase border border-zinc-800 focus:outline-none focus:border-white transition-colors shrink-0"
          />
        </div>
      </Card>

      {/* ── Manage ── */}
      <SectionLabel>Manage</SectionLabel>
      <Card>
        <Row
          icon={<Target size={15} />}
          title="Spending Goals"
          subtitle="Set range goals & category allocations"
          onClick={() => setSubPage('goals')}
        />
        <Row
          icon={<Tag size={15} />}
          title="Categories"
          subtitle="Manage parent & subcategories"
          onClick={() => setSubPage('categories')}
        />
        <Row
          icon={<RefreshCw size={15} />}
          title={`Recurring & Subscriptions (${state.recurring?.length || 0})`}
          subtitle="Manage scheduled bills, salaries & subscriptions"
          onClick={() => setSubPage('recurring')}
        />
        <Row
          icon={<Wallet size={15} />}
          title={`Wallets & Accounts (${state.accounts.length})`}
          subtitle="Add or remove linked wallets"
          onClick={() => setShowWallets(!showWallets)}
          right={
            <ChevronRight
              size={15}
              className={`text-zinc-600 transition-transform ${showWallets ? 'rotate-90' : ''}`}
            />
          }
        />
        {showWallets && (
          <div className="px-4 pb-3 space-y-2 animate-fade-in">
            {/* Add wallet form */}
            {showAddAcc && (
              <form
                onSubmit={handleCreateAccount}
                className="space-y-2 bg-[#16161d] rounded-xl p-3 border border-zinc-800/60"
              >
                <input
                  type="text"
                  placeholder="Wallet name (e.g. PayPal)"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full h-11 bg-[#101014] rounded-xl px-3.5 text-xs text-white focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <CustomSelect
                    value={newAccType}
                    onChange={(val) => setNewAccType(val as Account['type'])}
                    options={[
                      { value: 'bank', label: 'Bank' },
                      { value: 'cash', label: 'Cash' },
                      { value: 'credit', label: 'Credit' },
                      { value: 'savings', label: 'Savings' },
                      { value: 'investment', label: 'Investment' },
                    ]}
                  />
                  <CurrencyInput
                    currencySymbol={state.settings.currencySymbol}
                    type="number"
                    placeholder="Initial balance"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full h-11 bg-[#101014] rounded-xl px-3.5 text-xs text-white focus:outline-none font-mono border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAcc(false)}
                    className="px-3 py-1 text-xs text-zinc-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}
            <div className="divide-y divide-zinc-900/60">
              {state.accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <CreditCard size={13} className="text-zinc-500" />
                    <span className="text-xs text-white">{acc.name}</span>
                    <span className="text-[9px] text-zinc-600 uppercase font-mono">({acc.type})</span>
                  </div>
                  {state.accounts.length > 1 && (
                    <button
                      onClick={() => deleteAccount(acc.id)}
                      className="text-zinc-700 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowAddAcc(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors mt-1"
            >
              <Plus size={13} /> Add wallet
            </button>
          </div>
        )}
      </Card>

      {/* ── Data ── */}
      <SectionLabel>Data &amp; Backup</SectionLabel>
      <Card>
        <Row
          icon={<Download size={15} />}
          title="Export Backup"
          subtitle="Save a JSON file of all your data"
          onClick={exportDataJSON}
        />
        <Row
          icon={<Upload size={15} />}
          title="Restore Backup"
          subtitle="Import a previously exported JSON file"
          onClick={() => fileInputRef.current?.click()}
        />
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
        <Row
          icon={<Trash2 size={15} />}
          title="Reset All Data"
          subtitle="Erase everything and start fresh"
          danger
          onClick={() => {
            if (window.confirm('Erase all data and reset to defaults?')) clearAllData();
          }}
        />
      </Card>

      {/* ── Security ── */}
      <SectionLabel>Security</SectionLabel>
      <Card>
        <div className="flex items-center gap-3 py-3 px-4">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck size={15} />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-medium text-white">Owner Vault</div>
            <div className="text-[10px] text-zinc-500">Encrypted Supabase Auth — stays signed in</div>
          </div>
        </div>
        <Row
          icon={<LogOut size={15} />}
          title="Lock &amp; Sign Out"
          subtitle="Log out and lock the vault"
          onClick={() => {
            if (window.confirm('Lock vault and sign out?')) supabase?.auth.signOut();
          }}
        />
      </Card>
    </div>
  );
};
