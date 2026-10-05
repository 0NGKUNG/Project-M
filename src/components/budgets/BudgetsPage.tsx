import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Target,
  ArrowLeft,
  X,
  Pin,
  Calendar,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { CategoryIcon, formatCurrency } from '../common/Icons';
import { CustomSelect } from '../common/CustomSelect';
import { CurrencyInput, parseFormattedNumber } from '../common/CurrencyInput';
import type { Budget, BudgetCategoryAllocation } from '../../types/finance';
import { useBackButton } from '../../hooks/useBackButton';
import {
  getBudgetSpending,
  getBudgetPercent,
  getBudgetDaysLeft,
  getCategoryAllocPercent,
  getBudgetWindowLabel,
  getCurrentPeriodBounds,
} from '../../utils/budgetMath';

/** Visual Infographic Budget Card */
const BudgetCard: React.FC<{
  budget: Budget;
  totalSpent: number;
  symbol: string;
  isPinned: boolean;
  weekStartDay: number;
  onSelect: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
}> = ({
  budget,
  totalSpent,
  symbol,
  isPinned,
  weekStartDay,
  onSelect,
  onTogglePin,
}) => {
  const percent = getBudgetPercent(budget, totalSpent);
  const remaining = Math.max(0, budget.amount - totalSpent);
  const isOver = totalSpent > budget.amount;
  const daysLeft = getBudgetDaysLeft(budget, weekStartDay);
  const windowLabel = getBudgetWindowLabel(budget, weekStartDay);

  const periodBadge =
    budget.period === 'daily'
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
      : budget.period === 'weekly'
      ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
      : budget.period === 'monthly'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
      : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/40';

  const categoryCount = budget.categories?.length || 0;

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer select-none active:scale-[0.99] group shadow-sm hover:shadow-md flex flex-col justify-between ${
        isPinned
          ? 'bg-[#121218] border-zinc-700/80 shadow-zinc-950/40'
          : 'bg-[#0f0f13] hover:bg-[#121217] border-zinc-800/60 hover:border-zinc-700/60'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${periodBadge}`}>
            {budget.period}
          </span>
          <h3 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight truncate">
            {budget.name || `${budget.period} Budget`}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-400 font-normal">
            {windowLabel}
          </span>
          <button
            onClick={onTogglePin}
            aria-label={isPinned ? 'Unpin from Today' : 'Pin to Today'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isPinned
                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
                : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60'
            }`}
            title={isPinned ? 'Pinned on Today' : 'Pin to Today'}
          >
            <Pin size={13} className={isPinned ? 'text-amber-400 fill-amber-400' : ''} />
          </button>
        </div>
      </div>

      {/* Main Numbers + Percentage */}
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl sm:text-[28px] font-bold tracking-tight text-white tabular-nums">
            {formatCurrency(totalSpent, symbol)}
          </span>
          <span className="text-xs sm:text-sm text-zinc-400 font-normal tabular-nums">
            / {formatCurrency(budget.amount, symbol)}
          </span>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border tabular-nums shrink-0 ${
            isOver
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              : percent > 85
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/40'
          }`}
        >
          {percent}%
        </span>
      </div>

      {/* Sleek Minimal Progress Bar */}
      <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden mb-3">
        <div
          style={{ width: `${Math.min(100, percent)}%` }}
          className={`h-full rounded-full transition-all duration-500 ${
            isOver ? 'bg-rose-500' : percent > 85 ? 'bg-amber-400' : 'bg-white'
          }`}
        />
      </div>

      {/* Bottom Status Row */}
      <div className="flex items-center justify-between text-xs pt-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isOver ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'
            }`}
          />
          <span
            className={`font-medium tabular-nums ${
              isOver ? 'text-rose-400' : 'text-zinc-300'
            }`}
          >
            {isOver
              ? `${formatCurrency(totalSpent - budget.amount, symbol)} over limit`
              : `${formatCurrency(remaining, symbol)} remaining`}
          </span>
        </div>

        <div className="flex items-center gap-2 text-zinc-400 font-normal tabular-nums">
          {categoryCount > 0 && (
            <span>{categoryCount} {categoryCount === 1 ? 'category' : 'categories'}</span>
          )}
          {categoryCount > 0 && <span>•</span>}
          <span>{daysLeft}d left</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Shared Budgets page — the single source of the budget-list UI.
 * Settings and Today both render this exact page (Daily card included).
 */
export const BudgetsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { state, addBudget, updateBudget, deleteBudget, updateSettings } = useFinance();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Budget | null>(null);

  const weekStartDay = state.settings.weekStartDay ?? 1;

  useBackButton(Boolean(showCreateModal || selectedGoal), () => {
    if (showCreateModal) setShowCreateModal(false);
    else if (selectedGoal) setSelectedGoal(null);
  });

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<Budget['period']>('monthly');
  const [startDate, setStartDate] = useState(() => getCurrentPeriodBounds('monthly', weekStartDay).startDate);
  const [endDate, setEndDate] = useState(() => getCurrentPeriodBounds('monthly', weekStartDay).endDate);
  const [categoryAllocations, setCategoryAllocations] = useState<BudgetCategoryAllocation[]>([]);
  const [tempCatId, setTempCatId] = useState('');
  const [tempCatAmount, setTempCatAmount] = useState('');

  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  // Daily budget editor (inline, same on every host)
  const [goalInput, setGoalInput] = useState(() => String(state.settings.goals?.daily || ''));
  const [editingDaily, setEditingDaily] = useState(false);

  // Pin one budget to show in Today page and top of list
  const pinnedId = state.settings.pinnedBudgetId !== undefined
    ? state.settings.pinnedBudgetId
    : (() => { try { return localStorage.getItem('xero-pinned-budget'); } catch { return null; } })();

  const togglePin = (id: string) => {
    const next = pinnedId === id ? null : id;
    updateSettings({ pinnedBudgetId: next });
    try {
      if (next) localStorage.setItem('xero-pinned-budget', next);
      else localStorage.removeItem('xero-pinned-budget');
    } catch {}
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
    const bounds = getCurrentPeriodBounds('monthly', weekStartDay);
    setEditingBudgetId(null);
    setName('Monthly Budget');
    setPeriod('monthly');
    setAmount('');
    setStartDate(bounds.startDate);
    setEndDate(bounds.endDate);
    setCategoryAllocations([]);
    setTempCatId(expenseCategories[0]?.id || '');
    setTempCatAmount('');
    setShowCreateModal(true);
  };

  const openEditModal = (b: Budget) => {
    const bounds = getCurrentPeriodBounds(b.period || 'monthly', weekStartDay);
    setEditingBudgetId(b.id);
    setName(b.name || (b.period === 'daily' ? 'Daily Budget' : b.period === 'weekly' ? 'Weekly Budget' : 'Monthly Budget'));
    setPeriod(b.period || 'monthly');
    setAmount(String(b.amount));
    setStartDate(b.startDate || bounds.startDate);
    setEndDate(b.endDate || bounds.endDate);
    const existingAllocations = b.categories || [];
    setCategoryAllocations(existingAllocations);
    const nextAvail = expenseCategories.find(
      (c) => !existingAllocations.some((a) => a.categoryId === c.id)
    );
    setTempCatId(nextAvail?.id || expenseCategories[0]?.id || '');
    setTempCatAmount('');
    setSelectedGoal(null);
    setShowCreateModal(true);
  };

  const handlePeriodChange = (newPeriod: Budget['period']) => {
    setPeriod(newPeriod);
    const bounds = getCurrentPeriodBounds(newPeriod, weekStartDay);
    setStartDate(bounds.startDate);
    setEndDate(bounds.endDate);
    if (!name || name === 'Daily Budget' || name === 'Weekly Budget' || name === 'Monthly Budget') {
      setName(newPeriod === 'daily' ? 'Daily Budget' : newPeriod === 'weekly' ? 'Weekly Budget' : 'Monthly Budget');
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
    const nextAvail = expenseCategories.find(
      (c) => c.id !== tempCatId && !categoryAllocations.some((a) => a.categoryId === c.id)
    );
    if (nextAvail) {
      setTempCatId(nextAvail.id);
    }
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
  const getBudgetSpendingFor = (budget: Budget) => getBudgetSpending(budget, state.transactions, weekStartDay);

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

      {/* Daily budget card (tap to edit) */}
      <div
        onClick={() => setEditingDaily(!editingDaily)}
        className={`rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer select-none active:scale-[0.99] group shadow-sm hover:shadow-md ${
          pinnedId === 'daily'
            ? 'bg-[#121218] border-zinc-700/80 shadow-zinc-950/40'
            : 'bg-[#0f0f13] hover:bg-[#121217] border-zinc-800/60 hover:border-zinc-700/60'
        } ${dailyGoal > 0 || editingDaily ? '' : 'hidden'}`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-amber-500/10 text-amber-300 border-amber-500/20 shrink-0">
              Daily
            </span>
            <h3 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight truncate">
              Daily Spending Goal
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-400 font-normal">
              {todayStr}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePin('daily');
              }}
              aria-label={pinnedId === 'daily' ? 'Unpin from Today' : 'Pin to Today'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                pinnedId === 'daily'
                  ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
                  : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60'
              }`}
              title={pinnedId === 'daily' ? 'Pinned on Today' : 'Pin to Today'}
            >
              <Pin size={13} className={pinnedId === 'daily' ? 'text-amber-400 fill-amber-400' : ''} />
            </button>
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-3 mb-2.5">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-2xl sm:text-[28px] font-bold tracking-tight text-white tabular-nums">
              {formatCurrency(todayTotals.exp, state.settings.currencySymbol)}
            </span>
            <span className="text-xs sm:text-sm text-zinc-400 font-normal tabular-nums">
              / {dailyGoal > 0 ? formatCurrency(dailyGoal, state.settings.currencySymbol) : 'No limit'}
            </span>
          </div>
          {dailyGoal > 0 && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border tabular-nums shrink-0 ${
                todayIsOverGoal
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : todayGoalProgress > 85
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/40'
              }`}
            >
              {todayGoalProgress}%
            </span>
          )}
        </div>

        {dailyGoal > 0 && (
          <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden mb-3">
            <div
              style={{ width: `${Math.min(100, todayGoalProgress)}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                todayIsOverGoal ? 'bg-rose-500' : todayGoalProgress > 85 ? 'bg-amber-400' : 'bg-white'
              }`}
            />
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                todayIsOverGoal
                  ? 'bg-rose-500 animate-pulse'
                  : dailyGoal > 0
                  ? 'bg-emerald-400'
                  : 'bg-zinc-500'
              }`}
            />
            <span
              className={`font-medium tabular-nums ${
                todayIsOverGoal
                  ? 'text-rose-400'
                  : dailyGoal > 0
                  ? 'text-zinc-300'
                  : 'text-zinc-400'
              }`}
            >
              {todayIsOverGoal
                ? `${formatCurrency(todayTotals.exp - dailyGoal, state.settings.currencySymbol)} over daily goal`
                : dailyGoal > 0
                ? `${formatCurrency(Math.max(0, dailyGoal - todayTotals.exp), state.settings.currencySymbol)} remaining today`
                : 'Tap to configure daily goal'}
            </span>
          </div>
          <span className="text-zinc-400 font-normal">Today</span>
        </div>

        {editingDaily && (
          <form
            onSubmit={handleSaveDailyGoal}
            onClick={(e) => e.stopPropagation()}
            className="flex gap-2 mt-3 pt-3 border-t border-zinc-800/80 animate-fade-in"
          >
            <CurrencyInput
              currencySymbol={state.settings.currencySymbol}
              type="number"
              placeholder="e.g. 500"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="flex-1 bg-[#14141c] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none border border-zinc-800 focus:border-zinc-600 tabular-nums"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-white text-black text-xs font-semibold rounded-xl cursor-pointer active:scale-95 transition-all shadow-sm"
            >
              Save
            </button>
          </form>
        )}
      </div>

      {/* List of Budgets — placeholder only when nothing is set at all (no range budgets AND no daily goal) */}
      {state.budgets.length === 0 && !dailyGoal ? (
        <div className="p-8 rounded-3xl bg-[#101014] border border-zinc-900/60 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
            <Target size={18} />
          </div>
          <div className="text-xs text-zinc-400 font-medium">No budgets set</div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          {sortedBudgets.map((b) => {
            const { totalSpent } = getBudgetSpendingFor(b);

            return (
              <BudgetCard
                key={b.id}
                budget={b}
                totalSpent={totalSpent}
                symbol={state.settings.currencySymbol}
                isPinned={b.id === pinnedId}
                weekStartDay={weekStartDay}
                onSelect={() => setSelectedGoal(b)}
                onTogglePin={(e) => {
                  e.stopPropagation();
                  togglePin(b.id);
                }}
              />
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
        const daysLeft = getBudgetDaysLeft(selectedGoal, weekStartDay);
        const dailyAllowance = (remaining / daysLeft).toFixed(2);

        return createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none overflow-y-auto"
            onClick={() => setSelectedGoal(null)}
          >
            <div
              className="w-full sm:max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[min(86dvh,calc(100dvh-2.5rem))] my-auto bg-[#0c0c10] border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-3 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <Target size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight">{selectedGoal.name || 'Monthly Budget'}</h3>
                    <p className="text-xs text-zinc-400 font-normal">
                      {getBudgetWindowLabel(selectedGoal, weekStartDay)}
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
                <div className="p-5 rounded-3xl bg-[#14141c] border border-zinc-800/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
                          {formatCurrency(totalSpent, state.settings.currencySymbol)}
                        </span>
                        <span className="text-xs sm:text-sm text-zinc-400 font-normal tabular-nums">
                          / {formatCurrency(selectedGoal.amount, state.settings.currencySymbol)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums border ${
                            totalSpent > selectedGoal.amount
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : percent > 85
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          }`}
                        >
                          {totalSpent > selectedGoal.amount ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              {formatCurrency(totalSpent - selectedGoal.amount, state.settings.currencySymbol)} over limit
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              {formatCurrency(remaining, state.settings.currencySymbol)} remaining
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Circular SVG Donut Gauge */}
                    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
                        <circle
                          cx="26"
                          cy="26"
                          r={22}
                          className="stroke-zinc-800"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <circle
                          cx="26"
                          cy="26"
                          r={22}
                          className={`transition-all duration-700 ${
                            totalSpent > selectedGoal.amount
                              ? 'stroke-rose-500'
                              : percent > 85
                              ? 'stroke-amber-400'
                              : 'stroke-white'
                          }`}
                          strokeWidth="4"
                          strokeDasharray={2 * Math.PI * 22}
                          strokeDashoffset={2 * Math.PI * 22 - (Math.min(percent, 100) / 100) * (2 * Math.PI * 22)}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-white tabular-nums">
                        {percent}%
                      </div>
                    </div>
                  </div>

                  {/* Progress meter */}
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
                    <div
                      style={{ width: `${Math.min(100, percent)}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        percent >= 100 ? 'bg-rose-500' : percent > 85 ? 'bg-amber-400' : 'bg-white'
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
                          className="p-3.5 rounded-2xl bg-[#14141c] border border-zinc-800/60 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-200">
                              <CategoryIcon name={cat?.icon || 'Tag'} size={15} />
                            </div>
                            <div className="font-semibold text-zinc-100">{cat?.name || 'Category'}</div>
                          </div>

                          <div className="text-right">
                            <div className="font-semibold text-white text-xs tabular-nums">{catPct}%</div>
                            <div className="text-[11px] text-zinc-400 tabular-nums">
                              {formatCurrency(c.amount, state.settings.currencySymbol)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Stats Footer (Period, Days Remaining, Daily Allowance) */}
                <div className="pt-3 border-t border-zinc-900 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-zinc-400">
                  <div className="flex justify-between p-2.5 rounded-xl bg-[#14141c] border border-zinc-800/40">
                    <span>Period</span>
                    <span className="text-white capitalize font-medium">{selectedGoal.period}</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-xl bg-[#14141c] border border-zinc-800/40">
                    <span>Days Remaining</span>
                    <span className="text-white font-semibold tabular-nums">{daysLeft} days</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-xl bg-[#14141c] border border-zinc-800/40">
                    <span>Daily Allowance</span>
                    <span className="text-white font-semibold tabular-nums">
                      {formatCurrency(parseFloat(dailyAllowance), state.settings.currencySymbol)}
                      <span className="text-zinc-400 font-normal"> / day</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Delete | Edit */}
              <div className="px-5 sm:px-6 py-4 sm:py-4.5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-zinc-800/80 bg-[#0c0c10] flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    deleteBudget(selectedGoal.id);
                    setSelectedGoal(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-400 text-xs font-semibold transition-colors cursor-pointer text-center"
                >
                  Delete Budget
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(selectedGoal)}
                  className="flex-1 py-3 px-4 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all cursor-pointer text-center shadow-md active:scale-95"
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
        (() => {
          const totalBudgetAmount = parseFormattedNumber(amount) || 0;
          const totalAllocated = categoryAllocations.reduce((sum, a) => sum + a.amount, 0);
          const unallocatedAmount = Math.max(0, totalBudgetAmount - totalAllocated);
          const isOverAllocated = totalBudgetAmount > 0 && totalAllocated > totalBudgetAmount;
          const allocatedPercent = totalBudgetAmount > 0 ? Math.min(100, Math.round((totalAllocated / totalBudgetAmount) * 100)) : 0;
          const availableCategories = expenseCategories.filter(
            (c) => !categoryAllocations.some((a) => a.categoryId === c.id)
          );
          const resetDayName = weekStartDay === 0 ? 'Sunday' : weekStartDay === 6 ? 'Saturday' : 'Monday';
          const cadenceNote =
            period === 'daily'
              ? 'Resets every day at midnight'
              : period === 'weekly'
              ? `Resets every ${resetDayName}`
              : 'Resets on the 1st of each month';
          const windowLabel = getBudgetWindowLabel({ period, startDate, endDate } as Budget, weekStartDay);

          return createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none overflow-y-auto"
              onClick={() => setShowCreateModal(false)}
            >
              <div
                className="w-full sm:max-w-xl max-h-[min(88dvh,calc(100dvh-2.5rem))] my-auto bg-[#0d0d12] border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-3.5 border-b border-zinc-800/80 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-zinc-800/90 border border-zinc-700/50 flex items-center justify-center text-zinc-300">
                      <Target size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                        {editingBudgetId ? 'Edit Budget' : 'Create Budget'}
                      </h3>
                      <p className="text-[11px] text-zinc-400 font-normal">
                        Control your spending limits and cycle
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveGoal} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-6 space-y-4 sm:space-y-5 custom-scrollbar">
                    {/* Period selection */}
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-medium block">
                        Cadence Period
                      </label>
                      <div className="grid grid-cols-3 bg-[#14141c] p-1 rounded-2xl border border-zinc-800/80 gap-1.5">
                        {(['daily', 'weekly', 'monthly'] as const).map((p) => {
                          const isSelected = period === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => handlePeriodChange(p)}
                              className={`py-2 px-2 rounded-xl text-xs capitalize transition-all cursor-pointer text-center ${
                                isSelected
                                  ? 'bg-white text-black shadow-sm font-semibold'
                                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40 font-medium'
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>

                      {/* Informative cycle badge (clean & automatic, no clumsy date inputs) */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#14141c]/70 border border-zinc-800/60 text-xs">
                        <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                          <Calendar size={13} className="text-zinc-400" />
                          <span>{windowLabel}</span>
                        </div>
                        <span className="text-[11px] text-zinc-400 font-normal">
                          {cadenceNote}
                        </span>
                      </div>
                    </div>

                    {/* Budget Name */}
                    <div>
                      <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                        Budget Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. October Budget, Holiday Trip"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-11 bg-[#14141c] rounded-xl px-3.5 text-xs text-white focus:outline-none border border-zinc-800/80 focus:border-zinc-500 transition-colors"
                        required
                      />
                    </div>

                    {/* Total Overall Amount Hero Card */}
                    <div className="p-4 rounded-2xl bg-[#14141c] border border-zinc-800/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-400 font-medium">
                          Total Overall Limit
                        </label>
                        <span className="text-[11px] text-zinc-500 font-normal capitalize">
                          {period} allowance
                        </span>
                      </div>
                      <CurrencyInput
                        currencySymbol={state.settings.currencySymbol}
                        type="number"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums bg-transparent focus:outline-none border-none p-0"
                        required
                      />
                    </div>

                    {/* Category Breakdown Allocation Builder */}
                    <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-300 font-medium">
                          Category Limits (Optional)
                        </label>
                        {categoryAllocations.length > 0 && totalBudgetAmount > 0 && (
                          <span
                            className={`text-[11px] font-medium tabular-nums ${
                              isOverAllocated ? 'text-rose-400 font-semibold' : 'text-zinc-400'
                            }`}
                          >
                            {formatCurrency(totalAllocated, state.settings.currencySymbol)} / {formatCurrency(totalBudgetAmount, state.settings.currencySymbol)} ({allocatedPercent}%)
                          </span>
                        )}
                      </div>

                      {/* Visual allocation progress bar */}
                      {categoryAllocations.length > 0 && (
                        <div className="space-y-1.5 p-3 rounded-xl bg-[#14141c]/50 border border-zinc-800/60">
                          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
                            <div
                              style={{
                                width: `${Math.min(
                                  100,
                                  totalBudgetAmount > 0 ? (totalAllocated / totalBudgetAmount) * 100 : 0
                                )}%`,
                              }}
                              className={`h-full rounded-full transition-all duration-300 ${
                                isOverAllocated ? 'bg-rose-500' : 'bg-white'
                              }`}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            {isOverAllocated ? (
                              <span className="text-rose-400 font-medium">
                                Over limit by {formatCurrency(totalAllocated - totalBudgetAmount, state.settings.currencySymbol)}
                              </span>
                            ) : (
                              <span className="text-zinc-400">
                                {formatCurrency(unallocatedAmount, state.settings.currencySymbol)} unallocated
                              </span>
                            )}
                            <span className="text-zinc-500">
                              {categoryAllocations.length} {categoryAllocations.length === 1 ? 'category' : 'categories'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Add Category Limit Row */}
                      {availableCategories.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <CustomSelect
                              value={tempCatId}
                              onChange={(val) => setTempCatId(val)}
                              options={availableCategories.map((c) => ({
                                value: c.id,
                                label: c.name,
                                icon: <CategoryIcon name={c.icon || 'Tag'} size={14} />,
                              }))}
                              placeholder="Select category..."
                            />
                          </div>
                          <CurrencyInput
                            currencySymbol={state.settings.currencySymbol}
                            type="number"
                            placeholder={unallocatedAmount > 0 ? String(unallocatedAmount) : 'Limit'}
                            value={tempCatAmount}
                            onChange={(e) => setTempCatAmount(e.target.value)}
                            className="w-full h-11 bg-[#14141c] rounded-xl px-3 text-xs text-white tabular-nums focus:outline-none border border-zinc-800/80 focus:border-zinc-500 transition-colors"
                            containerClassName="w-28 sm:w-32 shrink-0"
                          />
                          <button
                            type="button"
                            onClick={handleAddCategoryAllocation}
                            className="h-11 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold cursor-pointer transition-colors shrink-0 flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <Plus size={14} />
                            <span>Add</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-500 py-1 text-center">
                          All available categories have limits configured.
                        </div>
                      )}

                      {/* Category allocations list */}
                      {categoryAllocations.length > 0 && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                          {categoryAllocations.map((alloc) => {
                            const cat = state.categories.find((c) => c.id === alloc.categoryId);
                            return (
                              <div
                                key={alloc.categoryId}
                                className="flex items-center justify-between py-2 px-3 rounded-xl bg-[#14141c] border border-zinc-800/70 text-xs shadow-xs hover:border-zinc-700/80 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 truncate">
                                  <div className="w-7 h-7 rounded-lg bg-zinc-800/90 border border-zinc-700/40 flex items-center justify-center text-zinc-300 shrink-0">
                                    <CategoryIcon name={cat?.icon || 'Tag'} size={13} />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-zinc-200 font-medium truncate block">{cat?.name}</span>
                                    {totalBudgetAmount > 0 && (
                                      <span className="text-[10px] text-zinc-500 font-normal tabular-nums">
                                        {Math.round((alloc.amount / totalBudgetAmount) * 100)}% of total
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2.5 shrink-0">
                                  <span className="font-semibold text-white text-xs tabular-nums">
                                    {formatCurrency(alloc.amount, state.settings.currencySymbol)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCategoryAllocation(alloc.categoryId)}
                                    className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors cursor-pointer"
                                    title="Remove limit"
                                  >
                                    <X size={13} />
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
                  <div className="px-5 sm:px-6 py-4 sm:py-4.5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-zinc-800/80 bg-[#0d0d12] flex justify-end gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-400 hover:text-white cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-white text-black text-xs font-semibold rounded-xl cursor-pointer active:scale-95 hover:bg-zinc-200 transition-all shadow-md"
                    >
                      Save Budget
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          );
        })()}
    </div>
  );
};
