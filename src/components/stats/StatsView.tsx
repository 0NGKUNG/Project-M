import React, { useState, useMemo } from 'react';
import { 
  Target, 
  AlertCircle 
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { CashflowChart } from './CashflowChart';

type TimeRange = 'week' | 'month' | 'year' | 'all';

export const StatsView: React.FC = () => {
  const { state } = useFinance();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

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

  return (
    <div className="space-y-6 pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
      {/* Timeframe Pill Selector */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono">STATS</h2>
        </div>

        <div className="flex bg-[#101014] p-1 rounded-xl border border-zinc-900">
          {(['week', 'month', 'year', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-medium capitalize transition-colors cursor-pointer ${
                timeRange === range ? 'bg-white text-black font-bold' : 'text-zinc-500 hover:text-white'
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
            <div className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider h-4 flex items-center">
              Total Inflow
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 truncate leading-none">
              +{formatCurrency(totalIncome, state.settings.currencySymbol)}
            </div>
          </div>

          <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[92px]">
            <div className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider h-4 flex items-center">
              Total Outflow
            </div>
            <div className="text-lg font-bold font-mono text-rose-400 truncate leading-none">
              -{formatCurrency(totalExpense, state.settings.currencySymbol)}
            </div>
          </div>

          <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[92px]">
            <div className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider h-4 flex items-center">
              Net Saved
            </div>
            <div className={`text-lg font-bold font-mono truncate leading-none ${netSavings >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings, state.settings.currencySymbol)}
            </div>
          </div>

          <div className="bg-[#101014] rounded-2xl p-4 border border-zinc-900/60 shadow-sm flex flex-col justify-between h-[92px]">
            <div className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider h-4 flex items-center">
              Savings Rate
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

      {/* Top Outflows & Inflows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top Expense Categories */}
        <div className="bg-[#101014] rounded-2xl p-6 border border-zinc-900/60 shadow-sm space-y-4">
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase block">
            Top Outflows ({categoryOutflows.length})
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
            Top Inflows ({categoryInflows.length})
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
    </div>
  );
};
