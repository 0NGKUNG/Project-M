import React, { useState, useMemo } from 'react';
import { 
  Target, 
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar as CalendarIcon,
  Search,
  X
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { CashflowChart } from './CashflowChart';
import { EditTransactionModal } from '../transactions/EditTransactionModal';
import type { Transaction } from '../../types/finance';

type TimeRange = 'day' | 'week' | 'month' | 'year' | 'all';
type TypeFilter = 'all' | 'expense' | 'income' | 'transfer';

export const StatsView: React.FC = () => {
  const { state } = useFinance();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Filter transactions based on selected range
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    return state.transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      if (timeRange === 'day') {
        return tx.date === todayStr;
      }
      if (timeRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        return txDate >= weekAgo && txDate <= now;
      }
      if (timeRange === 'month') {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      }
      if (timeRange === 'year') {
        return txDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [state.transactions, timeRange]);

  // Aggregate stats
  const { totalIncome, totalExpense, categoryOutflows, categoryInflows } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    const outMap: Record<string, number> = {};
    const inMap: Record<string, number> = {};

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'expense') {
        exp += tx.amount;
        outMap[tx.categoryId] = (outMap[tx.categoryId] || 0) + tx.amount;
      } else if (tx.type === 'income') {
        inc += tx.amount;
        inMap[tx.categoryId] = (inMap[tx.categoryId] || 0) + tx.amount;
      }
    });

    const sortedOut = Object.entries(outMap)
      .map(([catId, amount]) => ({ catId, amount }))
      .sort((a, b) => b.amount - a.amount);

    const sortedIn = Object.entries(inMap)
      .map(([catId, amount]) => ({ catId, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalIncome: inc,
      totalExpense: exp,
      categoryOutflows: sortedOut,
      categoryInflows: sortedIn,
    };
  }, [filteredTransactions]);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);
  const getAccount = (accId: string) => state.accounts.find((a) => a.id === accId);

  // Filter transactions within the card by search query and type filter
  const searchedTransactions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return filteredTransactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }
      if (!q) return true;

      const catName = getCategory(tx.categoryId)?.name?.toLowerCase() || '';
      const accName = getAccount(tx.accountId)?.name?.toLowerCase() || '';
      const subCatName = tx.subcategoryId
        ? state.categories.find((c) => c.id === tx.subcategoryId)?.name?.toLowerCase() || ''
        : '';
      const note = tx.note?.toLowerCase() || '';
      const amountStr = tx.amount.toString();

      return (
        catName.includes(q) ||
        accName.includes(q) ||
        subCatName.includes(q) ||
        note.includes(q) ||
        amountStr.includes(q)
      );
    });
  }, [filteredTransactions, searchQuery, typeFilter, state.categories, state.accounts]);

  // Group transactions based on selected view:
  // - 'day': Group by hour (e.g. 14:00, 15:00)
  // - 'week' and 'month': Group by day
  // - 'year' and 'all': Group by month
  const groupedTransactions = useMemo(() => {
    const sorted = [...searchedTransactions].sort((a, b) => {
      if (timeRange === 'day') {
        const getHourVal = (tx: Transaction) => {
          if (tx.time) {
            const h = parseInt(tx.time.split(':')[0], 10);
            if (!isNaN(h)) return h;
          }
          return new Date(tx.createdAt || 0).getHours();
        };
        const hA = getHourVal(a);
        const hB = getHourVal(b);
        if (hB !== hA) return hB - hA;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (b.date !== a.date) return b.date > a.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    const groups: {
      key: string;
      label: string;
      transactions: typeof searchedTransactions;
      totalIncome: number;
      totalExpense: number;
    }[] = [];

    const groupMap = new Map<string, (typeof groups)[number]>();

    sorted.forEach((tx) => {
      let groupKey: string;
      let groupLabel: string;

      if (timeRange === 'day') {
        let hour = 0;
        if (tx.time) {
          const parsed = parseInt(tx.time.split(':')[0], 10);
          if (!isNaN(parsed)) hour = parsed;
        } else {
          hour = new Date(tx.createdAt || 0).getHours();
        }
        const hourPadded = hour.toString().padStart(2, '0');
        groupKey = `hour-${hourPadded}`;
        groupLabel = `${hourPadded}:00 - ${hourPadded}:59`;
      } else if (timeRange === 'week' || timeRange === 'month') {
        groupKey = tx.date;
        const d = new Date(tx.date + 'T00:00:00');
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

        if (tx.date === todayStr) {
          groupLabel = 'Today';
        } else if (tx.date === yesterday) {
          groupLabel = 'Yesterday';
        } else {
          groupLabel = d.toLocaleDateString('en-US', {
            weekday: timeRange === 'week' ? 'short' : undefined,
            month: 'short',
            day: 'numeric',
            year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
          });
        }
      } else {
        groupKey = tx.date.slice(0, 7);
        const [y, m] = groupKey.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        groupLabel = d.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
      }

      let g = groupMap.get(groupKey);
      if (!g) {
        g = {
          key: groupKey,
          label: groupLabel,
          transactions: [],
          totalIncome: 0,
          totalExpense: 0,
        };
        groupMap.set(groupKey, g);
        groups.push(g);
      }

      g.transactions.push(tx);
      if (tx.type === 'income') g.totalIncome += tx.amount;
      if (tx.type === 'expense') g.totalExpense += tx.amount;
    });

    return groups;
  }, [searchedTransactions, timeRange]);

  return (
    <div className="space-y-3 pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
      {/* Timeframe Pill Selector - Always on the same row as STATS */}
      <div className="h-8 flex items-center justify-between pt-1 gap-2">
        <div className="shrink-0">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-mono">STATS</h2>
        </div>

        <div className="flex bg-[#0d0d10] p-0.5 sm:p-1 rounded-xl border border-zinc-800/80 shadow-sm shrink-0">
          {(
            [
              { id: 'day', short: 'D', full: 'Day' },
              { id: 'week', short: 'W', full: 'Week' },
              { id: 'month', short: 'M', full: 'Month' },
              { id: 'year', short: 'Y', full: 'Year' },
              { id: 'all', short: 'All', full: 'All' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTimeRange(item.id as TimeRange)}
              className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-mono font-medium capitalize transition-all cursor-pointer whitespace-nowrap ${
                timeRange === item.id 
                  ? 'bg-[#1b1b20] text-white font-bold shadow-sm ring-1 ring-white/10' 
                  : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'
              }`}
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.full}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Top Cards & Chart Section with unified gap-3 */}
      <div className="space-y-3">
        {/* Summary Metrics - Income and Expenses */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="bg-[#101014] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[60px] sm:h-[80px]">
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider h-3.5 sm:h-4">
              <ArrowDownLeft size={13} className="text-emerald-400 shrink-0" />
              <span className="truncate">Income</span>
            </div>
            <div className="text-xs sm:text-lg font-bold font-mono text-emerald-400 truncate leading-none">
              +{formatCurrency(totalIncome, state.settings.currencySymbol)}
            </div>
          </div>

          <div className="bg-[#101014] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[60px] sm:h-[80px]">
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider h-3.5 sm:h-4">
              <ArrowUpRight size={13} className="text-rose-400 shrink-0" />
              <span className="truncate">Expenses</span>
            </div>
            <div className="text-xs sm:text-lg font-bold font-mono text-rose-400 truncate leading-none">
              -{formatCurrency(totalExpense, state.settings.currencySymbol)}
            </div>
          </div>
        </div>

        {/* Target Spending Goal Progress for Selected Period */}
        {(() => {
          const goalLimit = timeRange === 'day' 
            ? state.settings.goals?.daily 
            : timeRange === 'week' 
            ? state.settings.goals?.weekly 
            : timeRange === 'month' 
            ? state.settings.goals?.monthly 
            : undefined;
          if (!goalLimit || goalLimit <= 0) return null;
          const progress = Math.min(100, Math.round((totalExpense / goalLimit) * 100));
          const isOver = totalExpense > goalLimit;

          return (
            <div className="bg-[#101014] rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-zinc-900/60 space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-white">
                  <Target size={14} className="text-zinc-400 shrink-0" />
                  <span className="capitalize">{timeRange} Budget</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {progress}% used
                </span>
              </div>

              <div className="w-full h-1.5 sm:h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOver ? 'bg-rose-500' : progress > 85 ? 'bg-amber-400' : 'bg-white'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-mono text-zinc-400">
                <span>{formatCurrency(totalExpense, state.settings.currencySymbol)} spent</span>
                <span>Budget: {formatCurrency(goalLimit, state.settings.currencySymbol)}</span>
              </div>

              {isOver && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-rose-400 pt-0.5">
                  <AlertCircle size={11} className="shrink-0" />
                  <span>Over budget by {formatCurrency(totalExpense - goalLimit, state.settings.currencySymbol)}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Cashflow Graph (Dynamic Bars based on TimeRange) */}
        <CashflowChart 
          timeRange={timeRange} 
          netSavings={netSavings}
          savingsRate={savingsRate}
        />
      </div>

      {/* Top Expenses & Income with Combined Donut Chart on Left and Percent Bars on Right */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        {/* Top Expense Categories Card */}
        <div className="bg-[#101014] rounded-2xl p-4 sm:p-5 border border-zinc-900/60 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">
              Top Expenses ({categoryOutflows.length})
            </span>
            <span className="text-xs font-mono font-bold text-rose-400">
              -{formatCurrency(totalExpense, state.settings.currencySymbol)}
            </span>
          </div>

          {categoryOutflows.length === 0 ? (
            <p className="text-xs text-zinc-600 font-mono py-8 text-center">No expense data in this period</p>
          ) : (
            <div className="flex flex-row items-center gap-3 sm:gap-4 lg:gap-5 pt-1">
              {/* Left Column: Multi-segment Circular Ring Donut Chart */}
              <div className="relative w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Subtle Background Track Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#161620"
                    strokeWidth="5"
                  />
                  {/* Category Arcs - Clean Simple Slices with Uniform Gaps */}
                  {(() => {
                    const radius = 40;
                    const circumference = 2 * Math.PI * radius;
                    const strokeWidth = 5;
                    const count = categoryOutflows.length;
                    const gap = count > 1 ? 6.5 : 0;
                    const totalGaps = count * gap;
                    const availableCircumference = circumference - totalGaps;
                    const EXPENSE_PALETTE = ['#ff5757', '#38bdf8', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316'];
                    let accumulatedLength = 0;

                    return categoryOutflows.map((item, idx) => {
                      const pct = totalExpense > 0 ? item.amount / totalExpense : 0;
                      let strokeDash = 0;
                      let strokeDashoffset = 0;

                      if (count === 1) {
                        strokeDash = circumference;
                        strokeDashoffset = 0;
                      } else {
                        strokeDash = Math.max(0.5, pct * availableCircumference);
                        strokeDashoffset = -(accumulatedLength + (idx + 0.5) * gap);
                      }
                      accumulatedLength += strokeDash;
                      const strokeColor = EXPENSE_PALETTE[idx % EXPENSE_PALETTE.length];

                      return (
                        <circle
                          key={item.catId}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={`${strokeDash} ${circumference}`}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap={count === 1 ? 'butt' : 'round'}
                          className="transition-all duration-500"
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Center Label and Amount matching modern reference */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                  <span className="text-[10px] sm:text-xs text-zinc-400 font-medium tracking-tight leading-tight">
                    Spent this period
                  </span>
                  <span className="text-sm sm:text-base font-mono font-extrabold text-white mt-0.5 leading-tight tracking-tight truncate max-w-[110px] sm:max-w-[140px]">
                    {formatCurrency(totalExpense, state.settings.currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Right Column: Category List with Percentage Bars (Top 5) */}
              <div className="flex-1 min-w-0 flex flex-col justify-center h-44 sm:h-52 md:h-56 py-0.5 space-y-1.5 sm:space-y-2">
                {categoryOutflows.slice(0, 5).map((item, idx) => {
                  const cat = getCategory(item.catId);
                  const pct = totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
                  const EXPENSE_PALETTE = ['#ff5757', '#38bdf8', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316'];
                  const color = EXPENSE_PALETTE[idx % EXPENSE_PALETTE.length];

                  return (
                    <div key={item.catId} className="flex items-center gap-1.5 sm:gap-2.5">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/50 flex items-center justify-center shrink-0">
                        <CategoryIcon name={cat?.icon || 'Tag'} size={15} className="text-zinc-300 sm:w-4 sm:h-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between text-xs leading-tight">
                          <span className="text-white font-medium truncate text-[11px] sm:text-xs">{cat?.name || 'Category'}</span>
                          <span className="font-mono text-[11px] sm:text-xs text-zinc-300 shrink-0 ml-1.5">
                            {formatCurrency(item.amount, state.settings.currencySymbol)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-medium text-zinc-400 shrink-0">{pct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Top Income Sources Card */}
        <div className="bg-[#101014] rounded-2xl p-4 sm:p-5 border border-zinc-900/60 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">
              Top Income ({categoryInflows.length})
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              +{formatCurrency(totalIncome, state.settings.currencySymbol)}
            </span>
          </div>

          {categoryInflows.length === 0 ? (
            <p className="text-xs text-zinc-600 font-mono py-8 text-center">No income data in this period</p>
          ) : (
            <div className="flex flex-row items-center gap-3 sm:gap-4 lg:gap-5 pt-1">
              {/* Left Column: Multi-segment Circular Ring Donut Chart */}
              <div className="relative w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Subtle Background Track Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#161620"
                    strokeWidth="5"
                  />
                  {/* Category Arcs - Clean Simple Slices with Uniform Gaps */}
                  {(() => {
                    const radius = 40;
                    const circumference = 2 * Math.PI * radius;
                    const strokeWidth = 5;
                    const count = categoryInflows.length;
                    const gap = count > 1 ? 6.5 : 0;
                    const totalGaps = count * gap;
                    const availableCircumference = circumference - totalGaps;
                    const INCOME_PALETTE = ['#34d399', '#38bdf8', '#a855f7', '#fbbf24', '#2dd4bf', '#4ade80'];
                    let accumulatedLength = 0;

                    return categoryInflows.map((item, idx) => {
                      const pct = totalIncome > 0 ? item.amount / totalIncome : 0;
                      let strokeDash = 0;
                      let strokeDashoffset = 0;

                      if (count === 1) {
                        strokeDash = circumference;
                        strokeDashoffset = 0;
                      } else {
                        strokeDash = Math.max(0.5, pct * availableCircumference);
                        strokeDashoffset = -(accumulatedLength + (idx + 0.5) * gap);
                      }
                      accumulatedLength += strokeDash;
                      const strokeColor = INCOME_PALETTE[idx % INCOME_PALETTE.length];

                      return (
                        <circle
                          key={item.catId}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={`${strokeDash} ${circumference}`}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap={count === 1 ? 'butt' : 'round'}
                          className="transition-all duration-500"
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Center Label and Amount matching modern reference */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                  <span className="text-[10px] sm:text-xs text-zinc-400 font-medium tracking-tight leading-tight">
                    Earned this period
                  </span>
                  <span className="text-sm sm:text-base font-mono font-extrabold text-white mt-0.5 leading-tight tracking-tight truncate max-w-[110px] sm:max-w-[140px]">
                    +{formatCurrency(totalIncome, state.settings.currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Right Column: Category List with Percentage Bars (Top 5) */}
              <div className="flex-1 min-w-0 flex flex-col justify-center h-44 sm:h-52 md:h-56 py-0.5 space-y-1.5 sm:space-y-2">
                {categoryInflows.slice(0, 5).map((item, idx) => {
                  const cat = getCategory(item.catId);
                  const pct = totalIncome > 0 ? Math.round((item.amount / totalIncome) * 100) : 0;
                  const INCOME_PALETTE = ['#34d399', '#38bdf8', '#a855f7', '#fbbf24', '#2dd4bf', '#4ade80'];
                  const color = INCOME_PALETTE[idx % INCOME_PALETTE.length];

                  return (
                    <div key={item.catId} className="flex items-center gap-1.5 sm:gap-2.5">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/50 flex items-center justify-center shrink-0">
                        <CategoryIcon name={cat?.icon || 'Tag'} size={15} className="text-zinc-300 sm:w-4 sm:h-4" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between text-xs leading-tight">
                          <span className="text-white font-medium truncate text-[11px] sm:text-xs">{cat?.name || 'Income'}</span>
                          <span className="font-mono text-[11px] sm:text-xs text-zinc-300 shrink-0 ml-1.5">
                            +{formatCurrency(item.amount, state.settings.currencySymbol)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-medium text-zinc-400 shrink-0">{pct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grouped Transactions List */}
      <div className="bg-[#101014] rounded-xl sm:rounded-2xl p-3.5 sm:p-6 border border-zinc-900/60 shadow-sm space-y-3 sm:space-y-4">
        {/* Card Header & Controls */}
        <div className="space-y-2.5 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[11px] sm:text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase">
                Transactions ({searchedTransactions.length})
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 uppercase">
                • Grouped by {timeRange === 'day' ? 'Hour' : timeRange === 'week' || timeRange === 'month' ? 'Day' : 'Month'}
              </span>
            </div>

            {/* Type Filters */}
            <div className="flex items-center bg-[#0d0d10] p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-zinc-800/80 self-start sm:self-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'expense', label: 'Expenses' },
                  { id: 'income', label: 'Income' },
                  { id: 'transfer', label: 'Transfer' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-mono transition-all cursor-pointer ${
                    typeFilter === tab.id
                      ? 'bg-[#1b1b20] text-white font-bold shadow-sm ring-1 ring-white/10'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by note, category, account, or amount..."
              className="w-full bg-[#0c0c10] border border-zinc-800/80 rounded-xl pl-8 sm:pl-9 pr-8 sm:pr-9 py-1.5 sm:py-2 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-zinc-600 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {groupedTransactions.length === 0 ? (
          <div className="p-6 sm:p-8 text-center space-y-1.5 sm:space-y-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
              <CalendarIcon size={16} />
            </div>
            <div className="text-xs text-zinc-400 font-medium">
              {searchQuery || typeFilter !== 'all' ? 'No transactions matching filter' : 'No transactions in this period'}
            </div>
            <p className="text-[10px] text-zinc-600">
              {searchQuery || typeFilter !== 'all' ? 'Try adjusting your search query or filter' : 'Transactions you log will appear grouped here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {groupedTransactions.map((group) => (
              <div key={group.key} className="space-y-1.5 sm:space-y-2">
                {/* Group Header */}
                <div className="flex items-center justify-between px-1 text-[10px] sm:text-[11px] font-mono border-b border-zinc-900/80 pb-1 sm:pb-1.5">
                  <span className="font-semibold text-zinc-300">{group.label}</span>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px]">
                    {group.totalIncome > 0 && (
                      <span className="text-emerald-400">
                        +{formatCurrency(group.totalIncome, state.settings.currencySymbol)}
                      </span>
                    )}
                    {group.totalExpense > 0 && (
                      <span className="text-rose-400">
                        -{formatCurrency(group.totalExpense, state.settings.currencySymbol)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Transactions in group */}
                <div className="space-y-1.5 sm:space-y-2">
                  {group.transactions.map((tx) => {
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
                        className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#0c0c10] border border-zinc-900/60 flex items-center justify-between hover:border-zinc-700 transition-all cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors shrink-0">
                            <CategoryIcon name={category?.icon || 'Tag'} size={14} className="sm:w-4 sm:h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] sm:text-xs font-semibold text-white truncate">
                                {category?.name || 'Uncategorized'}
                              </span>
                              {tx.subcategoryId && (
                                <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono truncate">
                                  {state.categories.find((c) => c.id === tx.subcategoryId)?.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                              {timeDisplay && (
                                <>
                                  <span className="text-zinc-400 font-bold">{timeDisplay}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span className="truncate">{account?.name || 'Wallet'}</span>
                              {tx.note && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[120px] sm:max-w-[140px] text-zinc-400">{tx.note}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-2">
                          <div
                            className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
                              isExpense ? 'text-rose-400' : isIncome ? 'text-emerald-400' : 'text-blue-400'
                            }`}
                          >
                            {isExpense ? '-' : isIncome ? '+' : ''}
                            {formatCurrency(tx.amount, state.settings.currencySymbol)}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit / Delete Transaction Modal */}
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
