import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar as CalendarIcon,
  Target,
  AlertCircle
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { CurrencyInput, parseFormattedNumber } from '../common/CurrencyInput';
import { EditTransactionModal } from '../transactions/EditTransactionModal';
import type { Transaction } from '../../types/finance';

interface TodayViewProps {
  onOpenQuickAdd: (preselectedAccId?: string) => void;
  onNavigateTab: (tab: 'stats' | 'accounts') => void;
}

export const TodayView: React.FC<TodayViewProps> = ({ onOpenQuickAdd }) => {
  const { state, updateSettings } = useFinance();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(() => String(state.settings.goals?.daily || ''));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

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
  };

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);
  const getAccount = (accId: string) => state.accounts.find((a) => a.id === accId);

  return (
    <div className="space-y-3 pb-24 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
      {/* Top Day Switcher */}
      <div className="h-8 flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleShiftDay(-1)}
            className="w-8 h-8 rounded-xl bg-[#101014] hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#101014] border border-zinc-900">
            <CalendarIcon size={14} className="text-zinc-500" />
            <span className="text-xs font-mono font-bold text-white tracking-wide">
              {isToday ? 'TODAY' : selectedDate}
            </span>
          </div>

          <button
            onClick={() => handleShiftDay(1)}
            className="w-8 h-8 rounded-xl bg-[#101014] hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>

          {!isToday && (
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="text-[11px] text-zinc-500 hover:text-white font-mono transition-colors ml-1 cursor-pointer"
            >
              Reset to Today
            </button>
          )}
        </div>

        <button
          onClick={() => onOpenQuickAdd()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-[0_2px_12px_rgba(255,255,255,0.12)]"
        >
          <Plus size={14} strokeWidth={2.8} />
          <span>Add</span>
        </button>
      </div>

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
      </div>

      {/* Day Transaction Timeline Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">
            Day Activity ({dayTransactions.length})
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {selectedDate}
          </span>
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
