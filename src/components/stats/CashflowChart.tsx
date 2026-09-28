import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../common/Icons';

interface CashflowChartProps {
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
}

export const CashflowChart: React.FC<CashflowChartProps> = ({ timeRange = 'month' }) => {
  const { state, totalNetWorth } = useFinance();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const chartFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = chartFrameRef.current;
    if (!frame) return;

    const updateWidth = () => setChartWidth(frame.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Build sequential data points based on timeRange
  const chartData = useMemo(() => {
    const points: { label: string; date: string; income: number; expense: number; balance: number }[] = [];
    const now = new Date();

    if (timeRange === 'day') {
      const todayStr = now.toISOString().split('T')[0];
      for (let h = 0; h < 24; h++) {
        const hStr = String(h).padStart(2, '0');
        const label = `${hStr}:00`;
        let inc = 0;
        let exp = 0;
        state.transactions.forEach((tx) => {
          if (tx.date === todayStr) {
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
          }
        });

        points.push({
          label,
          date: `${todayStr} ${label}`,
          income: inc,
          expense: exp,
          balance: inc - exp,
        });
      }
    } else if (timeRange === 'year') {
      // Monthly points
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
          balance: inc - exp,
        });
      }
    } else {
      let numDays = 30;
      if (timeRange === 'week') numDays = 7;
      else if (timeRange === 'month') numDays = 30;
      else numDays = 30;

      // Daily points
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
          balance: inc - exp,
        });
      }
    }

    // Compute cumulative balance trajectory ending at totalNetWorth
    let runningBalance = totalNetWorth;
    // Walk backwards from last point to compute historical balance at each point
    for (let i = points.length - 1; i >= 0; i--) {
      points[i].balance = runningBalance;
      runningBalance -= (points[i].income - points[i].expense);
    }

    return points;
  }, [state.transactions, timeRange, totalNetWorth]);

  const totalIn = chartData.reduce((s, p) => s + p.income, 0);
  const totalOut = chartData.reduce((s, p) => s + p.expense, 0);

  // SVG dimensions - full responsive width with minimal horizontal padding
  const width = 1000;
  const height = 240;
  const paddingX = 14;
  const paddingTop = 32;
  const paddingBottom = 36;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  // Determine scaling
  const allValues = chartData.flatMap((d) => [d.income, d.expense, d.balance]);
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(10, ...allValues);
  const range = maxVal - minVal || 1;

  const getX = (idx: number) => {
    if (chartData.length <= 1) return paddingX + innerWidth / 2;
    return paddingX + (idx / (chartData.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    const norm = (val - minVal) / range;
    return paddingTop + innerHeight - norm * innerHeight;
  };

  // Generate smooth cubic bezier SVG path (Catmull-Rom to cubic Bezier)
  const generateSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    if (values.length === 1) return `M ${getX(0)},${getY(values[0])}`;

    const pts = values.map((v, i) => ({ x: getX(i), y: getY(v) }));
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

      // Catmull-Rom tension 0.5 converted to Bezier control points
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    return d;
  };

  const incomePath = generateSmoothPath(chartData.map((d) => d.income));
  const expensePath = generateSmoothPath(chartData.map((d) => d.expense));
  const balancePath = generateSmoothPath(chartData.map((d) => d.balance));

  // Area under balance line: from start to end down to bottom line
  const balanceAreaPath = chartData.length > 1
    ? `${balancePath} L ${getX(chartData.length - 1).toFixed(1)},${(paddingTop + innerHeight).toFixed(1)} L ${getX(0).toFixed(1)},${(paddingTop + innerHeight).toFixed(1)} Z`
    : '';

  // Handle pointer hover across the SVG
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || chartData.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * width;

    // Find nearest data index
    let closestIdx = 0;
    let minDiff = Infinity;
    chartData.forEach((_, idx) => {
      const diff = Math.abs(getX(idx) - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  const activePoint = hoveredIndex !== null && chartData[hoveredIndex] ? chartData[hoveredIndex] : null;
  const activeX = hoveredIndex !== null ? getX(hoveredIndex) : 0;

  // Keep labels legible on small screens, while using every available column on wider charts.
  // The labels themselves are positioned from the same x-scale as the SVG paths.
  const axisIndices = useMemo(() => {
    if (chartData.length <= 1) return chartData.length ? [0] : [];

    const minimumLabelWidth = timeRange === 'year' || timeRange === 'day' ? 44 : 52;
    const availableWidth = chartWidth || 280;
    const labelCount = Math.min(
      chartData.length,
      Math.max(2, Math.floor(availableWidth / minimumLabelWidth) + 1),
    );

    return Array.from({ length: labelCount }, (_, index) =>
      Math.round((index * (chartData.length - 1)) / (labelCount - 1)),
    );
  }, [chartData.length, chartWidth, timeRange]);

  // Support touch gestures on mobile for scrubber
  const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current || chartData.length === 0 || !e.touches[0]) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches[0].clientX - rect.left;
    const svgX = (clientX / rect.width) * width;

    let closestIdx = 0;
    let minDiff = Infinity;
    chartData.forEach((_, idx) => {
      const diff = Math.abs(getX(idx) - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  return (
    <div className="bg-[#101014] rounded-2xl p-4 sm:p-6 border border-zinc-900/60 shadow-sm flex flex-col space-y-3 sm:space-y-4 overflow-hidden">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0">
          <span className="text-[11px] font-mono font-bold tracking-wider text-zinc-400 uppercase block truncate">
            Income, Expenses &amp; Net Worth
          </span>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-[11px] font-mono mt-1 text-zinc-500">
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Net Worth</span>
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>+{formatCurrency(totalIn, state.settings.currencySymbol)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>-{formatCurrency(totalOut, state.settings.currencySymbol)}</span>
            </span>
          </div>
        </div>

        {/* Hover info badge */}
        <div className={`h-9 sm:h-11 font-mono px-2.5 sm:px-3 py-1 rounded-xl border border-zinc-800 bg-[#16161d] transition-opacity duration-150 text-left sm:text-right flex flex-col justify-center self-start sm:self-auto shrink-0 max-w-full overflow-hidden ${
          activePoint ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="text-[10px] text-zinc-400 truncate">
            {activePoint ? activePoint.label : ''}
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-white whitespace-nowrap flex items-center gap-1.5 sm:gap-2">
            {activePoint && (
              <>
                <span className="text-blue-400">
                  {formatCurrency(activePoint.balance, state.settings.currencySymbol)}
                </span>
                <span className="text-zinc-600 font-normal">|</span>
                <span className="text-emerald-400 text-[10px] sm:text-[11px]">
                  +{formatCurrency(activePoint.income, state.settings.currencySymbol)}
                </span>
                <span className="text-rose-400 text-[10px] sm:text-[11px]">
                  -{formatCurrency(activePoint.expense, state.settings.currencySymbol)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SVG Curved Line Chart Canvas with interactive cursor tracking */}
      <div ref={chartFrameRef} className="w-full flex-1 min-h-0 relative select-none">
        <div className="relative w-full h-44 sm:h-52">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height - 28}`}
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible cursor-crosshair touch-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
          >
          <defs>
            {/* Soft blue gradient fill for balance area */}
            <linearGradient id="balanceGlow" x1="0" y1={paddingTop} x2="0" y2={paddingTop + innerHeight} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>

            {/* Inflow gradient (Green) */}
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            {/* Outflow gradient (Red) */}
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>

            {/* Subtle glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Horizontal grid lines */}
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

          {/* Hover highlight column (translucent dark pillar from user reference) */}
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

          {/* 1. Net Balance Curve (Blue, bold) */}
          <path
            d={balancePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 2. Inflow Curve (Green, smooth) */}
          <path
            d={incomePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />

          {/* 3. Outflow Curve (Red, smooth) */}
          <path
            d={expensePath}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />

          </svg>

          {/* Fixed-size HTML markers stay circular even though the SVG plot fills a wide card. */}
          {hoveredIndex !== null && activePoint && (
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div
                className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500 bg-[#060608] flex items-center justify-center"
                style={{ left: `${(activeX / width) * 100}%`, top: `${(getY(activePoint.balance) / (height - 28)) * 100}%` }}
              >
                <span className="w-1 h-1 rounded-full bg-white" />
              </div>
              {activePoint.income > 0 && (
                <span
                  className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-emerald-500"
                  style={{ left: `${(activeX / width) * 100}%`, top: `${(getY(activePoint.income) / (height - 28)) * 100}%` }}
                />
              )}
              {activePoint.expense > 0 && (
                <span
                  className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-rose-500"
                  style={{ left: `${(activeX / width) * 100}%`, top: `${(getY(activePoint.expense) / (height - 28)) * 100}%` }}
                />
              )}
            </div>
          )}
        </div>

        {/* Date labels share the chart's x-scale, preventing marker/label drift. */}
        <div className="relative h-4 mt-2 text-[11px] font-mono text-zinc-500 select-none">
          {axisIndices.map((idx) => {
            const d = chartData[idx];
            if (!d) return null;
            const isHovered = hoveredIndex === idx;
            const isFirst = idx === 0;
            const isLast = idx === chartData.length - 1;
            const xPercent = (getX(idx) / width) * 100;

            return (
              <span
                key={d.date}
                className={`absolute whitespace-nowrap transition-colors leading-none ${isHovered ? 'text-white font-bold' : 'text-zinc-500'}`}
                style={{
                  left: `${xPercent}%`,
                  transform: isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                {d.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

