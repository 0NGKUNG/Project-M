import React, { useState, useMemo } from 'react';
import { 
  Target, 
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Percent,
  Equal,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { CashflowChart } from './CashflowChart';
import { EditTransactionModal } from '../transactions/EditTransactionModal';
import type { Transaction } from '../../types/finance';

type TimeRange = 'week' | 'month' | 'year' | 'all';

export const StatsView: React.FC = () => {
  const { state } = useFinance();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Filter transactions based on selected range
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return state.transactions.filter((tx) => {
      const txDate = new Date(tx.date);
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

  // Group transactions based on selected view (Day for week/month, Month for year/all)
  const groupedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => {
      if (b.date !== a.date) return b.date > a.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    const groups: {
      key: string;
      label: string;
      transactions: typeof filteredTransactions;
      totalIncome: number;
      totalExpense: number;
    }[] = [];

    const groupMap = new Map<string, (typeof groups)[number]>();

    sorted.forEach((tx) => {
      let groupKey: string;
      let groupLabel: string;

      if (timeRange === 'week' || timeRange === 'month') {
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
  }, [filteredTransactions, timeRange]);

  return (
    <div className="space-y-3 pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
      {/* Timeframe Pill Selector */}
      <div className="h-8 flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono">STATS</h2>
        </div>

        <div className="flex bg-[#0d0d10] p-1 rounded-xl border border-zinc-800/80 shadow-sm">
          {(['week', 'month', 'year', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-medium capitalize transition-all cursor-pointer ${
                timeRange === range ? 'bg-[#1b1b20] text-white font-bold shadow-sm ring-1 ring-white/10' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'
              }`}
            >
              {range === 'all' ? 'All' : range}
            </button>
          ))}
        </div>
      </div>

      {/* Top Cards & Chart Section with unified gap-3 */}
      <div className="space-y-3">
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[92px]">
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider h-4">
              <ArrowDownLeft size={13} className="text-emerald-400 shrink-0" />
              <span className="truncate">Income</span>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 truncate leading-none">
              +{formatCurrency(totalIncome, state.settings.currencySymbol)}
            </div>
          </div>

          <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[92px]">
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider h-4">
              <ArrowUpRight size={13} className="text-rose-400 shrink-0" />
              <span className="truncate">Expenses</span>
            </div>
            <div className="text-lg font-bold font-mono text-rose-400 truncate leading-none">
              -{formatCurrency(totalExpense, state.settings.currencySymbol)}
            </div>
          </div>

          <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[92px]">
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider h-4">
              <Equal size={13} className="text-blue-400 shrink-0" />
              <span className="truncate">Net</span>
            </div>
            <div className={`text-lg font-bold font-mono truncate leading-none ${netSavings >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings, state.settings.currencySymbol)}
            </div>
          </div>

          <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[92px]">
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider h-4">
              <Percent size={13} className="text-purple-400 shrink-0" />
              <span className="truncate">Savings Rate</span>
            </div>
            <div className="text-lg font-bold font-mono text-white truncate leading-none">
              {savingsRate}%
            </div>
          </div>
        </div>

        {/* Target Spending Goal Progress for Selected Period */}
        {(() => {
          const goalLimit = timeRange === 'week' ? state.settings.goals?.weekly : timeRange === 'month' ? state.settings.goals?.monthly : undefined;
          if (!goalLimit || goalLimit <= 0) return null;
          const progress = Math.min(100, Math.round((totalExpense / goalLimit) * 100));
          const isOver = totalExpense > goalLimit;

          return (
            <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Target size={15} className="text-zinc-400" />
                  <span className="capitalize">{timeRange} Spending Limit</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">
                  {progress}% used
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOver ? 'bg-rose-500' : progress > 85 ? 'bg-amber-400' : 'bg-white'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400">
                <span>{formatCurrency(totalExpense, state.settings.currencySymbol)} spent</span>
                <span>Target: {formatCurrency(goalLimit, state.settings.currencySymbol)}</span>
              </div>

              {isOver && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400 pt-0.5">
                  <AlertCircle size={12} />
                  <span>Over budget by {formatCurrency(totalExpense - goalLimit, state.settings.currencySymbol)}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Cashflow Graph (Dynamic Bars based on TimeRange) */}
        <CashflowChart timeRange={timeRange} />
      </div>

      {/* Top Expenses & Income */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top Expense Categories */}
        <div className="bg-[#101014] rounded-2xl p-6 border border-zinc-900/60 shadow-sm space-y-4">
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase block">
            Top Expenses ({categoryOutflows.length})
          </span>

          {categoryOutflows.length === 0 ? (
            <p className="text-xs text-zinc-600 font-mono py-4 text-center">No expense data in this period</p>
          ) : (
            <div className="space-y-3">
              {categoryOutflows.slice(0, 5).map((item) => {
                const cat = getCategory(item.catId);
                const pct = totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
                return (
                  <div key={item.catId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CategoryIcon name={cat?.icon || 'Tag'} size={14} className="text-zinc-400" />
                        <span className="text-white font-medium">{cat?.name || 'Category'}</span>
                      </div>
                      <div className="font-mono text-xs text-zinc-300">
                        {formatCurrency(item.amount, state.settings.currencySymbol)}{' '}
                        <span className="text-[10px] text-zinc-500">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500/80 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Income Sources */}
        <div className="bg-[#101014] rounded-2xl p-6 border border-zinc-900/60 shadow-sm space-y-4">
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase block">
            Top Income ({categoryInflows.length})
          </span>

          {categoryInflows.length === 0 ? (
            <p className="text-xs text-zinc-600 font-mono py-4 text-center">No income data in this period</p>
          ) : (
            <div className="space-y-3">
              {categoryInflows.slice(0, 5).map((item) => {
                const cat = getCategory(item.catId);
                const pct = totalIncome > 0 ? Math.round((item.amount / totalIncome) * 100) : 0;
                return (
                  <div key={item.catId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <CategoryIcon name={cat?.icon || 'Tag'} size={14} className="text-zinc-400" />
                        <span className="text-white font-medium">{cat?.name || 'Income'}</span>
                      </div>
                      <div className="font-mono text-xs text-emerald-400">
                        +{formatCurrency(item.amount, state.settings.currencySymbol)}{' '}
                        <span className="text-[10px] text-zinc-500">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grouped Transactions List */}
      <div className="bg-[#101014] rounded-2xl p-6 border border-zinc-900/60 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase block">
            Transactions ({filteredTransactions.length})
          </span>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            Grouped by {timeRange === 'week' || timeRange === 'month' ? 'Day' : 'Month'}
          </span>
        </div>

        {groupedTransactions.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
              <CalendarIcon size={18} />
            </div>
            <div className="text-xs text-zinc-400 font-medium">No transactions in this period</div>
            <p className="text-[10px] text-zinc-600">Transactions you log will appear grouped here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTransactions.map((group) => (
              <div key={group.key} className="space-y-2">
                {/* Group Header */}
                <div className="flex items-center justify-between px-1 text-[11px] font-mono border-b border-zinc-900/80 pb-1.5">
                  <span className="font-semibold text-zinc-300">{group.label}</span>
                  <div className="flex items-center gap-2 text-[10px]">
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
                <div className="space-y-2">
                  {group.transactions.map((tx) => {
                    const category = getCategory(tx.categoryId);
                    const account = getAccount(tx.accountId);
                    const isExpense = tx.type === 'expense';
                    const isIncome = tx.type === 'income';

                    return (
                      <div
                        key={tx.id}
                        onClick={() => setEditingTransaction(tx)}
                        className="p-3.5 rounded-2xl bg-[#0c0c10] border border-zinc-900/60 flex items-center justify-between hover:border-zinc-700 transition-all cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors shrink-0">
                            <CategoryIcon name={category?.icon || 'Tag'} size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-white">
                                {category?.name || 'Uncategorized'}
                              </span>
                              {tx.subcategoryId && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
                                  {state.categories.find((c) => c.id === tx.subcategoryId)?.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-0.5">
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

                        <div className="text-right">
                          <div
                            className={`text-xs font-bold font-mono ${
                              isExpense ? 'text-white' : isIncome ? 'text-emerald-400' : 'text-blue-400'
                            }`}
                          >
                            {isExpense ? '-' : isIncome ? '+' : ''}
                            {formatCurrency(tx.amount, state.settings.currencySymbol)}
                          </div>
                          {tx.time && (
                            <div className="text-[10px] text-zinc-600 font-mono mt-0.5">{tx.time}</div>
                          )}
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
