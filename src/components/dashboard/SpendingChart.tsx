import React from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../common/Icons';

export const SpendingChart: React.FC = () => {
  const { state } = useFinance();

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Tally spending per category for current month
  const categoryTotals: Record<string, number> = {};
  let totalSpending = 0;

  state.transactions.forEach((tx) => {
    if (tx.type === 'expense' && tx.date.startsWith(currentMonthPrefix)) {
      categoryTotals[tx.categoryId] = (categoryTotals[tx.categoryId] || 0) + tx.amount;
      totalSpending += tx.amount;
    }
  });

  const sortedCategories = Object.entries(categoryTotals)
    .map(([catId, amount]) => {
      const category = state.categories.find((c) => c.id === catId);
      return {
        id: catId,
        name: category?.name || 'Other',
        amount,
        percent: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  if (totalSpending === 0) {
    return (
      <div className="bg-[#101014] rounded-3xl p-6 text-center h-full flex flex-col justify-center">
        <p className="text-xs text-zinc-500">No expenses logged this month yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#101014] rounded-3xl p-6 space-y-4 h-full flex flex-col justify-between shadow-sm">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase font-mono font-semibold tracking-wider text-zinc-400">
            Monthly Category Breakdown
          </span>
          <span className="text-sm font-mono font-bold text-white">
            {formatCurrency(totalSpending, state.settings.currencySymbol)}
          </span>
        </div>

        {/* Smooth Monochrome Segmented Bar */}
        <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden flex p-0.5 gap-0.5">
          {sortedCategories.slice(0, 5).map((item, idx) => {
            const opacities = [1, 0.75, 0.5, 0.35, 0.2];
            return (
              <div
                key={item.id}
                style={{
                  width: `${item.percent}%`,
                  backgroundColor: '#ffffff',
                  opacity: opacities[idx] || 0.15,
                }}
                className="h-full rounded-full transition-all duration-500"
              />
            );
          })}
        </div>
      </div>

      {/* Categories listing */}
      <div className="space-y-3 pt-2">
        {sortedCategories.slice(0, 5).map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs py-1">
            <div className="flex items-center gap-2.5 max-w-[65%]">
              <span className="w-2 h-2 rounded-full bg-white/80" />
              <span className="text-zinc-300 font-medium truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-zinc-500 text-[11px]">{item.percent.toFixed(0)}%</span>
              <span className="text-white font-semibold tabular-nums">
                {formatCurrency(item.amount, state.settings.currencySymbol)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
