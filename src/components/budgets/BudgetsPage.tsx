import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Target,
  ArrowLeft,
  X,
  Pin,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { CategoryIcon, formatCurrency } from '../common/Icons';
import { CustomSelect } from '../common/CustomSelect';
import { CurrencyInput, parseFormattedNumber } from '../common/CurrencyInput';
import { CustomDateInput } from '../common/CustomDatePicker';
import type { Budget, BudgetCategoryAllocation } from '../../types/finance';
import { useBackButton } from '../../hooks/useBackButton';
import { getBudgetSpending, getBudgetPercent, getBudgetDaysLeft, getCategoryAllocPercent, getBudgetWindowLabel } from '../../utils/budgetMath';

/** Overall budget stat card — identical in the list and the detail modal. */
const OverallCard: React.FC<{ amount: number; spent: number; percent: number; symbol: string; pinned?: boolean }> = ({
  amount, spent, percent, symbol, pinned,
}) => (
  <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-sm ${
    pinned ? 'bg-[#14141a] border-zinc-800' : 'bg-[#101014] border-zinc-900/60'
  }`}>
    <div>
      <div className="text-xs font-bold text-white font-mono uppercase tracking-wider">Overall Budget</div>
      <div className="text-xs text-zinc-400 font-mono mt-0.5 truncate max-w-[140px] sm:max-w-none">{formatCurrency(amount, symbol)}</div>
    </div>
    <div className="text-right">
      <div className="text-xs font-bold text-white font-mono">{percent}%</div>
      <div className="text-xs text-zinc-400 font-mono mt-0.5">{formatCurrency(spent, symbol)} used</div>
    </div>
  </div>
);

/**
 * Shared Budgets page — the single source of the budget-list UI.
 * Settings and Today both render this exact page (Daily card included).
 */
export const BudgetsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { state, addBudget, updateBudget, deleteBudget, updateSettings } = useFinance();
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

  // Daily budget editor (inline, same on every host)
  const [goalInput, setGoalInput] = useState(() => String(state.settings.goals?.daily || ''));
  const [editingDaily, setEditingDaily] = useState(false);

  // Pin one budget to the top of the list (device-local, keeps the DB schema untouched)
  const [pinnedId, setPinnedId] = useState<string | null>(() => {
    try { return localStorage.getItem('nova-pinned-budget'); } catch { return null; }
  });
  const togglePin = (id: string) => {
    setPinnedId((prev) => {
      const next = prev === id ? null : id;
      try {
        if (next) localStorage.setItem('nova-pinned-budget', next);
        else localStorage.removeItem('nova-pinned-budget');
      } catch {}
      return next;
    });
  };
  const sortedBudgets = useMemo(() => {
    if (!pinnedId) return state.budgets;
    const pinned = state.budgets.filter((b) => b.id === pinnedId);
    return [...pinned, ...state.budgets.filter((b) => b.id !== pinnedId)];
  }, [state.budgets, pinnedId]);

  const expenseCategories = useMemo(
    () => state.categories.filter((c) => c.type === 'expense' && !c.parentId),
    [state.categories]
  );

  const openCreateModal = () => {
    const now = new Date();
    setEditingBudgetId(null);
    setName('Monthly Budget');
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
    setName(b.name || 'Monthly Budget');
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

  /** Current week (Mon–Sun) bounds as YYYY-MM-DD. */
  const currentWeekBounds = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [start, end].map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const handlePeriodChange = (newPeriod: Budget['period']) => {
    setPeriod(newPeriod);
    const now = new Date();
    if (newPeriod === 'daily') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (newPeriod === 'weekly') {
      const [monday, sunday] = currentWeekBounds();
      setStartDate(monday);
      setEndDate(sunday);
    } else {
      // monthly: 1st to last day of month
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
        name: name.trim() || 'Monthly Budget',
        amount: totalAmount,
        period,
        startDate,
        endDate,
        categories: categoryAllocations,
      });
    } else {
      addBudget({
        name: name.trim() || 'Monthly Budget',
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

  const handleSaveDailyGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFormattedNumber(goalInput) || undefined;
    updateSettings({
      goals: {
        ...state.settings.goals,
        daily: val,
      },
    });
    setEditingDaily(false);
  };

  // Budget math comes from the shared utils/budgetMath helper (same numbers everywhere)
  const getBudgetSpendingFor = (budget: Budget) => getBudgetSpending(budget, state.transactions);

  // ── Daily budget section (Today only) ──
  const dailyGoal = state.settings.goals?.daily || 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTotals = useMemo(() => {
    let inc = 0;
    let exp = 0;
    state.transactions.forEach((tx) => {
      if (tx.date !== todayStr) return;
      if (tx.type === 'income') inc += tx.amount;
      if (tx.type === 'expense') exp += tx.amount;
    });
    return { inc, exp };
  }, [state.transactions, todayStr]);
  const todayGoalProgress = dailyGoal > 0 ? Math.min(100, Math.round((todayTotals.exp / dailyGoal) * 100)) : 0;
  const todayIsOverGoal = dailyGoal > 0 && todayTotals.exp > dailyGoal;

  return (
    <div className="space-y-3 animate-fade-in min-h-full flex flex-col flex-1">
      {/* Top Header */}
      <div className="h-8 flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="hidden sm:flex w-8 h-8 rounded-xl bg-zinc-900 items-center justify-center text-zinc-300 cursor-pointer hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono">BUDGETS</h2>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <Plus size={13} strokeWidth={2.8} />
          New Budget
        </button>
      </div>

      {/* Daily budget — same card language as the range-budget list (tap to edit). Hidden until a daily goal exists. */}
      <div
        onClick={() => setEditingDaily(!editingDaily)}
        className={`space-y-2 cursor-pointer active:scale-98 transition-all ${dailyGoal > 0 || editingDaily ? '' : 'hidden'}`}
      >
        <div className="flex items-center justify-between text-xs font-mono px-1">
          <span className="font-bold text-rose-400">Daily</span>
          <span className="text-[11px] text-zinc-400 font-bold">{todayStr}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#16161f] border border-zinc-800/80 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs font-bold text-white font-mono">Spent today</div>
            <div className="text-xs text-zinc-400 font-mono mt-0.5">
              {dailyGoal > 0 ? formatCurrency(dailyGoal, state.settings.currencySymbol) : 'Not set — tap to add'}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-xs font-bold font-mono ${todayIsOverGoal ? 'text-rose-400' : 'text-white'}`}>
              {dailyGoal > 0 ? `${todayGoalProgress}%` : '—'}
            </div>
            <div className="text-xs text-zinc-400 font-mono mt-0.5">
              {formatCurrency(todayTotals.exp, state.settings.currencySymbol)}
            </div>
          </div>
        </div>

        {editingDaily && (
          <form
            onSubmit={handleSaveDailyGoal}
            onClick={(e) => e.stopPropagation()}
            className="flex gap-2 animate-fade-in"
          >
            <CurrencyInput
              currencySymbol={state.settings.currencySymbol}
              type="number"
              placeholder="e.g. 500"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="flex-1 bg-[#16161d] rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-white text-black text-xs font-bold rounded-xl cursor-pointer active:scale-95 transition-all"
            >
              Save
            </button>
          </form>
        )}
      </div>

      {/* List of Budgets — placeholder only when nothing is set at all (no range budgets AND no daily goal) */}
      {state.budgets.length === 0 && !dailyGoal ? (
        <div className="p-8 rounded-2xl bg-[#101014] border border-zinc-900/60 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
            <Target size={18} />
          </div>
          <div className="text-xs text-zinc-400 font-medium">No budgets set</div>
          <p className="text-[10px] text-zinc-600 max-w-xs mx-auto">
            Create a date range budget and allocate limits for categories like Food, Essentials, or Savings.
          </p>
          <div className="mt-2 flex items-center gap-2">
            {dailyGoal === 0 && (
              <button
                onClick={() => {
                  setGoalInput('');
                  setEditingDaily(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold cursor-pointer border border-zinc-800"
              >
                <Plus size={13} /> Set Daily Budget
              </button>
            )}
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold cursor-pointer"
            >
              <Plus size={13} /> Add Budget
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedBudgets.map((b) => {
            const { totalSpent, categorySpent } = getBudgetSpendingFor(b);
            const percent = getBudgetPercent(b, totalSpent);

            return (
              <div
                key={b.id}
                onClick={() => setSelectedGoal(b)}
                className="space-y-2 cursor-pointer active:scale-98 transition-all"
              >
                {/* Header row: Red-tinted period name (e.g. Monthly) + Date range + pin */}
                <div className="flex items-center justify-between text-xs font-mono px-1">
                  <span className="font-bold text-rose-400 capitalize">
                    {b.period === 'daily' ? 'Daily' : b.period === 'weekly' ? 'Weekly' : b.period === 'monthly' ? 'Monthly' : 'Custom Range'} Budget
                    {b.id === pinnedId && <span className="text-[9px] text-zinc-400 uppercase tracking-widest ml-2">Pinned</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-zinc-400 font-bold">
                      {getBudgetWindowLabel(b)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(b.id); }}
                      aria-label={b.id === pinnedId ? 'Unpin' : 'Pin to top'}
                      className="p-1 rounded-lg hover:bg-zinc-900 cursor-pointer transition-colors"
                    >
                      <Pin size={11} className={b.id === pinnedId ? 'text-white fill-white' : 'text-zinc-600'} />
                    </button>
                  </div>
                </div>

                {/* Overall banner card */}
                <OverallCard amount={b.amount} spent={totalSpent} percent={percent} symbol={state.settings.currencySymbol} pinned={b.id === pinnedId} />

                {/* Subcategory mini chips row (Reference styling) */}
                {b.categories && b.categories.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-0.5">                      {b.categories.map((catAlloc) => {
                        const cat = state.categories.find((c) => c.id === catAlloc.categoryId);
                        const catPercent = getCategoryAllocPercent(catAlloc, categorySpent);

                      return (
                        <div
                          key={catAlloc.categoryId}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-[#101014] border border-zinc-900/60 shrink-0 text-xs shadow-sm"
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
        const { totalSpent, categorySpent } = getBudgetSpendingFor(selectedGoal);
        const percent = getBudgetPercent(selectedGoal, totalSpent);
        const remaining = Math.max(0, selectedGoal.amount - totalSpent);

        // Days left calculation
        const daysLeft = getBudgetDaysLeft(selectedGoal);
        const dailyAllowance = (remaining / daysLeft).toFixed(2);

        return createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
            onClick={() => setSelectedGoal(null)}
          >
            <div
              className="w-full sm:max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[85dvh] bg-[#0c0c10] border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-3 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <Target size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white font-mono">{selectedGoal.name || 'Monthly Budget'}</h3>                      <p className="text-[10px] text-zinc-500 font-mono">
                      {getBudgetWindowLabel(selectedGoal)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedGoal(null)}
                  className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Overall Big Highlight Card */}
                <div className="p-4 rounded-2xl bg-[#16161d] border border-zinc-800/60 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white font-mono">Overall</div>
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
                  {/* Progress meter (same language as the budget list cards) */}
                  <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                    <div
                      style={{ width: `${percent}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        percent >= 100 ? 'bg-rose-500' : percent > 80 ? 'bg-amber-400' : 'bg-white'
                      }`}
                    />
                  </div>
                </div>

                {/* Category Breakdown list (Reference style cards) */}
                {selectedGoal.categories && selectedGoal.categories.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedGoal.categories.map((c) => {
                      const cat = state.categories.find((item) => item.id === c.categoryId);
                      const catPct = getCategoryAllocPercent(c, categorySpent);

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

                {/* Stats Footer (Period, Days Remaining, Daily Allowance) */}
                <div className="pt-3 border-t border-zinc-900 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-zinc-400">
                  <div className="flex justify-between p-2 rounded-xl bg-[#16161d] border border-zinc-800/40">
                    <span>Period</span>
                    <span className="text-white capitalize">{selectedGoal.period}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-[#16161d] border border-zinc-800/40">
                    <span>Days Remaining</span>
                    <span className="text-white font-bold">{daysLeft} days</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-xl bg-[#16161d] border border-zinc-800/40">
                    <span>Daily Allowance</span>
                    <span className="text-white font-bold">
                      {formatCurrency(parseFloat(dailyAllowance), state.settings.currencySymbol)}
                      <span className="text-zinc-500"> / day</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Delete | Edit */}
              <div className="p-4 sm:p-6 border-t border-zinc-800/80 bg-[#0c0c10] flex items-center gap-2.5 shrink-0 safe-bottom">
                <button
                  type="button"
                  onClick={() => {
                    deleteBudget(selectedGoal.id);
                    setSelectedGoal(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-400 text-xs font-mono font-bold transition-colors cursor-pointer text-center"
                >
                  Delete Budget
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(selectedGoal)}
                  className="flex-1 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-mono font-bold transition-all cursor-pointer text-center shadow-md active:scale-95"
                >
                  Edit Budget
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Create Spending Goal Modal */}
      {showCreateModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[85dvh] bg-[#0c0c10] border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-3 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <Target size={16} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-mono">
                    {editingBudgetId ? 'Edit Budget' : 'Create Budget'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveGoal} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">Budget Name</label>
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
                      {(['daily', 'weekly', 'monthly'] as const).map((p) => (
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
                    <p className="text-[10px] text-zinc-600 font-mono mt-1.5">
                      Each period auto-resets: {period === 'daily' ? 'spent clears every day' : period === 'weekly' ? 'spent clears every Monday' : 'spent clears on the 1st of each month'}.
                    </p>
                  </div>

                  {/* Date Pickers — read-only preview of current window */}
                  <div className="grid grid-cols-2 gap-2">
                    <CustomDateInput
                      label="Current window start"
                      value={startDate}
                      onChange={setStartDate}
                      required
                    />
                    <CustomDateInput
                      label="Current window end"
                      value={endDate}
                      onChange={setEndDate}
                      required
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 font-mono -mt-2 col-span-2">
                    Dates show the current {period} window. The next period starts automatically.
                  </p>

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
                </div>

                {/* Form Actions */}
                <div className="p-4 sm:p-6 border-t border-zinc-800/80 bg-[#0c0c10] flex justify-end gap-2.5 shrink-0 safe-bottom">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-400 hover:text-white cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-white text-black text-xs font-bold font-mono rounded-xl cursor-pointer active:scale-95 hover:bg-zinc-200 transition-all shadow-md"
                  >
                    Save Budget
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
