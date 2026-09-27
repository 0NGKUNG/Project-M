import React, { useMemo, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../common/Icons';

interface CashflowChartProps {
  timeRange?: 'week' | 'month' | 'year' | 'all';
}

export const CashflowChart: React.FC<CashflowChartProps> = ({ timeRange = 'month' }) => {
  const { state } = useFinance();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Build daily data points based on timeRange
  const chartData = useMemo(() => {
    const points: { label: string; date: string; income: number; expense: number }[] = [];
    const now = new Date();

    let numDays = 14;
    if (timeRange === 'week') numDays = 7;
    else if (timeRange === 'month') numDays = 30;
    else if (timeRange === 'year') numDays = 12; // 12 months
    else numDays = 30;

    if (timeRange === 'year') {
      // Monthly aggregation for past 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const prefix = `${y}-${m}`;
        const monthShort = d.toLocaleString('default', { month: 'short' });

        let inc = 0;
        let exp = 0;
        state.transactions.forEach((tx) => {
          if (tx.date.startsWith(prefix)) {
            if (tx.type === 'income') inc += tx.amount;
            if (tx.type === 'expense') exp += tx.amount;
          }
        });

        points.push({
          label: monthShort,
          date: prefix,
          income: inc,
          expense: exp,
        });
      }
    } else {
      // Daily aggregation
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;

        let inc = 0;
        let exp = 0;
        state.transactions.forEach((tx) => {
          if (tx.date === dateStr) {
            if (tx.type === 'income') inc += tx.amount;
            if (tx.type === 'expense') exp += tx.amount;
          }
        });

        points.push({
          label: dayLabel,
          date: dateStr,
          income: inc,
          expense: exp,
        });
      }
    }

    return points;
  }, [state.transactions, timeRange]);

  const maxVal = Math.max(
    ...chartData.map((d) => Math.max(d.income, d.expense)),
    10
  );

  const totalIn = chartData.reduce((s, p) => s + p.income, 0);
  const totalOut = chartData.reduce((s, p) => s + p.expense, 0);

  return (
    <div className="bg-[#101014] rounded-3xl p-6 border border-zinc-900/60 shadow-sm space-y-4">
      {/* Chart Header - fixed height container so hover tooltip never shifts card layout or size */}
      <div className="flex items-center justify-between min-h-[46px]">
        <div>
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase block">
            Cashflow Trends & Movement
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono mt-1">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Inflow: +{formatCurrency(totalIn, state.settings.currencySymbol)}
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Outflow: -{formatCurrency(totalOut, state.settings.currencySymbol)}
            </span>
          </div>
        </div>

        {/* Hover info badge with fixed dimensions / invisible placeholder when not hovered */}
        <div className={`text-right font-mono px-2.5 py-1 rounded-xl border transition-opacity duration-150 ${
          hoveredIndex !== null && chartData[hoveredIndex]
            ? 'opacity-100 bg-zinc-900/80 border-zinc-800'
            : 'opacity-0 pointer-events-none border-transparent'
        }`}>
          <div className="text-[10px] text-zinc-400">
            {hoveredIndex !== null && chartData[hoveredIndex] ? chartData[hoveredIndex].label : '-'}
          </div>
          <div className="text-xs text-white font-bold whitespace-nowrap">
            {hoveredIndex !== null && chartData[hoveredIndex] ? (
              <>
                {chartData[hoveredIndex].income > 0 && (
                  <span className="text-emerald-400 mr-2">
                    +{formatCurrency(chartData[hoveredIndex].income, state.settings.currencySymbol)}
                  </span>
                )}
                {chartData[hoveredIndex].expense > 0 && (
                  <span className="text-rose-400">
                    -{formatCurrency(chartData[hoveredIndex].expense, state.settings.currencySymbol)}
                  </span>
                )}
                {chartData[hoveredIndex].income === 0 && chartData[hoveredIndex].expense === 0 && (
                  <span className="text-zinc-500">No flow</span>
                )}
              </>
            ) : (
              <span className="text-zinc-700">0.00</span>
            )}
          </div>
        </div>
      </div>

      {/* Bar Graph Canvas */}
      <div className="h-44 w-full flex items-end gap-1 sm:gap-2 pt-6 pb-2 px-1 border-b border-zinc-900 overflow-x-auto">
        {chartData.map((d, idx) => {
          const incHeight = maxVal > 0 ? (d.income / maxVal) * 100 : 0;
          const expHeight = maxVal > 0 ? (d.expense / maxVal) * 100 : 0;
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={d.date}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="flex-1 min-w-[12px] sm:min-w-[18px] h-full flex flex-col justify-end items-center gap-1 cursor-pointer group relative"
            >
              {/* Bars side by side or stacked */}
              <div className="w-full flex items-end justify-center gap-0.5 h-full">
                {/* Income bar */}
                <div
                  style={{ height: `${Math.max(incHeight > 0 ? 6 : 0, incHeight)}%` }}
                  className={`w-1/2 max-w-[8px] rounded-t-xs transition-all duration-300 ${
                    incHeight > 0 ? 'bg-emerald-400' : 'bg-transparent'
                  } ${isHovered ? 'brightness-125 scale-x-110' : 'opacity-85'}`}
                />
                {/* Expense bar */}
                <div
                  style={{ height: `${Math.max(expHeight > 0 ? 6 : 0, expHeight)}%` }}
                  className={`w-1/2 max-w-[8px] rounded-t-xs transition-all duration-300 ${
                    expHeight > 0 ? 'bg-rose-500' : 'bg-transparent'
                  } ${isHovered ? 'brightness-125 scale-x-110' : 'opacity-85'}`}
                />
              </div>

              {/* Baseline pill if empty */}
              {d.income === 0 && d.expense === 0 && (
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-800/80 group-hover:bg-zinc-600 transition-colors" />
              )}
            </div>
          );
        })}
      </div>

      {/* Axis dates */}
      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 px-1">
        <span>{chartData[0]?.label}</span>
        {chartData.length > 2 && <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>}
        <span>{chartData[chartData.length - 1]?.label}</span>
      </div>
    </div>
  );
};
