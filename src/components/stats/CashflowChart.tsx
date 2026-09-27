import React, { useMemo, useState, useRef } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../common/Icons';

interface CashflowChartProps {
  timeRange?: 'week' | 'month' | 'year' | 'all';
}

export const CashflowChart: React.FC<CashflowChartProps> = ({ timeRange = 'month' }) => {
  const { state, totalNetWorth } = useFinance();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<'all' | 'balance' | 'flow'>('all');
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Build sequential data points based on timeRange
  const chartData = useMemo(() => {
    const points: { label: string; date: string; income: number; expense: number; balance: number }[] = [];
    const now = new Date();

    let numDays = 14;
    if (timeRange === 'week') numDays = 7;
    else if (timeRange === 'month') numDays = 30;
    else if (timeRange === 'year') numDays = 12;
    else numDays = 30;

    if (timeRange === 'year') {
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

  return (
    <div className="bg-[#101014] rounded-3xl p-5 sm:p-6 border border-zinc-900/60 shadow-sm space-y-3">
      {/* Chart Header - fixed height, flex-wrap proof */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-h-[52px]">
        <div>
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase block">
            Cashflow & Balance
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono mt-1">
            <button
              onClick={() => setActiveMetric('all')}
              className={`flex items-center gap-1.5 cursor-pointer transition-opacity ${
                activeMetric === 'all' ? 'opacity-100 font-bold' : 'opacity-50'
              }`}
            >
              <span className="w-2.5 h-0.5 bg-[#3b82f6] rounded-full" />
              <span className="text-blue-400">Balance</span>
            </button>
            <button
              onClick={() => setActiveMetric(activeMetric === 'flow' ? 'all' : 'flow')}
              className="flex items-center gap-1.5 cursor-pointer"
            >
              <span className="w-2.5 h-0.5 bg-[#10b981] rounded-full" />
              <span className="text-emerald-400">In: +{formatCurrency(totalIn, state.settings.currencySymbol)}</span>
            </button>
            <button
              onClick={() => setActiveMetric(activeMetric === 'flow' ? 'all' : 'flow')}
              className="flex items-center gap-1.5 cursor-pointer"
            >
              <span className="w-2.5 h-0.5 bg-[#f43f5e] rounded-full" />
              <span className="text-rose-400">Out: -{formatCurrency(totalOut, state.settings.currencySymbol)}</span>
            </button>
          </div>
        </div>

        {/* Hover info badge - neatly contained within card, never overflowing */}
        <div className={`font-mono px-3 py-1 rounded-xl border transition-opacity duration-150 self-start sm:self-auto text-left sm:text-right ${
          activePoint
            ? 'opacity-100 bg-[#16161d] border-zinc-700/80 shadow-lg'
            : 'opacity-0 pointer-events-none border-transparent'
        }`}>
          <div className="text-[10px] text-zinc-400 font-bold">
            {activePoint ? activePoint.label : '-'}
          </div>
          <div className="text-[11px] sm:text-xs text-white font-bold whitespace-nowrap flex items-center gap-2">
            {activePoint ? (
              <>
                <span className="text-blue-400">
                  {formatCurrency(activePoint.balance, state.settings.currencySymbol)}
                </span>
                <span className="text-[10px] text-zinc-500">•</span>
                <span className="text-emerald-400">
                  +{formatCurrency(activePoint.income, state.settings.currencySymbol)}
                </span>
                <span className="text-rose-400">
                  -{formatCurrency(activePoint.expense, state.settings.currencySymbol)}
                </span>
              </>
            ) : (
              <span className="text-zinc-700">0.00</span>
            )}
          </div>
        </div>
      </div>

      {/* SVG Curved Line Chart Canvas with interactive cursor tracking */}
      <div className="w-full relative select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-52 sm:h-60 overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
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
                stroke="#3b82f6"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                opacity="0.8"
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

          {/* Highlight Nodes / Targets on the active hovered column */}
          {hoveredIndex !== null && activePoint && (
            <g>
              {/* Balance point circle (Blue) */}
              <circle
                cx={activeX}
                cy={getY(activePoint.balance)}
                r={7}
                fill="#000000"
                stroke="#3b82f6"
                strokeWidth={2.5}
              />
              <circle
                cx={activeX}
                cy={getY(activePoint.balance)}
                r={3.5}
                fill="#ffffff"
              />

              {/* Income point circle (Green) */}
              <circle
                cx={activeX}
                cy={getY(activePoint.income)}
                r={5}
                fill="#000000"
                stroke="#10b981"
                strokeWidth={2}
              />
              <circle
                cx={activeX}
                cy={getY(activePoint.income)}
                r={2}
                fill="#34d399"
              />

              {/* Floating Pill Tooltip tag directly on the chart */}
              <g transform={`translate(${Math.min(width - 65, Math.max(activeX, 45))}, ${Math.max(20, getY(activePoint.balance) - 28)})`}>
                <rect
                  x={-28}
                  y={-14}
                  width={56}
                  height={22}
                  rx={11}
                  fill="#3b82f6"
                  filter="url(#glow)"
                />
                <rect
                  x={-28}
                  y={-14}
                  width={56}
                  height={22}
                  rx={11}
                  fill="#3b82f6"
                />
                <text
                  x={0}
                  y={1.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {formatCurrency(activePoint.balance, state.settings.currencySymbol).replace('.00', '')}
                </text>
                {/* Pointer arrow downward */}
                <polygon
                  points="-4,8 4,8 0,12"
                  fill="#3b82f6"
                />
              </g>
            </g>
          )}

          {/* X Axis Labels */}
          {chartData.map((d, idx) => {
            // Show select evenly spaced labels
            const step = Math.max(1, Math.floor(chartData.length / 6));
            const isEdgeOrStep = idx === 0 || idx === chartData.length - 1 || idx % step === 0;
            if (!isEdgeOrStep) return null;

            return (
              <text
                key={d.date}
                x={getX(idx)}
                y={height - 10}
                textAnchor="middle"
                fill={hoveredIndex === idx ? '#ffffff' : '#71717a'}
                fontSize="10"
                fontFamily="monospace"
                fontWeight={hoveredIndex === idx ? 'bold' : 'normal'}
              >
                {d.label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Metric legend description */}
      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-900/60">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Net Balance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Inflow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Outflow
          </span>
        </div>
      </div>
    </div>
  );
};

