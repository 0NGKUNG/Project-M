import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../common/Icons';

interface CashflowChartProps {
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  netSavings?: number;
  savingsRate?: number;
}

export const CashflowChart: React.FC<CashflowChartProps> = ({ 
  timeRange = 'month',
  netSavings,
  savingsRate
}) => {
  const { state, totalNetWorth } = useFinance();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const chartFrameRef = useRef<HTMLDivElement | null>(null);

  // Fallbacks if not passed directly
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
  const paddingBottom = 8;
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

  // Generate smooth monotone cubic bezier SVG path (avoids Catmull-Rom overshoot / dip before rise)
  const generateSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    if (values.length === 1) return `M ${getX(0).toFixed(1)},${getY(values[0]).toFixed(1)}`;

    const pts = values.map((v, i) => ({ x: getX(i), y: getY(v) }));
    const n = pts.length;

    const dxs: number[] = [];
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      dxs.push(dx);
      slopes.push(dx === 0 ? 0 : dy / dx);
    }

    // Monotone tangents computation (Steffen / Fritsch-Carlson)
    const m = new Array<number>(n);
    m[0] = slopes[0];
    m[n - 1] = slopes[n - 2];

    for (let i = 1; i < n - 1; i++) {
      const s0 = slopes[i - 1];
      const s1 = slopes[i];
      if (s0 * s1 <= 0) {
        // Local extremum or flat: horizontal tangent prevents any overshoot or undershoot dip
        m[i] = 0;
      } else {
        const dx0 = dxs[i - 1];
        const dx1 = dxs[i];
        const weighted = (s0 * dx1 + s1 * dx0) / (dx0 + dx1);
        m[i] = Math.sign(s0) * Math.min(Math.abs(weighted), 2 * Math.abs(s0), 2 * Math.abs(s1));
      }
    }

    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
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

  // Ensure X-axis labels are evenly spaced and legible across all screen sizes
  const axisIndices = useMemo(() => {
    const totalPoints = chartData.length;
    if (totalPoints <= 1) return totalPoints ? [0] : [];

    const availableWidth = chartWidth || 280;
    // ~85px per label — enough room for "28 Sep" style text at all sizes; min 2
    const maxLabels = Math.max(2, Math.min(totalPoints, Math.floor(availableWidth / 85)));

    const indices: number[] = [];
    for (let i = 0; i < maxLabels; i++) {
      indices.push(Math.round((i * (totalPoints - 1)) / (maxLabels - 1)));
    }
    // Deduplicate in case of small datasets
    return Array.from(new Set(indices));
  }, [chartData.length, chartWidth]);

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
    <div className="bg-[#101014] rounded-2xl p-4 sm:p-5 border border-zinc-900/60 shadow-sm flex flex-col space-y-3 overflow-hidden">
      {/* Chart Header - Net Worth and Savings Rate displayed over the chart */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span>Net Worth</span>
          </div>
          <div className={`text-lg sm:text-xl font-bold font-mono tracking-tight mt-0.5 leading-none ${
            displayNetWorth >= 0 ? 'text-white' : 'text-rose-400'
          }`}>
            {displayNetWorth >= 0 ? '+' : ''}{formatCurrency(displayNetWorth, state.settings.currencySymbol)}
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-zinc-500 text-[10px] font-mono uppercase font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
            <span>Savings</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tracking-tight text-white mt-0.5 leading-none">
            {displaySavingsRate}%
          </div>
        </div>
      </div>

      {/* SVG Curved Line Chart Canvas with interactive cursor tracking */}
      <div ref={chartFrameRef} className="w-full flex-1 min-h-0 relative select-none">
        <div className="relative w-full h-48 sm:h-56">
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

          {/* X-Axis Grid Tick Marks only (no text — labels rendered as HTML below) */}
          {axisIndices.map((idx) => {
            const d = chartData[idx];
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


          {/* Fixed-size HTML markers and Floating Tooltip Overlay */}
          {hoveredIndex !== null && activePoint && (() => {
            const posXPercent = (activeX / width) * 100;
            const posYPercent = (getY(activePoint.balance) / height) * 100;
            // Flip horizontal anchor when near the right edge (> 70%) to avoid overflowing the card
            const isNearRight = posXPercent > 70;
            const isNearLeft = posXPercent < 30;

            return (
              <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                {/* Active circle marker on the net balance curve */}
                <div
                  className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500 bg-[#060608] flex items-center justify-center shadow-[0_0_8px_rgba(59,130,246,0.5)] z-20"
                  style={{ left: `${posXPercent}%`, top: `${posYPercent}%` }}
                >
                  <span className="w-1 h-1 rounded-full bg-white" />
                </div>

                {activePoint.income > 0 && (
                  <span
                    className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-emerald-500 z-10"
                    style={{ left: `${posXPercent}%`, top: `${(getY(activePoint.income) / height) * 100}%` }}
                  />
                )}
                {activePoint.expense > 0 && (
                  <span
                    className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black bg-rose-500 z-10"
                    style={{ left: `${posXPercent}%`, top: `${(getY(activePoint.expense) / height) * 100}%` }}
                  />
                )}

                {/* Floating Tooltip Box directly above / beside the active point */}
                <div
                  className={`absolute font-mono px-2.5 py-1.5 rounded-xl border border-zinc-700/80 bg-[#16161df2] backdrop-blur-md shadow-xl text-left pointer-events-none transition-all duration-75 z-30 ${
                    isNearRight
                      ? '-translate-x-full -ml-3'
                      : isNearLeft
                      ? 'ml-3'
                      : '-translate-x-1/2'
                  }`}
                  style={{
                    left: `${posXPercent}%`,
                    top: Math.max(8, Math.min(posYPercent - 42, 60)) + '%',
                  }}
                >
                  <div className="text-[11px] text-zinc-400 font-medium mb-1">
                    {activePoint.label}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-white whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-blue-400">
                      {formatCurrency(activePoint.balance, state.settings.currencySymbol)}
                    </span>
                  </div>
                  {(activePoint.income > 0 || activePoint.expense > 0) && (
                    <div className="flex items-center gap-2 mt-1 text-[11px] whitespace-nowrap border-t border-zinc-800/80 pt-1">
                      {activePoint.income > 0 && (
                        <span className="text-emerald-400 font-bold">
                          +{formatCurrency(activePoint.income, state.settings.currencySymbol)}
                        </span>
                      )}
                      {activePoint.expense > 0 && (
                        <span className="text-rose-400 font-bold">
                          -{formatCurrency(activePoint.expense, state.settings.currencySymbol)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* X-Axis date labels — exact position matching getX tick coordinates */}
        <div className="relative w-full py-1" style={{ height: '20px' }}>
          {axisIndices.map((idx) => {
            const d = chartData[idx];
            if (!d) return null;
            const isHovered = hoveredIndex === idx;
            // Calculate exact percentage in SVG coordinate system (getX(idx) relative to total viewBox width)
            const posXPercent = (getX(idx) / width) * 100;

            // Adjust transform/alignment based on horizontal position to prevent label clipping at edges
            let transform = 'translateX(-50%)';
            if (posXPercent < 5) {
              transform = 'translateX(0%)';
            } else if (posXPercent > 95) {
              transform = 'translateX(-100%)';
            }

            return (
              <span
                key={d.date}
                className={`absolute text-[10px] font-mono whitespace-nowrap select-none transition-colors ${isHovered ? 'text-white font-bold' : 'text-zinc-500'}`}
                style={{
                  left: `${posXPercent}%`,
                  transform,
                }}
              >
                {d.label}
              </span>
            );
          })}
        </div>

        {/* Legend and totals under the chart in the same card - centered together */}
        <div className="flex items-center justify-center flex-wrap gap-4 text-[10px] sm:text-[11px] font-mono pt-2 border-t border-zinc-900/80">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="text-zinc-400">Net Worth</span>
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

