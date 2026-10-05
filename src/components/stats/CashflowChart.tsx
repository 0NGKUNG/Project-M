import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../common/Icons';
import { formatLocalDate } from '../../utils/budgetMath';

interface CashflowChartProps {
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  viewMode?: 'pass' | 'current';
  netSavings?: number;
  savingsRate?: number;
}

export const CashflowChart: React.FC<CashflowChartProps> = ({
  timeRange = 'month',
  viewMode = 'pass',
  netSavings,
  savingsRate,
}) => {
  const { state, totalNetWorth } = useFinance();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const chartFrameRef = useRef<HTMLDivElement | null>(null);

  const displayNetWorth = netSavings !== undefined ? netSavings : totalNetWorth;
  const displaySavingsRate = savingsRate !== undefined ? savingsRate : 0;

  useEffect(() => {
    const frame = chartFrameRef.current;
    if (!frame) return;

    const updateWidth = () => setChartWidth(frame.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(() => {
    const points: {
      label: string;
      date: string;
      income: number;
      expense: number;
      cumulativeIncome: number;
      cumulativeExpense: number;
      balance: number;
    }[] = [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = formatLocalDate(today);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Past + Day shows the previous completed calendar day; Current + Day is
    // the in-progress today.
    const pastDay = new Date(today);
    pastDay.setDate(today.getDate() - 1);
    const pastDayStr = formatLocalDate(pastDay);
    const windowDayStr = viewMode === 'current' ? todayStr : pastDayStr;

    // Weeks follow the Week Start setting (0 = Sunday, 1 = Monday, 6 = Saturday).
    const weekStartDay = state.settings.weekStartDay ?? 1;
    const startOfWeek = (d: Date) => {
      const w = new Date(d);
      const diff = (d.getDay() < weekStartDay ? 7 : 0) + d.getDay() - weekStartDay;
      w.setDate(d.getDate() - diff);
      return w;
    };

    const inWindow = (tx: typeof state.transactions[number]) => {
      if (tx.date > todayStr) return false;

      if (viewMode === 'current') {
        if (timeRange === 'day') return tx.date === todayStr;
        if (timeRange === 'week') {
          const weekStart = startOfWeek(today);
          return tx.date >= formatLocalDate(weekStart) && tx.date <= todayStr;
        }
        if (timeRange === 'month') {
          const [txYear, txMonth] = tx.date.split('-').map(Number);
          return txYear === currentYear && txMonth - 1 === currentMonth;
        }
        if (timeRange === 'year') {
          const [txYear] = tx.date.split('-').map(Number);
          return txYear === currentYear;
        }
        return true;
      }

      if (timeRange === 'day') return tx.date === windowDayStr;
      if (timeRange === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 6);
        return tx.date >= formatLocalDate(weekAgo) && tx.date <= todayStr;
      }
      if (timeRange === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setDate(today.getDate() - 30);
        return tx.date >= formatLocalDate(monthAgo) && tx.date <= todayStr;
      }
      if (timeRange === 'year') {
        // Rolling 12 calendar months ending with the current month, matching the
        // 12-bucket year spine exactly (a 365-day window straddles 13 months and
        // created an extra bucket).
        const yearStart = new Date(currentYear, currentMonth - 11, 1);
        return tx.date >= formatLocalDate(yearStart) && tx.date <= todayStr;
      }
      return true;
    };

    const windowedTx = state.transactions.filter(inWindow);

    if (timeRange === 'day') {
      for (let h = 0; h < 24; h += 1) {
        const hStr = String(h).padStart(2, '0');
        const label = `${hStr}:00`;
        let inc = 0;
        let exp = 0;

        windowedTx.forEach((tx) => {
          if (tx.date !== windowDayStr) return;
          let txHour = -1;
          if (tx.time) {
            txHour = parseInt(tx.time.split(':')[0], 10);
          } else if (tx.createdAt) {
            txHour = new Date(tx.createdAt).getHours();
          }
          if (txHour === h) {
            if (tx.type === 'income') inc += tx.amount;
            if (tx.type === 'expense') exp += tx.amount;
          }
        });

        points.push({
          label,
          date: `${windowDayStr} ${label}`,
          income: inc,
          expense: exp,
          cumulativeIncome: 0,
          cumulativeExpense: 0,
          balance: inc - exp,
        });
      }
    } else if (timeRange === 'year') {
      const monthMap = new Map<
        string,
        { label: string; date: string; income: number; expense: number }
      >();

      const buildMonthAxis = (
        startYear: number,
        startMonth: number,
        endYear: number,
        endMonth: number,
      ) => {
        let cursor = new Date(startYear, startMonth, 1);
        const cursorEnd = new Date(endYear, endMonth, 1);
        while (cursor < cursorEnd) {
          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
          if (!monthMap.has(key)) {
            monthMap.set(key, {
              label: cursor.toLocaleString('default', { month: 'short' }),
              date: key,
              income: 0,
              expense: 0,
            });
          }
          cursor.setMonth(cursor.getMonth() + 1);
        }
      };

      if (viewMode === 'current') {
        buildMonthAxis(currentYear, 0, currentYear, 12);
      } else {
        // 12 months ending with the current month (was 13: same month last year
        // through the current month).
        buildMonthAxis(currentYear - 1, currentMonth + 1, currentYear, currentMonth + 1);
      }

      windowedTx.forEach((tx) => {
        const key = tx.date.slice(0, 7);
        const existing = monthMap.get(key);
        if (existing) {
          existing.income += tx.type === 'income' ? tx.amount : 0;
          existing.expense += tx.type === 'expense' ? tx.amount : 0;
          return;
        }
        const [y, m] = key.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        monthMap.set(key, {
          label: d.toLocaleString('default', { month: 'short' }),
          date: key,
          income: tx.type === 'income' ? tx.amount : 0,
          expense: tx.type === 'expense' ? tx.amount : 0,
        });
      });

      const sorted = Array.from(monthMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      for (const p of sorted) {
        points.push({
          label: p.label,
          date: p.date,
          income: p.income,
          expense: p.expense,
          cumulativeIncome: 0,
          cumulativeExpense: 0,
          balance: p.income - p.expense,
        });
      }
    } else {
      const dayMap = new Map<
        string,
        { label: string; date: string; income: number; expense: number }
      >();

      const buildDayAxis = (startDate: Date, endDate: Date) => {
        const cursor = new Date(startDate);
        while (cursor <= endDate) {
          const key = formatLocalDate(cursor);
          if (!dayMap.has(key)) {
            dayMap.set(key, {
              label: `${cursor.getDate()} ${cursor.toLocaleString('default', {
                month: 'short',
              })}`,
              date: key,
              income: 0,
              expense: 0,
            });
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      };

      if (viewMode === 'current' && timeRange !== 'all') {
        if (timeRange === 'week') {
          // Show the full configured week (7 days); days after today stay empty.
          const weekStart = startOfWeek(today);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          buildDayAxis(weekStart, weekEnd);
        } else if (timeRange === 'month') {
          const monthEnd = new Date(currentYear, currentMonth + 1, 0);
          buildDayAxis(new Date(currentYear, currentMonth, 1), monthEnd);
        } else {
          const yearStart = new Date(currentYear, 0, 1);
          const yearEnd = new Date(currentYear, 11, 31);
          buildDayAxis(yearStart, yearEnd);
        }
      } else if (timeRange === 'all') {
        // Lifetime view: every single day from the earliest transaction date to today.
        // Leftmost = first transaction date, rightmost = today, with every day along the way.
        let earliestDateStr = todayStr;
        windowedTx.forEach((tx) => {
          if (tx.date < earliestDateStr) {
            earliestDateStr = tx.date;
          }
        });

        const [startY, startM, startD] = earliestDateStr.split('-').map(Number);
        const startDate = new Date(startY, startM - 1, startD);
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const dayMapAll = new Map<
          string,
          { label: string; date: string; income: number; expense: number }
        >();

        const cursor = new Date(startDate);
        while (cursor <= endDate) {
          const key = formatLocalDate(cursor);
          const yearDiff = cursor.getFullYear() !== currentYear;
          const label = `${cursor.getDate()} ${cursor.toLocaleString('default', {
            month: 'short',
          })}${yearDiff ? ` '${String(cursor.getFullYear()).slice(2)}` : ''}`;

          dayMapAll.set(key, {
            label,
            date: key,
            income: 0,
            expense: 0,
          });
          cursor.setDate(cursor.getDate() + 1);
        }

        windowedTx.forEach((tx) => {
          const existing = dayMapAll.get(tx.date);
          if (existing) {
            if (tx.type === 'income') existing.income += tx.amount;
            else if (tx.type === 'expense') existing.expense += tx.amount;
          }
        });

        const sortedAll = Array.from(dayMapAll.values()).sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        for (const p of sortedAll) {
          points.push({
            label: p.label,
            date: p.date,
            income: p.income,
            expense: p.expense,
            cumulativeIncome: 0,
            cumulativeExpense: 0,
            balance: p.income - p.expense,
          });
        }
      } else {
        const rangeStart = new Date(today);
        if (timeRange === 'week') {
          rangeStart.setDate(today.getDate() - 6);
        } else {
          rangeStart.setDate(today.getDate() - 30);
        }
        buildDayAxis(rangeStart, today);
      }

      // The lifetime branch above already pushed its own buckets; only the day
      // spines (week/month/year) aggregate into dayMap, otherwise every
      // transaction was counted twice (doubled legend totals and duplicate days).
      if (timeRange !== 'all') {
        windowedTx.forEach((tx) => {
          const [y, m, d] = tx.date.split('-').map(Number);
          const key = tx.date;
          const existing = dayMap.get(key);
          if (existing) {
            existing.income += tx.type === 'income' ? tx.amount : 0;
            existing.expense += tx.type === 'expense' ? tx.amount : 0;
            return;
          }
          const dateObj = new Date(y, m - 1, d);
          dayMap.set(key, {
            label: `${d} ${dateObj.toLocaleString('default', { month: 'short' })}`,
            date: key,
            income: tx.type === 'income' ? tx.amount : 0,
            expense: tx.type === 'expense' ? tx.amount : 0,
          });
        });

        const sorted = Array.from(dayMap.values()).sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        for (const p of sorted) {
          points.push({
            label: p.label,
            date: p.date,
            income: p.income,
            expense: p.expense,
            cumulativeIncome: 0,
            cumulativeExpense: 0,
            balance: p.income - p.expense,
          });
        }
      }
    }

    // Cumulative runs over the full spine so labels always have values.
    let runInc = 0;
    let runExp = 0;
    for (let i = 0; i < points.length; i += 1) {
      runInc += points[i].income;
      runExp += points[i].expense;
      points[i].cumulativeIncome = runInc;
      points[i].cumulativeExpense = runExp;
    }

    // Balance is walked backwards from the endpoint. In current mode we only
    // allow the visible slice to reflect real cumulative movement; past the
    // cutoff the balance is held flat so future axis points are not invented.
    let runningBalance = totalNetWorth;
    for (let i = points.length - 1; i >= 0; i -= 1) {
      points[i].balance = runningBalance;
      if (i <= currentDrawEnd(points, viewMode, timeRange, currentYear, currentMonth, todayStr)) {
        runningBalance -= points[i].income - points[i].expense;
      }
    }

    return points;
  }, [state.transactions, timeRange, viewMode, totalNetWorth, state.settings.weekStartDay]);

  const chartPoints = chartData;

  const totalIn = chartPoints.reduce((s, p) => s + p.income, 0);
  const totalOut = chartPoints.reduce((s, p) => s + p.expense, 0);

  const width = 1000;
  const height = 240;
  const paddingX = 14;
  const paddingTop = 32;
  const paddingBottom = 8;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const allValues = chartPoints.flatMap((d) => [
    d.cumulativeIncome,
    d.cumulativeExpense,
    d.balance,
  ]);
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(10, ...allValues);
  const range = maxVal - minVal || 1;

  const getX = (idx: number) => {
    if (chartPoints.length <= 1) return paddingX + innerWidth / 2;
    return paddingX + (idx / (chartPoints.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    const norm = (val - minVal) / range;
    return paddingTop + innerHeight - norm * innerHeight;
  };

  const visibleEnd =
    viewMode === 'current' && chartPoints.length > 0
      ? (() => {
          const now = new Date();
          const todayStr = formatLocalDate(now);
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth();

          if (timeRange === 'day') {
            const hourKey = `${String(now.getHours()).padStart(2, '0')}:00`;
            for (let i = chartPoints.length - 1; i >= 0; i -= 1) {
              if (chartPoints[i].label === hourKey) return i;
            }
            return chartPoints.length - 1;
          }

          if (timeRange === 'week' || timeRange === 'month') {
            for (let i = chartPoints.length - 1; i >= 0; i -= 1) {
              if (chartPoints[i].date === todayStr) return i;
            }
            return chartPoints.length - 1;
          }

          if (timeRange === 'year') {
            const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
            for (let i = chartPoints.length - 1; i >= 0; i -= 1) {
              if (chartPoints[i].date === currentMonthKey) return i;
            }
            return chartPoints.length - 1;
          }

          return chartPoints.length - 1;
        })()
      : chartPoints.length - 1;

  const visiblePoints = chartPoints.slice(0, visibleEnd + 1);

  const generateSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    if (values.length === 1)
      return `M ${getX(0).toFixed(1)},${getY(values[0]).toFixed(1)}`;

    const pts = values.map((v, i) => ({ x: getX(i), y: getY(v) }));
    const n = pts.length;

    const dxs: number[] = [];
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i += 1) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      dxs.push(dx);
      slopes.push(dx === 0 ? 0 : dy / dx);
    }

    const m = new Array<number>(n);
    m[0] = slopes[0];
    m[n - 1] = slopes[n - 2];

    for (let i = 1; i < n - 1; i += 1) {
      const s0 = slopes[i - 1];
      const s1 = slopes[i];
      if (s0 * s1 <= 0) {
        m[i] = 0;
      } else {
        const dx0 = dxs[i - 1];
        const dx1 = dxs[i];
        const weighted = (s0 * dx1 + s1 * dx0) / (dx0 + dx1);
        m[i] = Math.sign(s0) * Math.min(
          Math.abs(weighted),
          2 * Math.abs(s0),
          2 * Math.abs(s1),
        );
      }
    }

    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i += 1) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dx = dxs[i];
      const cp1x = p1.x + dx / 3;
      const cp1y = p1.y + (m[i] * dx) / 3;
      const cp2x = p2.x - dx / 3;
      const cp2y = p2.y - (m[i + 1] * dx) / 3;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    return d;
  };

  const incomePath = generateSmoothPath(visiblePoints.map((d) => d.cumulativeIncome));
  const expensePath = generateSmoothPath(visiblePoints.map((d) => d.cumulativeExpense));
  const balancePath = generateSmoothPath(visiblePoints.map((d) => d.balance));

  const visibleFuturePath =
    visibleEnd < chartPoints.length - 1
      ? `M ${getX(visibleEnd).toFixed(1)},${getY(chartPoints[visibleEnd].balance).toFixed(1)} L ${getX(visibleEnd + 1).toFixed(1)},${getY(chartPoints[visibleEnd + 1].balance).toFixed(1)} L ${getX(chartPoints.length - 1).toFixed(1)},${getY(chartPoints[chartPoints.length - 1].balance).toFixed(1)}`
      : '';

  const balanceAreaPath =
    visiblePoints.length > 1 && visibleEnd >= 0
      ? `${balancePath} L ${getX(visibleEnd).toFixed(1)},${(paddingTop + innerHeight).toFixed(1)} L ${getX(0).toFixed(1)},${(paddingTop + innerHeight).toFixed(1)} Z`
      : '';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || chartPoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * width;

    let closestIdx = 0;
    let minDiff = Infinity;
    chartPoints.forEach((_, idx) => {
      const diff = Math.abs(getX(idx) - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  const activePoint =
    hoveredIndex !== null && chartPoints.length > hoveredIndex
      ? chartPoints[hoveredIndex]
      : null;
  const activeX =
    hoveredIndex !== null && chartPoints.length > hoveredIndex
      ? getX(hoveredIndex)
      : 0;

  const axisIndices = useMemo(() => {
    const totalPoints = chartPoints.length;
    if (totalPoints <= 1) return totalPoints ? [0] : [];

    // Estimate the widest label we will actually render (10px monospace,
    // ~6px per character) plus a small gap.
    const charWidth = 6;
    const labelGap = 9;
    const maxLabelChars = chartPoints.reduce(
      (max, p) => Math.max(max, p.label.length),
      1,
    );
    const perLabel = maxLabelChars * charWidth + labelGap;

    const chartPx = Math.max(160, chartWidth || 280);
    const maxLabels = Math.max(2, Math.floor(chartPx / perLabel));

    if (totalPoints <= maxLabels) {
      return Array.from({ length: totalPoints }, (_, i) => i);
    }

    // When there are more points than can fit without overlapping,
    // evenly distribute ticks ensuring the first (0) and last (totalPoints - 1)
    // points are ALWAYS labeled.
    const indices: number[] = [];
    for (let i = 0; i < maxLabels; i += 1) {
      const idx = Math.round((i / (maxLabels - 1)) * (totalPoints - 1));
      if (indices.length === 0 || idx > indices[indices.length - 1]) {
        indices.push(idx);
      }
    }
    return indices;
  }, [chartPoints, chartWidth]);

  const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current || chartPoints.length === 0 || !e.touches[0]) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches[0].clientX - rect.left;
    const svgX = (clientX / rect.width) * width;

    let closestIdx = 0;
    let minDiff = Infinity;
    chartPoints.forEach((_, idx) => {
      const diff = Math.abs(getX(idx) - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  return (
    <div className="bg-[#101014] rounded-2xl p-3 sm:p-5 border border-zinc-900/60 shadow-sm flex flex-col space-y-2 sm:space-y-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span>Net Worth</span>
          </div>
          <div
            className={`text-base sm:text-xl font-bold font-mono tracking-tight mt-0.5 leading-none ${
              displayNetWorth >= 0 ? 'text-white' : 'text-rose-400'
            }`}
          >
            {displayNetWorth >= 0 ? '+' : ''}
            {formatCurrency(displayNetWorth, state.settings.currencySymbol)}
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
            <span>Savings</span>
          </div>
          <div className="text-base sm:text-xl font-bold font-mono tracking-tight text-white mt-0.5 leading-none">
            {displaySavingsRate}%
          </div>
        </div>
      </div>

      <div ref={chartFrameRef} className="w-full flex-1 min-h-0 relative select-none">
        <div className="relative w-full h-28 sm:h-52">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible cursor-crosshair touch-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
          >
            <defs>
              <linearGradient
                id="balanceGlow"
                x1={0}
                y1={paddingTop}
                x2={0}
                y2={paddingTop + innerHeight}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="incomeGrad" x1={0} y1={0} x2={1} y2={0}>
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              <linearGradient id="expenseGrad" x1={0} y1={0} x2={1} y2={0}>
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>

              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <line
              x1={paddingX}
              y1={paddingTop}
              x2={width - paddingX}
              y2={paddingTop}
              stroke="#27272a"
              strokeDasharray="4 4"
              strokeWidth="0.8"
            />
            <line
              x1={paddingX}
              y1={paddingTop + innerHeight / 2}
              x2={width - paddingX}
              y2={paddingTop + innerHeight / 2}
              stroke="#27272a"
              strokeDasharray="4 4"
              strokeWidth="0.8"
            />
            <line
              x1={paddingX}
              y1={paddingTop + innerHeight}
              x2={width - paddingX}
              y2={paddingTop + innerHeight}
              stroke="#27272a"
              strokeWidth="1"
            />

            {balanceAreaPath && (
              <path d={balanceAreaPath} fill="#3b82f6" fillOpacity="0.12" />
            )}

            {visibleFuturePath && (
              <path
                d={visibleFuturePath}
                fill="none"
                stroke="#6b6b76"
                strokeWidth="1.4"
                strokeDasharray="3 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.65"
              />
            )}

            {hoveredIndex !== null && activePoint && (
              <g className="transition-all duration-75">
                <rect
                  x={activeX - 20}
                  y={paddingTop - 10}
                  width={40}
                  height={innerHeight + 20}
                  fill="#ffffff"
                  fillOpacity="0.06"
                  rx={6}
                />
                <line
                  x1={activeX}
                  y1={paddingTop - 8}
                  x2={activeX}
                  y2={paddingTop + innerHeight}
                  stroke="#71717a"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.9"
                />
              </g>
            )}

            <path
              d={balancePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d={incomePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />

            <path
              d={expensePath}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />

            {/* Only one visible point (e.g. first day of the week/month): show markers
                so the series is still readable instead of drawing no line at all. */}
            {visiblePoints.length === 1 && (
              <g>
                <circle
                  cx={getX(visibleEnd)}
                  cy={getY(visiblePoints[0].balance)}
                  r={3.5}
                  fill="#3b82f6"
                />
                <circle
                  cx={getX(visibleEnd)}
                  cy={getY(visiblePoints[0].cumulativeIncome)}
                  r={2.4}
                  fill="#10b981"
                  opacity="0.9"
                />
                <circle
                  cx={getX(visibleEnd)}
                  cy={getY(visiblePoints[0].cumulativeExpense)}
                  r={2.4}
                  fill="#f43f5e"
                  opacity="0.9"
                />
              </g>
            )}

            {axisIndices.map((idx) => {
              const d = chartPoints[idx];
              if (!d) return null;
              const posX = getX(idx);
              return (
                <g key={d.date}>
                  <line
                    x1={posX}
                    y1={paddingTop + innerHeight}
                    x2={posX}
                    y2={paddingTop + innerHeight + 4}
                    stroke="#3f3f46"
                    strokeWidth="1"
                  />
                </g>
              );
            })}
          </svg>

          {hoveredIndex !== null && activePoint && (() => {
            const posXPercent = (activeX / width) * 100;
            const posYPercent = (getY(activePoint.balance) / height) * 100;
            const isNearRight = posXPercent > 70;
            const isNearLeft = posXPercent < 30;

            return (
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                <div
                  className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500 bg-[#060608] flex items-center justify-center shadow-[0_0_8px_rgba(59,130,246,0.5)] z-20"
                  style={{ left: `${posXPercent}%`, top: `${posYPercent}%` }}
                >
                  <span className="w-1 h-1 rounded-full bg-white" />
                </div>

                {activePoint.cumulativeIncome > 0 && (
                  <span
                    className={`absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-emerald-500 z-10 transition-transform ${
                      activePoint.income > 0 ? 'ring-2 ring-emerald-400/80 scale-125' : ''
                    }`}
                    style={{
                      left: `${posXPercent}%`,
                      top: `${(getY(activePoint.cumulativeIncome) / height) * 100}%`,
                    }}
                  />
                )}
                {activePoint.cumulativeExpense > 0 && (
                  <span
                    className={`absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-rose-500 z-10 transition-transform ${
                      activePoint.expense > 0 ? 'ring-2 ring-rose-400/80 scale-125' : ''
                    }`}
                    style={{
                      left: `${posXPercent}%`,
                      top: `${(getY(activePoint.cumulativeExpense) / height) * 100}%`,
                    }}
                  />
                )}

                <div
                  className={`absolute font-mono px-3 py-2 rounded-xl border border-zinc-700/80 bg-[#14141cf5] backdrop-blur-md shadow-2xl text-left pointer-events-none transition-all duration-75 z-30 min-w-[140px] ${
                    isNearRight
                      ? '-translate-x-full -ml-3'
                      : isNearLeft
                        ? 'ml-3'
                        : '-translate-x-1/2'
                  }`}
                  style={{
                    left: `${posXPercent}%`,
                    top: Math.max(6, Math.min(posYPercent - 48, 55)) + '%',
                  }}
                >
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1.5 pb-1 border-b border-zinc-800">
                    {activePoint.label}
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-white whitespace-nowrap mb-1">
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      Net
                    </span>
                    <span className="text-blue-400">
                      {formatCurrency(activePoint.balance, state.settings.currencySymbol)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[10px] whitespace-nowrap text-zinc-400">
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <span className="w-1 h-1 rounded-full bg-emerald-500" />
                      Total In
                    </span>
                    <span className="text-emerald-400 font-bold">
                      +{formatCurrency(activePoint.cumulativeIncome, state.settings.currencySymbol)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[10px] whitespace-nowrap text-zinc-400 mt-0.5">
                    <span className="flex items-center gap-1 text-rose-400 font-medium">
                      <span className="w-1 h-1 rounded-full bg-rose-500" />
                      Total Out
                    </span>
                    <span className="text-rose-400 font-bold">
                      -{formatCurrency(activePoint.cumulativeExpense, state.settings.currencySymbol)}
                    </span>
                  </div>

                  {(activePoint.income > 0 || activePoint.expense > 0) && (
                    <div className="mt-1.5 pt-1.5 border-t border-zinc-800/80 text-[10px] whitespace-nowrap flex items-center justify-between gap-2">
                      <span className="text-zinc-500">This Day</span>
                      <div className="flex items-center gap-1.5 font-bold">
                        {activePoint.income > 0 && (
                          <span className="text-emerald-400">
                            +{formatCurrency(activePoint.income, state.settings.currencySymbol)}
                          </span>
                        )}
                        {activePoint.expense > 0 && (
                          <span className="text-rose-400">
                            -{formatCurrency(activePoint.expense, state.settings.currencySymbol)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        </div>

        <div className="relative w-full py-1" style={{ height: '20px' }}>
          {axisIndices.map((idx) => {
            const d = chartPoints[idx];
            if (!d) return null;
            const isHovered = hoveredIndex === idx;

            // Center every label on its own data point. Edge labels are allowed to
            // use the card's padding as breathing room, so they only shift by the
            // couple of pixels needed to avoid being clipped by the card — never
            // left/right aligned away from their point.
            const rowWidth = Math.max(160, chartWidth || 280);
            const edgeRoom = rowWidth < 640 ? 12 : 20; // card p-3 / sm:p-5
            const labelHalf = Math.max(9, (d.label.length * 6.2 + 2) / 2);
            const rawCenter = (getX(idx) / width) * rowWidth;
            const minCenter = labelHalf - edgeRoom;
            const maxCenter = rowWidth - labelHalf + edgeRoom;
            const centerX =
              minCenter > maxCenter
                ? rowWidth / 2
                : Math.min(Math.max(rawCenter, minCenter), maxCenter);
            const posXPercent = (centerX / rowWidth) * 100;

            return (
              <span
                key={d.date}
                className={`absolute text-[10px] font-mono whitespace-nowrap select-none transition-colors ${
                  isHovered ? 'text-white font-bold' : 'text-zinc-500'
                }`}
                style={{ left: `${posXPercent}%`, transform: 'translateX(-50%)' }}
              >
                {d.label}
              </span>
            );
          })}
        </div>

        <div className="mt-1 -mb-1 sm:mt-2 sm:-mb-2 flex items-center justify-center flex-wrap gap-4 text-[10px] sm:text-[11px] font-mono pt-2 border-t border-zinc-900/80">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="text-blue-400">Net Worth</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>+{formatCurrency(totalIn, state.settings.currencySymbol)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>-{formatCurrency(totalOut, state.settings.currencySymbol)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

function currentDrawEnd(
  points: { date: string; label: string }[],
  viewMode: 'pass' | 'current',
  timeRange: 'day' | 'week' | 'month' | 'year' | 'all',
  currentYear: number,
  currentMonth: number,
  todayStr: string,
): number {
  if (viewMode !== 'current' || points.length === 0) return points.length - 1;

  if (timeRange === 'day') {
    const hourKey = `${String(new Date().getHours()).padStart(2, '0')}:00`;
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (points[i].label === hourKey) return i;
    }
    return points.length - 1;
  }

  if (timeRange === 'week' || timeRange === 'month') {
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (points[i].date === todayStr) return i;
    }
    return points.length - 1;
  }

  if (timeRange === 'year') {
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (points[i].date === currentMonthKey) return i;
    }
    return points.length - 1;
  }

  return points.length - 1;
}
