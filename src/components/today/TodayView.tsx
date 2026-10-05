import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar as CalendarIcon,
  Target,
  RefreshCw,
  HandCoins,
  ChevronDown,
  Pin,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { EditTransactionModal } from '../transactions/EditTransactionModal';
import { RecurringManager } from '../recurring/RecurringManager';
import { DebtManager } from '../debts/DebtManager';
import { BudgetsPage } from '../budgets/BudgetsPage';
import { FloatingClose } from '../common/FloatingClose';
import type { Transaction } from '../../types/finance';
import { useBackButton } from '../../hooks/useBackButton';
import { getBudgetSpending } from '../../utils/budgetMath';

type TodaySubPage = null | 'recurring' | 'debts' | 'budgets';

interface TodayViewProps {
  onOpenQuickAdd: (preselectedAccId?: string) => void;
  onNavigateTab: (tab: 'stats' | 'accounts') => void;
  /** Whether Today is the visible tab — fixed overlays must be gated on this (mobile carousel keeps all views mounted). */
  isActive?: boolean;
  /** Notifies parent when subpage opens/closes (used to lock mobile swipe navigation). */
  onSubPageChange?: (hasSubPage: boolean) => void;
}

const RECENT_EXEC_MS = 60000; // "just executed" dot stays lit for 60s
const DOT_CLEAR_MS = 20000; // dot clears ~20s after the sheet opens

export const TodayView: React.FC<TodayViewProps> = ({ onOpenQuickAdd, isActive, onSubPageChange }) => {
  const { state, updateSettings } = useFinance();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [debtSheetSeenAt, setDebtSheetSeenAt] = useState<number | null>(null);
  const [subPage, setSubPage] = useState<TodaySubPage>(null);
  useBackButton(Boolean(subPage), () => setSubPage(null));

  useEffect(() => {
    onSubPageChange?.(subPage !== null);
    return () => {
      onSubPageChange?.(false);
    };
  }, [subPage, onSubPageChange]);

  // Re-tapping Today pops sub-pages; switching to another tab closes them so returning shows the root view.
  useEffect(() => {
    const handleTabRetap = (e: Event) => {
      if ((e as CustomEvent).detail === 'today') setSubPage(null);
    };
    const handleTabChanged = () => setSubPage(null);
    window.addEventListener('nova:tab-retap', handleTabRetap);
    window.addEventListener('nova:tab-changed', handleTabChanged);
    return () => {
      window.removeEventListener('nova:tab-retap', handleTabRetap);
      window.removeEventListener('nova:tab-changed', handleTabChanged);
    };
  }, []);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // Budget-sheet-driven notification windows (now-based re-render tick every 15s so dots age out)
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (debtSheetSeenAt === null) return;
    const t = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, [debtSheetSeenAt]);

  const dayTransactions = useMemo(() => {
    return state.transactions
      .filter((tx) => tx.date === selectedDate)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.transactions, selectedDate]);

  const { dayIncome, dayExpense } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    dayTransactions.forEach((tx) => {
      if (tx.type === 'income') inc += tx.amount;
      if (tx.type === 'expense') exp += tx.amount;
    });
    return { dayIncome: inc, dayExpense: exp };
  }, [dayTransactions]);

  // Day shift
  const handleShiftDay = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // ── Synced Budget & Daily Goal Calculations ──
  const weekStartDay = state.settings.weekStartDay ?? 1;
  const currencySymbol = state.settings.currencySymbol;

  const [showBudgetDropdown, setShowBudgetDropdown] = useState(false);
  const budgetDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBudgetDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (budgetDropdownRef.current && !budgetDropdownRef.current.contains(e.target as Node)) {
        setShowBudgetDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowBudgetDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showBudgetDropdown]);

  const dailyGoal = state.settings.goals?.daily || 0;
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
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

  const pinnedId = state.settings.pinnedBudgetId !== undefined
    ? state.settings.pinnedBudgetId
    : (() => { try { return localStorage.getItem('nova-pinned-budget'); } catch { return null; } })();

  const handleTogglePin = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = pinnedId === id ? null : id;
    updateSettings({ pinnedBudgetId: next });
    try {
      if (next) localStorage.setItem('nova-pinned-budget', next);
      else localStorage.removeItem('nova-pinned-budget');
    } catch {}
  };

  // Determine active budget to display in the main Today widget
  const activeBudget = useMemo(() => {
    if (pinnedId === 'daily') return null;
    if (pinnedId) {
      const found = state.budgets.find((b) => b.id === pinnedId);
      if (found) return found;
    }
    if (state.budgets.length > 0) return state.budgets[0];
    return null;
  }, [state.budgets, pinnedId]);

  const isDailyActive = pinnedId === 'daily' || (!activeBudget && dailyGoal > 0);

  const activeBudgetSpending = useMemo(() => {
    if (!activeBudget) return 0;
    return getBudgetSpending(activeBudget, state.transactions, weekStartDay).totalSpent;
  }, [activeBudget, state.transactions, weekStartDay]);

  const activeBudgetLimit = activeBudget ? activeBudget.amount : 0;
  const activeBudgetPercent = activeBudget
    ? (activeBudgetLimit > 0 ? Math.round((activeBudgetSpending / activeBudgetLimit) * 100) : 0)
    : 0;
  const activeBudgetIsOver = activeBudget ? activeBudgetSpending > activeBudgetLimit : false;

  const activeLabel = isDailyActive
    ? 'Daily'
    : (activeBudget?.name || (activeBudget?.period ? activeBudget.period.toUpperCase() : 'Budget'));

  const displayPercent = isDailyActive ? todayGoalProgress : activeBudgetPercent;
  const displaySpent = isDailyActive ? todayTotals.exp : activeBudgetSpending;
  const displayIsOver = isDailyActive ? todayIsOverGoal : activeBudgetIsOver;
  const hasAnyBudget = Boolean(activeBudget || dailyGoal > 0);

  // ── Debts badge: net balance today (owed-to-you positive, you-owe negative) ──
  const activeDebts = (state.debts || []).filter((d) => d.status === 'active');
  const owedToYou = activeDebts.filter((d) => d.type === 'lend').reduce((sum, d) => sum + d.remainingAmount, 0);
  const youOwe = activeDebts.filter((d) => d.type === 'borrow').reduce((sum, d) => sum + d.remainingAmount, 0);
  const netDebt = owedToYou - youOwe;
  const hasDebtBadge = activeDebts.length > 0;
  const debtDotVisible = hasDebtBadge && (debtSheetSeenAt === null || Date.now() - debtSheetSeenAt > DOT_CLEAR_MS);

  // ── Recurring badge: red dot when something just auto-executed ──
  const recentlyExecuted = useMemo(() => {
    const now = Date.now();
    return (state.recurring || []).filter((r) => {
      if (!r.lastExecutedAt) return false;
      const age = now - r.lastExecutedAt;
      // Sourced from session ref or persisted state; only count recent executions
      return age >= 0 && age < RECENT_EXEC_MS;
    });
  }, [state.recurring, debtSheetSeenAt]);

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);
  const getAccount = (accId: string) => state.accounts.find((a) => a.id === accId);

  // ── Sub-pages: same manager screens Settings hosts, rendered inside Today ──
  if (subPage === 'recurring')
    return (
      <div className="relative space-y-3 pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 px-4 md:px-8 w-full animate-fade-in select-none min-h-full flex flex-col">
        <RecurringManager onBack={() => setSubPage(null)} />
        {isActive && <FloatingClose onClick={() => setSubPage(null)} />}
      </div>
    );

  if (subPage === 'debts')
    return (
      <div className="relative space-y-3 pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 px-4 md:px-8 w-full animate-fade-in select-none min-h-full flex flex-col">
        <DebtManager onBack={() => setSubPage(null)} />
        {isActive && <FloatingClose onClick={() => setSubPage(null)} />}
      </div>
    );

  if (subPage === 'budgets')
    return (
      <div className="relative space-y-3 pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 px-4 md:px-8 w-full animate-fade-in select-none min-h-full flex flex-col">
        <BudgetsPage onBack={() => setSubPage(null)} />
        {isActive && <FloatingClose onClick={() => setSubPage(null)} />}
      </div>
    );

  return (
    <div className="space-y-3 pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 px-4 md:px-8 w-full animate-fade-in select-none min-h-full flex flex-col">
      {/* Header — page title + quick-glance icon actions */}
      <div className="h-8 flex items-center justify-between pt-1">
        <h2 className="text-xl font-bold tracking-tight text-white font-mono">TODAY</h2>

        <div className="flex items-center gap-2">
          {/* Synced budget pill with progress bar + dropdown trigger */}
          <div className="relative" ref={budgetDropdownRef}>
            <div className="flex items-center h-8 rounded-xl bg-[#101014] border border-zinc-900 hover:border-zinc-700 transition-all">
              <button
                onClick={() => setSubPage('budgets')}
                className="flex items-center gap-1.5 h-full pl-2.5 pr-2 hover:text-white transition-all cursor-pointer select-none"
                aria-label="Budget status"
                title="Open budgets"
              >
                {hasAnyBudget ? (
                  <>
                    <Target size={13} className="text-zinc-400 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300 max-w-[65px] sm:max-w-[100px] truncate">
                      {activeLabel}
                    </span>
                    <div className="w-12 sm:w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          displayIsOver ? 'bg-rose-500' : displayPercent > 80 ? 'bg-amber-400' : 'bg-white'
                        }`}
                        style={{ width: `${Math.min(100, displayPercent)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold whitespace-nowrap tabular-nums">
                      <span className={displayIsOver ? 'text-rose-400' : 'text-zinc-300'}>{displayPercent}%</span>
                    </span>
                    <span className={`text-[10px] font-medium whitespace-nowrap tabular-nums ${displayIsOver ? 'text-rose-400' : 'text-zinc-400'}`}>
                      {formatCurrency(displaySpent, currencySymbol)}
                    </span>
                  </>
                ) : (
                  <>
                    <Target size={13} className="text-zinc-400 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Budget</span>
                    <span className="text-[10px] font-medium text-zinc-600">— Set</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowBudgetDropdown((prev) => !prev)}
                className="flex items-center justify-center w-7 h-full pr-1 text-zinc-400 hover:text-white transition-colors border-l border-zinc-900 cursor-pointer"
                aria-label="More budgets"
                title="Select or pin budget"
              >
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${showBudgetDropdown ? 'rotate-180 text-white' : ''}`}
                />
              </button>
            </div>

            {/* Dropdown to show more budgets, progress bars, and pin to Today */}
            {showBudgetDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 max-w-[calc(100vw-2rem)] bg-[#101014] border border-zinc-800 rounded-2xl shadow-2xl z-50 p-2.5 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between px-1 pt-0.5 pb-2 border-b border-zinc-900">
                  <div className="flex items-center gap-1.5">
                    <Target size={13} className="text-zinc-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">Budgets</span>
                    <span className="text-[10px] text-zinc-400 font-semibold tabular-nums">
                      ({state.budgets.length + (dailyGoal > 0 ? 1 : 0)})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowBudgetDropdown(false);
                      setSubPage('budgets');
                    }}
                    className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Manage →
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
                  {state.budgets.map((b) => {
                    const spending = getBudgetSpending(b, state.transactions, weekStartDay);
                    const pct = b.amount > 0 ? Math.round((spending.totalSpent / b.amount) * 100) : 0;
                    const isOver = spending.totalSpent > b.amount;
                    const isPinned = pinnedId === b.id || (!pinnedId && activeBudget?.id === b.id && !isDailyActive);
                    const periodBadge = b.period === 'daily' ? 'Daily' : b.period === 'weekly' ? 'Weekly' : 'Monthly';

                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          handleTogglePin(b.id);
                          setShowBudgetDropdown(false);
                        }}
                        className={`group p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isPinned
                            ? 'bg-zinc-900/90 border-zinc-700 shadow-sm'
                            : 'bg-zinc-900/40 border-zinc-900 hover:border-zinc-700 hover:bg-zinc-900/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border bg-zinc-800 text-zinc-300 border-zinc-700/60 shrink-0">
                              {periodBadge}
                            </span>
                            <span className="text-xs font-semibold text-white truncate">
                              {b.name || `${periodBadge} Budget`}
                            </span>
                          </div>
                          <button
                            onClick={(e) => handleTogglePin(b.id, e)}
                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                              isPinned
                                ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
                                : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800'
                            }`}
                            title={isPinned ? 'Pinned on Today' : 'Pin to Today'}
                          >
                            <Pin size={12} className={isPinned ? 'fill-amber-400 text-amber-400' : ''} />
                          </button>
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-1 text-xs">
                            <span className={`font-semibold tabular-nums ${isOver ? 'text-rose-400' : 'text-white'}`}>
                              {formatCurrency(spending.totalSpent, currencySymbol)}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-normal tabular-nums">
                              / {formatCurrency(b.amount, currencySymbol)}
                            </span>
                          </div>
                          <span className={`text-[10px] font-semibold tabular-nums ${isOver ? 'text-rose-400' : pct > 80 ? 'text-amber-400' : 'text-zinc-300'}`}>
                            {pct}%
                          </span>
                        </div>

                        <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOver ? 'bg-rose-500' : pct > 80 ? 'bg-amber-400' : 'bg-white'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {dailyGoal > 0 && (
                    <div
                      onClick={() => {
                        handleTogglePin('daily');
                        setShowBudgetDropdown(false);
                      }}
                      className={`group p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        pinnedId === 'daily' || (!pinnedId && isDailyActive)
                          ? 'bg-zinc-900/90 border-zinc-700 shadow-sm'
                          : 'bg-zinc-900/40 border-zinc-900 hover:border-zinc-700 hover:bg-zinc-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border bg-amber-500/10 text-amber-300 border-amber-500/20 shrink-0">
                            Daily
                          </span>
                          <span className="text-xs font-semibold text-white truncate">
                            Daily Spending Goal
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleTogglePin('daily', e)}
                          className={`p-1 rounded-lg transition-colors cursor-pointer ${
                            pinnedId === 'daily' || (!pinnedId && isDailyActive)
                              ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
                              : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800'
                          }`}
                          title={pinnedId === 'daily' || (!pinnedId && isDailyActive) ? 'Pinned on Today' : 'Pin to Today'}
                        >
                          <Pin size={12} className={pinnedId === 'daily' || (!pinnedId && isDailyActive) ? 'fill-amber-400 text-amber-400' : ''} />
                        </button>
                      </div>

                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1 text-xs">
                          <span className={`font-semibold tabular-nums ${todayIsOverGoal ? 'text-rose-400' : 'text-white'}`}>
                            {formatCurrency(todayTotals.exp, currencySymbol)}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-normal tabular-nums">
                            / {formatCurrency(dailyGoal, currencySymbol)}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold tabular-nums ${todayIsOverGoal ? 'text-rose-400' : todayGoalProgress > 80 ? 'text-amber-400' : 'text-zinc-300'}`}>
                          {todayGoalProgress}%
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            todayIsOverGoal ? 'bg-rose-500' : todayGoalProgress > 80 ? 'bg-amber-400' : 'bg-white'
                          }`}
                          style={{ width: `${Math.min(100, todayGoalProgress)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {state.budgets.length === 0 && dailyGoal <= 0 && (
                    <div className="text-center py-4 px-2">
                      <Target size={20} className="mx-auto text-zinc-600 mb-1" />
                      <span className="text-xs font-mono text-zinc-400 block mb-2 font-semibold">No budgets yet</span>
                    </div>
                  )}
                </div>

                <div className="pt-1 border-t border-zinc-900">
                  <button
                    onClick={() => {
                      setShowBudgetDropdown(false);
                      setSubPage('budgets');
                    }}
                    className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-mono text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={12} /> All Budgets & Goals
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setSubPage('recurring')}
            className="hidden sm:flex items-center gap-1.5 h-8 pl-2.5 pr-2.5 rounded-xl bg-[#101014] border border-zinc-900 hover:border-zinc-700 active:scale-95 text-zinc-400 hover:text-white transition-all cursor-pointer relative"
            aria-label="Recurring"
            title="Recurring"
          >
            <RefreshCw size={13} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Recurring</span>
            {recentlyExecuted.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#060608] animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setSubPage('recurring')}
            className="sm:hidden w-8 h-8 rounded-xl bg-[#101014] border border-zinc-900 hover:border-zinc-700 active:scale-95 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer relative"
            aria-label="Recurring"
            title="Recurring"
          >
            <RefreshCw size={13} />
            {recentlyExecuted.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#060608] animate-pulse" />
            )}
          </button>

          <button
            onClick={() => {
              setSubPage('debts');
              setDebtSheetSeenAt(Date.now());
            }}
            className="hidden sm:flex items-center gap-1.5 h-8 pl-2.5 pr-2.5 rounded-xl bg-[#101014] border border-zinc-900 hover:border-zinc-700 active:scale-95 text-zinc-400 hover:text-white transition-all cursor-pointer relative"
            aria-label="Borrow & Lend"
            title="Borrow & Lend"
          >
            <HandCoins size={13} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Debts</span>
            {debtDotVisible && (
              <span className="absolute -top-1 -right-1 flex items-center gap-0.5 px-1 h-3.5 rounded-full bg-rose-500 ring-2 ring-[#060608]">
                <span className="text-[8px] font-mono font-bold text-white leading-none">
                  {netDebt >= 0 ? '+' : '-'}
                </span>
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setSubPage('debts');
              setDebtSheetSeenAt(Date.now());
            }}
            className="sm:hidden w-8 h-8 rounded-xl bg-[#101014] border border-zinc-900 hover:border-zinc-700 active:scale-95 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer relative"
            aria-label="Borrow & Lend"
            title="Borrow & Lend"
          >
            <HandCoins size={13} />
            {debtDotVisible && (
              <span className="absolute -top-1 -right-1 flex items-center gap-0.5 px-1 h-3.5 rounded-full bg-rose-500 ring-2 ring-[#060608]">
                <span className="text-[8px] font-mono font-bold text-white leading-none">
                  {netDebt >= 0 ? '+' : '-'}
                </span>
              </span>
            )}
          </button>

          {/* Desktop keeps the explicit Add; mobile uses the bottom-nav FAB */}
          <button
            onClick={() => onOpenQuickAdd()}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-[0_2px_12px_rgba(255,255,255,0.12)]"
          >
            <Plus size={14} strokeWidth={2.8} />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="bg-[#101014] rounded-2xl p-3 sm:p-3.5 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[72px] sm:h-[80px]">
          <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider h-4">
            <ArrowDownLeft size={13} className="text-emerald-400 shrink-0" />
            <span className="truncate">Income</span>
          </div>
          <div className="text-sm sm:text-lg font-bold font-mono text-emerald-400 truncate leading-none">
            +{formatCurrency(dayIncome, state.settings.currencySymbol)}
          </div>
        </div>

        <div className="bg-[#101014] rounded-2xl p-3 sm:p-3.5 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[72px] sm:h-[80px]">
          <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider h-4">
            <ArrowUpRight size={13} className="text-rose-400 shrink-0" />
            <span className="truncate">Expenses</span>
          </div>
          <div className="text-sm sm:text-lg font-bold font-mono text-rose-400 truncate leading-none">
            -{formatCurrency(dayExpense, state.settings.currencySymbol)}
          </div>
        </div>
      </div>

      {/* Day Transaction Timeline Feed */}
      <div className="space-y-3 lg:flex-1 lg:flex lg:flex-col">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">
            Day Activity ({dayTransactions.length})
          </span>
          <div className="flex items-center gap-2">
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="text-[10px] text-zinc-500 hover:text-white font-mono transition-colors cursor-pointer"
              >
                Back to today
              </button>
            )}
            <span className="text-[10px] text-zinc-500 font-mono">
              {isToday ? 'Today' : selectedDate}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleShiftDay(-1)}
                className="w-6 h-6 rounded-lg bg-[#101014] border border-zinc-900 hover:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Previous day"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                onClick={() => handleShiftDay(1)}
                className="w-6 h-6 rounded-lg bg-[#101014] border border-zinc-900 hover:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Next day"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {dayTransactions.length === 0 ? (
          <div className="p-12 sm:p-8 rounded-2xl bg-[#101014] border border-zinc-900/60 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600">
              <CalendarIcon size={20} />
            </div>
            <div className="text-sm text-zinc-400 font-medium">No transactions on this date</div>
          </div>
        ) : (
          <div className="space-y-2">
            {dayTransactions.map((tx) => {
              const category = getCategory(tx.categoryId);
              const account = getAccount(tx.accountId);
              const isExpense = tx.type === 'expense';
              const isIncome = tx.type === 'income';

              const timeDisplay = tx.time || (tx.createdAt ? (() => {
                const d = new Date(tx.createdAt);
                return !isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
              })() : '');

              return (
                <div
                  key={tx.id}
                  onClick={() => setEditingTransaction(tx)}
                  className="p-2.5 sm:p-3.5 rounded-2xl bg-[#101014] border border-zinc-900/50 flex items-center justify-between hover:border-zinc-700 transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors shrink-0">
                      <CategoryIcon name={category?.icon || 'Tag'} size={14} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] sm:text-xs font-semibold text-white truncate">
                          {category?.name || 'Uncategorized'}
                        </span>
                        {tx.subcategoryId && (
                          <span className="text-[9px] sm:text-[10px] px-1 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
                            {state.categories.find(c => c.id === tx.subcategoryId)?.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                        {timeDisplay && (
                          <>
                            <span className="text-zinc-400 font-bold">{timeDisplay}</span>
                            <span className="hidden sm:inline">•</span>
                          </>
                        )}
                        <span className="truncate">{account?.name || 'Account'}</span>
                        {tx.note && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="truncate max-w-[100px] sm:max-w-[140px] text-zinc-400">{tx.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2 sm:ml-0">
                    <div className={`text-[11px] sm:text-sm font-bold font-mono tabular-nums ${
                      isExpense ? 'text-rose-400' : isIncome ? 'text-emerald-400' : 'text-blue-400'
                    }`}>
                      {isExpense ? '-' : isIncome ? '+' : ''}
                      {formatCurrency(tx.amount, state.settings.currencySymbol)}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit / Delete Transaction Modal — conditionally mounted so transaction is always non-null inside */}
      {editingTransaction && (
        <EditTransactionModal
          key={editingTransaction.id}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
};
