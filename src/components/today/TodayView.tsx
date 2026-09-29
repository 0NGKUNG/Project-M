import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar as CalendarIcon,
  Target,
  AlertCircle,
  RefreshCw,
  HandCoins,
  X
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { CurrencyInput, parseFormattedNumber } from '../common/CurrencyInput';
import { EditTransactionModal } from '../transactions/EditTransactionModal';
import type { Transaction } from '../../types/finance';

interface TodayViewProps {
  onOpenQuickAdd: (preselectedAccId?: string) => void;
  onNavigateTab: (tab: 'stats' | 'accounts') => void;
  /** Opens the Recurring / Borrow & Lend sheet — the "see it" half, since Settings is the "set it up" half. */
  onOpenManager?: (manager: 'recurring' | 'debts') => void;
}

export const TodayView: React.FC<TodayViewProps> = ({ onOpenQuickAdd, onOpenManager }) => {
  const { state, updateSettings } = useFinance();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(() => String(state.settings.goals?.daily || ''));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [isEditingGoalInModal, setIsEditingGoalInModal] = useState(false);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

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

  // Spending Goal calculation
  const dailyGoal = state.settings.goals?.daily || 0;
  const goalProgress = dailyGoal > 0 ? Math.min(100, Math.round((dayExpense / dailyGoal) * 100)) : 0;
  const isOverGoal = dailyGoal > 0 && dayExpense > dailyGoal;

  // Today's live figures — the goal pill always reflects the real calendar day,
  // even while the Day Activity feed below is browsing another date.
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

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFormattedNumber(goalInput) || undefined;
    updateSettings({
      goals: {
        ...state.settings.goals,
        daily: val,
      },
    });
    setIsEditingGoal(false);
    setIsEditingGoalInModal(false);
    setShowGoalModal(false);
  };

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);
  const getAccount = (accId: string) => state.accounts.find((a) => a.id === accId);

  // Next scheduled bills/income, soonest first
  const upcomingRecurring = useMemo(() => {
    return [...(state.recurring || [])]
      .filter((r) => r.isActive)
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
      .slice(0, 3);
  }, [state.recurring]);

  // Outstanding borrow/lend balances (settled entries drop off)
  const activeDebts = (state.debts || []).filter((d) => d.status === 'active');
  const owedToYou = activeDebts.filter((d) => d.type === 'lend').reduce((sum, d) => sum + d.remainingAmount, 0);
  const youOwe = activeDebts.filter((d) => d.type === 'borrow').reduce((sum, d) => sum + d.remainingAmount, 0);

  const dueLabel = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${dueDate}T00:00:00`);
    if (isNaN(due.getTime())) return dueDate;
    const days = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days <= 7) return `Due in ${days} days`;
    return `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div className="space-y-3 pb-24 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
      {/* Header — page title + quick-glance icon actions */}
      <div className="h-8 flex items-center justify-between pt-1">
        <h2 className="text-xl font-bold tracking-tight text-white font-mono">TODAY</h2>

        <div className="flex items-center gap-2">
          {/* Daily budget at-a-glance: mini % pill, tap for full goal sheet */}
          <button
            onClick={() => setShowGoalModal(true)}
            className="flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-xl bg-[#101014] border border-zinc-900 hover:border-zinc-700 active:scale-95 transition-all cursor-pointer"
            aria-label="Daily budget"
            title="Daily budget"
          >
            {dailyGoal > 0 ? (
              <>
                <div className="w-8 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      todayIsOverGoal ? 'bg-rose-500' : todayGoalProgress > 80 ? 'bg-amber-400' : 'bg-white'
                    }`}
                    style={{ width: `${Math.min(100, todayGoalProgress)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-mono font-bold ${todayIsOverGoal ? 'text-rose-400' : 'text-zinc-300'}`}>
                  {todayGoalProgress}%
                </span>
              </>
            ) : (
              <>
                <Target size={13} className="text-zinc-400" />
                <span className="text-[10px] font-mono font-bold text-zinc-500">Set</span>
              </>
            )}
          </button>

          <button
            onClick={() => onOpenManager?.('recurring')}
            className="w-8 h-8 rounded-xl bg-[#101014] border border-zinc-900 hover:border-zinc-700 active:scale-95 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer relative"
            aria-label="Recurring"
            title="Recurring"
          >
            <RefreshCw size={13} />
            {(state.recurring || []).some((r) => r.isActive) && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white/80" />
            )}
          </button>

          <button
            onClick={() => onOpenManager?.('debts')}
            className="w-8 h-8 rounded-xl bg-[#101014] border border-zinc-900 hover:border-zinc-700 active:scale-95 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer relative"
            aria-label="Borrow & Lend"
            title="Borrow & Lend"
          >
            <HandCoins size={13} />
            {activeDebts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white/80" />
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

      {/* Daily Budget Sheet — goal summary + inline edit */}
      {showGoalModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
            onClick={() => setShowGoalModal(false)}
          >
            <div
              className="w-full sm:max-w-sm h-[100dvh] sm:h-auto bg-[#0c0c10] sm:border border-zinc-800 rounded-none sm:rounded-3xl flex flex-col shadow-2xl safe-top safe-bottom overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <Target size={16} />
                  </div>
                  <h3 className="text-sm font-bold text-white font-mono">Daily Budget</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {dailyGoal > 0 ? (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-zinc-500">Spent today</div>
                        <div className={`text-2xl font-bold font-mono mt-1 ${todayIsOverGoal ? 'text-rose-400' : 'text-white'}`}>
                          {formatCurrency(todayTotals.exp, state.settings.currencySymbol)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold font-mono ${todayIsOverGoal ? 'text-rose-400' : todayGoalProgress > 80 ? 'text-amber-400' : 'text-white'}`}>
                          {todayGoalProgress}%
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          of {formatCurrency(dailyGoal, state.settings.currencySymbol)}
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          todayIsOverGoal ? 'bg-rose-500' : todayGoalProgress > 80 ? 'bg-amber-400' : 'bg-white'
                        }`}
                        style={{ width: `${Math.min(100, todayGoalProgress)}%` }}
                      />
                    </div>

                    {todayIsOverGoal && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-rose-400">
                        <AlertCircle size={12} />
                        <span>
                          Over budget by {formatCurrency(todayTotals.exp - dailyGoal, state.settings.currencySymbol)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-zinc-500">
                    No daily budget set yet. Add one to track and cap your daily spending.
                  </p>
                )}

                {isEditingGoalInModal ? (
                  <form onSubmit={handleSaveGoal} className="flex gap-2">
                    <CurrencyInput
                      currencySymbol={state.settings.currencySymbol}
                      type="number"
                      placeholder="e.g. 500"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      className="flex-1 bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-white text-black text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsEditingGoalInModal(true)}
                    className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {dailyGoal > 0 ? 'Edit Budget' : '+ Set Budget'}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Summary Cards & Spending Goal Section */}
      <div className="space-y-3">
        {/* Daily Cashflow Hero Summary */}
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

        {/* Daily Budget Pill / Progress */}
        <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Target size={15} className="text-zinc-400" />
              <span>Daily Budget</span>
            </div>
            <button
              onClick={() => setIsEditingGoal(!isEditingGoal)}
            className="text-[10px] font-mono text-zinc-400 hover:text-white cursor-pointer"
          >
            {dailyGoal > 0 ? (isEditingGoal ? 'Cancel' : 'Edit Budget') : '+ Set Budget'}
          </button>
        </div>

        {isEditingGoal ? (
          <form onSubmit={handleSaveGoal} className="flex gap-2 pt-1">
            <CurrencyInput
              currencySymbol={state.settings.currencySymbol}
              type="number"
              placeholder="e.g. 500"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="flex-1 bg-[#16161d] rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-xl cursor-pointer"
            >
              Save
            </button>
          </form>
        ) : dailyGoal > 0 ? (
          <div>
            <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1.5">
              <span>{formatCurrency(dayExpense, state.settings.currencySymbol)} spent</span>
              <span>Budget: {formatCurrency(dailyGoal, state.settings.currencySymbol)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isOverGoal ? 'bg-rose-500' : goalProgress > 80 ? 'bg-amber-400' : 'bg-white'
                }`}
                style={{ width: `${Math.min(100, goalProgress)}%` }}
              />
            </div>
            {isOverGoal && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400 mt-2">
                <AlertCircle size={12} />
                <span>Over daily budget by {formatCurrency(dayExpense - dailyGoal, state.settings.currencySymbol)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">
            No daily budget set. Tap '+ Set Budget' to track and cap your daily spending.
          </p>
        )}
        </div>

        {/* Up Next — scheduled bills & income */}
        <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <RefreshCw size={15} className="text-zinc-400" />
              <span>Up Next</span>
            </div>
            <button
              onClick={() => onOpenManager?.('recurring')}
              className="text-[10px] font-mono text-zinc-400 hover:text-white cursor-pointer"
            >
              {upcomingRecurring.length > 0 ? 'Manage' : '+ Add'}
            </button>
          </div>

          {upcomingRecurring.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              No scheduled bills yet. Add rent, subscriptions or salary to see what's coming.
            </p>
          ) : (
            <div className="space-y-0.5">
              {upcomingRecurring.map((item) => {
                const cat = getCategory(item.categoryId);
                const isIncome = item.type === 'income';
                return (
                  <button
                    key={item.id}
                    onClick={() => onOpenManager?.('recurring')}
                    className="w-full flex items-center justify-between gap-3 py-1.5 px-2 -mx-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
                        <CategoryIcon name={cat?.icon || 'Repeat'} size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white truncate">{item.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{dueLabel(item.nextDueDate)}</div>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold font-mono tabular-nums shrink-0 ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(item.amount, state.settings.currencySymbol)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Borrow & Lend — outstanding balances with friends */}
        <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <HandCoins size={15} className="text-zinc-400" />
              <span>Borrow &amp; Lend</span>
            </div>
            <button
              onClick={() => onOpenManager?.('debts')}
              className="text-[10px] font-mono text-zinc-400 hover:text-white cursor-pointer"
            >
              {activeDebts.length > 0 ? 'Manage' : '+ Add Entry'}
            </button>
          </div>

          {activeDebts.length === 0 ? (
            <p className="text-[11px] text-zinc-500">
              Nothing owed in either direction right now.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onOpenManager?.('debts')}
                className="rounded-xl bg-[#0c0c10] border border-zinc-900/60 px-3 py-2 text-left hover:border-zinc-800 transition-colors cursor-pointer"
              >
                <div className="text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider">Owed to you</div>
                <div className="text-xs font-bold font-mono text-emerald-400 truncate mt-0.5">
                  {formatCurrency(owedToYou, state.settings.currencySymbol)}
                </div>
              </button>
              <button
                onClick={() => onOpenManager?.('debts')}
                className="rounded-xl bg-[#0c0c10] border border-zinc-900/60 px-3 py-2 text-left hover:border-zinc-800 transition-colors cursor-pointer"
              >
                <div className="text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider">You owe</div>
                <div className="text-xs font-bold font-mono text-rose-400 truncate mt-0.5">
                  {formatCurrency(youOwe, state.settings.currencySymbol)}
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Day Transaction Timeline Feed */}
      <div className="space-y-3">
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
          <div className="p-10 rounded-2xl bg-[#101014] border border-zinc-900/40 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
              <CalendarIcon size={18} />
            </div>
            <div className="text-xs text-zinc-400 font-medium">No transactions on this date</div>
            <p className="text-[10px] text-zinc-600">Tap + Add or press [N] to log your expenses</p>
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
                  className="p-3.5 rounded-2xl bg-[#101014] border border-zinc-900/50 flex items-center justify-between hover:border-zinc-700 transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors">
                      <CategoryIcon name={category?.icon || 'Tag'} size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">
                          {category?.name || 'Uncategorized'}
                        </span>
                        {tx.subcategoryId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
                            {state.categories.find(c => c.id === tx.subcategoryId)?.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-0.5">
                        {timeDisplay && (
                          <>
                            <span className="text-zinc-400 font-bold">{timeDisplay}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{account?.name || 'Wallet'}</span>
                        {tx.note && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[140px] text-zinc-400">{tx.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
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
