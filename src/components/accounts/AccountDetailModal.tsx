import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Edit2, 
  Trash2, 
  Plus, 
  Wallet,
  ArrowRight
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { CurrencyInput, parseFormattedNumber } from '../common/CurrencyInput';
import type { Account, Transaction } from '../../types/finance';
import { EditTransactionModal } from '../transactions/EditTransactionModal';
import { useBackButton } from '../../hooks/useBackButton';

interface AccountDetailModalProps {
  account: Account | null;
  onClose: () => void;
  onOpenQuickAddWithAccount: (accountId: string) => void;
}

type TimeRange = '7D' | '30D' | '90D' | 'ALL';

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  onClose,
  onOpenQuickAddWithAccount,
}) => {
  useBackButton(Boolean(account), onClose);
  const { state, accountBalances, updateAccount, deleteAccount } = useFinance();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Mobile View Toggle: Overview vs History
  const [mobileTab, setMobileTab] = useState<'overview' | 'history'>('overview');

  // Chart Timeframe
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [activeHoverPoint, setActiveHoverPoint] = useState<{ label: string; balance: number; date: string } | null>(null);

  // Account Editing State
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<Account['type']>('bank');
  const [editBalance, setEditBalance] = useState('0');
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter state for history list (All | Income | Expenses)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'income' | 'expense'>('all');

  const currentBalance = account ? (accountBalances[account.id] ?? account.initialBalance) : 0;

  const accountTransactions = useMemo(() => {
    if (!account) return [];
    return [...state.transactions.filter(
      (t) => t.accountId === account.id || t.toAccountId === account.id
    )].sort((a, b) => {
      const da = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const db = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return db - da;
    });
  }, [account, state.transactions]);

  // Chart points calculation
  const chartData = useMemo(() => {
    if (!account) return { points: [], minBal: 0, maxBal: 0, isSteady: true };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let daysCount = 30;
    if (timeRange === '7D') daysCount = 7;
    else if (timeRange === '30D') daysCount = 30;
    else if (timeRange === '90D') daysCount = 90;
    else if (timeRange === 'ALL') {
      if (accountTransactions.length > 0) {
        const earliestTx = accountTransactions[accountTransactions.length - 1];
        const earliestDate = new Date(`${earliestTx.date}T00:00:00`);
        const diffDays = Math.ceil((today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
        daysCount = Math.max(7, Math.min(365, diffDays + 2));
      } else {
        daysCount = 14;
      }
    }

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (daysCount - 1));

    const dates: string[] = [];
    const cur = new Date(startDate);
    while (cur <= today) {
      dates.push(formatLocalDate(cur));
      cur.setDate(cur.getDate() + 1);
    }

    // Net change by local date
    const netByDay: Record<string, number> = {};
    accountTransactions.forEach((tx) => {
      const d = tx.date;
      netByDay[d] = netByDay[d] || 0;
      if (tx.accountId === account.id) {
        if (tx.type === 'income') netByDay[d] += tx.amount;
        else if (tx.type === 'expense' || tx.type === 'transfer') netByDay[d] -= tx.amount;
      }
      if (tx.toAccountId === account.id && tx.type === 'transfer') {
        netByDay[d] += tx.amount;
      }
    });

    const points: { label: string; balance: number; date: string }[] = dates.map((d) => {
      const parts = d.split('-');
      const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return {
        date: d,
        label: `${dObj.getDate()} ${dObj.toLocaleString('default', { month: 'short' })}`,
        balance: 0,
      };
    });

    // Roll backwards from currentBalance
    let rolling = currentBalance;
    for (let i = points.length - 1; i >= 0; i--) {
      points[i].balance = rolling;
      rolling -= (netByDay[points[i].date] || 0);
    }

    const balances = points.map((p) => p.balance);
    const minBal = Math.min(...balances);
    const maxBal = Math.max(...balances);
    const isSteady = Math.abs(maxBal - minBal) < 0.01;

    return { points, minBal, maxBal, isSteady };
  }, [account, currentBalance, accountTransactions, timeRange]);

  const filteredTransactions = useMemo(() => {
    if (!account) return [];
    if (historyFilter === 'income') {
      return accountTransactions.filter(
        (t) => t.type === 'income' || (t.type === 'transfer' && t.toAccountId === account.id)
      );
    }
    if (historyFilter === 'expense') {
      return accountTransactions.filter(
        (t) => t.type === 'expense' || (t.type === 'transfer' && t.accountId === account.id)
      );
    }
    return accountTransactions;
  }, [accountTransactions, historyFilter, account]);

  // Income / Expenses totals
  const { totalIncome, totalExpenses } = useMemo(() => {
    let income = 0;
    let expenses = 0;
    if (!account) return { totalIncome: 0, totalExpenses: 0 };
    accountTransactions.forEach((t) => {
      if (t.type === 'income' && t.accountId === account.id) income += t.amount;
      if (t.type === 'expense' && t.accountId === account.id) expenses += t.amount;
      if (t.type === 'transfer') {
        if (t.accountId === account.id) expenses += t.amount;
        if (t.toAccountId === account.id) income += t.amount;
      }
    });
    return { totalIncome: income, totalExpenses: expenses };
  }, [account, accountTransactions]);

  if (!account) return null;

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);

  const handleStartEdit = () => {
    setEditName(account.name);
    setEditType(account.type);
    setEditBalance(account.initialBalance.toString());
    setIsEditingAccount(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    await updateAccount({
      ...account,
      name: editName.trim(),
      type: editType,
      initialBalance: parseFormattedNumber(editBalance),
      icon: editType === 'cash' ? 'Wallet' : 'CreditCard',
    });
    setIsEditingAccount(false);
  };

  const handleDeleteAccount = async () => {
    if (window.confirm(`Are you sure you want to permanently delete account "${account.name}" and all its transactions?`)) {
      setIsDeleting(true);
      await deleteAccount(account.id);
      setIsDeleting(false);
      onClose();
    }
  };

  // Smooth SVG Curved Chart
  const renderSmoothChart = () => {
    const { points, minBal, maxBal, isSteady } = chartData;
    if (points.length < 2) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-xs font-mono text-zinc-500">
          <span>Not enough balance history</span>
        </div>
      );
    }

    const W = 360;
    const H = 130;
    const padTop = 16;
    const padBottom = 20;
    const usableH = H - padTop - padBottom;

    const diff = maxBal - minBal;
    // Add 15% headroom above and below so points don't clip at edges
    const range = isSteady ? 1 : diff * 1.3;
    const baseMin = isSteady ? minBal : minBal - diff * 0.15;

    const coords = points.map((p, idx) => {
      const x = (idx / Math.max(1, points.length - 1)) * W;
      const y = isSteady 
        ? H / 2 
        : H - padBottom - ((p.balance - baseMin) / range) * usableH;
      return { x, y, ...p };
    });

    // Build smooth cubic bezier curve
    let pathD = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const midX = (curr.x + next.x) / 2;
      pathD += ` C ${midX.toFixed(1)},${curr.y.toFixed(1)} ${midX.toFixed(1)},${next.y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
    }

    const areaD = `${pathD} L ${W},${H} L 0,${H} Z`;

    const activePoint = activeHoverPoint || coords[coords.length - 1];
    const activeCoord = coords.find((c) => c.date === activePoint?.date) || coords[coords.length - 1];

    return (
      <div className="relative w-full h-full flex flex-col justify-between select-none">
        {/* Active hover tooltip display */}
        <div className="flex items-center justify-between px-1 mb-1 text-[11px] font-mono">
          <div className="text-zinc-400">
            {activePoint ? activePoint.label : 'Balance Trend'}
          </div>
          <div className="font-bold text-white tabular-nums">
            {formatCurrency(activePoint ? activePoint.balance : currentBalance, state.settings.currencySymbol)}
          </div>
        </div>

        {/* SVG Curve Container */}
        <div className="relative h-28 w-full">
          <svg 
            className="w-full h-full overflow-visible" 
            viewBox={`0 0 ${W} ${H}`} 
            preserveAspectRatio="none"
            onPointerLeave={() => setActiveHoverPoint(null)}
          >
            <defs>
              <linearGradient id={`grad-account-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                <stop offset="70%" stopColor="#ffffff" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gradient Area */}
            <path d={areaD} fill={`url(#grad-account-${account.id})`} />

            {/* Subtle Guide Line for steady state */}
            {isSteady && (
              <line 
                x1="0" 
                y1={H / 2} 
                x2={W} 
                y2={H / 2} 
                stroke="#52525b" 
                strokeWidth="1" 
                strokeDasharray="4 4" 
              />
            )}

            {/* Main Smooth Stroke */}
            <path 
              d={pathD} 
              fill="none" 
              stroke="#ffffff" 
              strokeWidth="2.2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />

            {/* Active Highlight Dot */}
            {activeCoord && (
              <g>
                <circle 
                  cx={activeCoord.x} 
                  cy={activeCoord.y} 
                  r="7" 
                  fill="#ffffff" 
                  fillOpacity="0.2" 
                />
                <circle 
                  cx={activeCoord.x} 
                  cy={activeCoord.y} 
                  r="3.5" 
                  fill="#ffffff" 
                  stroke="#0c0c10" 
                  strokeWidth="2" 
                />
              </g>
            )}

            {/* Touch / Mouse Scrubbing invisible hitboxes */}
            {coords.map((c, i) => {
              const segW = W / coords.length;
              return (
                <rect
                  key={i}
                  x={Math.max(0, c.x - segW / 2)}
                  y="0"
                  width={segW}
                  height={H}
                  fill="transparent"
                  className="cursor-pointer"
                  onPointerEnter={() => setActiveHoverPoint(c)}
                  onPointerDown={() => setActiveHoverPoint(c)}
                />
              );
            })}
          </svg>
        </div>

        {/* Steady balance indicator or min/max summary */}
        {isSteady ? (
          <div className="flex items-center justify-center gap-1.5 py-1 text-[10px] font-mono text-zinc-500 bg-zinc-900/40 rounded-lg mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
            <span>Steady balance · No fluctuation in this period</span>
          </div>
        ) : (
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/40 mt-1">
            <span>Min: {formatCurrency(minBal, state.settings.currencySymbol)}</span>
            <span>Max: {formatCurrency(maxBal, state.settings.currencySymbol)}</span>
          </div>
        )}
      </div>
    );
  };

  if (!account) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Modal shell — Full screen on mobile (100dvh), polished card on desktop */}
      <div
        className="w-full lg:max-w-5xl 2xl:max-w-6xl h-[100dvh] lg:h-auto lg:max-h-[90vh] bg-[#0c0c10] border-t lg:border border-zinc-800/80 rounded-none lg:rounded-3xl flex flex-col lg:flex-row overflow-hidden shadow-2xl cursor-default safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══════════════════════════════════════════════════════════════════
            TOP MOBILE HEADER & VIEW TOGGLE (Mobile only)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:hidden shrink-0 border-b border-zinc-800/80 bg-[#0e0e14] px-4 pt-3 pb-3 space-y-3 safe-top">
          {/* Top handle on mobile */}
          <div className="w-10 h-1 bg-zinc-700/80 rounded-full mx-auto" />

          {/* Account name + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-zinc-800 flex items-center justify-center text-white shrink-0">
                {account.type === 'cash' ? <Wallet size={17} /> : <CreditCard size={17} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{account.name}</h3>
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                  {account.type}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleStartEdit}
                title="Edit Account"
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                title="Delete Account"
                className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Segmented View Switcher: Overview vs History */}
          <div className="grid grid-cols-2 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setMobileTab('overview')}
              className={`py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                mobileTab === 'overview'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('history')}
              className={`py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                mobileTab === 'history'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Transactions ({filteredTransactions.length})
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            LEFT COLUMN — Overview (Balance, Chart, Controls)
            Visible on desktop always; visible on mobile when mobileTab === 'overview'
        ═══════════════════════════════════════════════════════════════════ */}
        <div 
          className={`flex-col lg:w-[440px] 2xl:w-[480px] lg:shrink-0 lg:border-r border-zinc-800/80 overflow-y-auto ${
            mobileTab === 'overview' ? 'flex flex-1 min-h-0' : 'hidden lg:flex'
          }`}
        >
          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-zinc-800 flex items-center justify-center text-white shrink-0">
                {account.type === 'cash' ? <Wallet size={19} /> : <CreditCard size={19} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">{account.name}</h3>
                <p className="text-xs text-zinc-500 uppercase font-mono tracking-wider">
                  {account.type} account
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleStartEdit}
                title="Edit Account"
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                title="Delete Account"
                className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-0.5"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="px-4 sm:px-6 space-y-3 py-4 lg:py-2 pb-6">
            {/* ── Card 1 · Balance + Income / Expenses ── */}
            <div className="bg-[#121218] rounded-2xl p-4 sm:p-5 space-y-4 border border-zinc-800/60 shadow-sm">
              <div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
                  Total Balance
                </div>
                <div className="text-2xl sm:text-3xl font-mono font-bold text-white mt-1 tabular-nums">
                  {formatCurrency(currentBalance, state.settings.currencySymbol)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-zinc-800/60">
                {/* Income */}
                <div className="flex items-center gap-2.5 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/40">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                    <TrendingUp size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider">Income</div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-emerald-400 tabular-nums truncate">
                      +{formatCurrency(totalIncome, state.settings.currencySymbol)}
                    </div>
                  </div>
                </div>

                {/* Expenses */}
                <div className="flex items-center gap-2.5 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/40">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
                    <TrendingDown size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider">Expenses</div>
                    <div className="text-xs sm:text-sm font-mono font-bold text-rose-400 tabular-nums truncate">
                      -{formatCurrency(totalExpenses, state.settings.currencySymbol)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Card 2 · Smooth Balance Trend Chart ── */}
            <div className="bg-[#121218] rounded-2xl p-4 border border-zinc-800/60 shadow-sm space-y-3">
              {/* Range Filters */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                  Balance History
                </span>
                <div className="flex items-center gap-1 bg-[#181822] p-0.5 rounded-xl border border-zinc-800/80">
                  {(['7D', '30D', '90D', 'ALL'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTimeRange(r)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        timeRange === r
                          ? 'bg-white text-black shadow-xs'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Render Chart */}
              <div className="h-44 w-full">
                {renderSmoothChart()}
              </div>
            </div>

            {/* ── Add Transaction button ── */}
            <button
              onClick={() => {
                onClose();
                onOpenQuickAddWithAccount(account.id);
              }}
              className="w-full py-3.5 rounded-2xl bg-white hover:bg-zinc-200 active:scale-[0.98] text-black text-xs font-bold font-mono flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
            >
              <Plus size={16} strokeWidth={2.8} />
              <span>Add Transaction To This Account</span>
            </button>

            {/* Mobile-only recent activity snippet in Overview */}
            <div className="lg:hidden pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-1">
                <span>Recent Activity</span>
                {accountTransactions.length > 0 && (
                  <button
                    onClick={() => setMobileTab('history')}
                    className="text-zinc-300 hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    View all ({accountTransactions.length}) <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {accountTransactions.slice(0, 3).map((tx) => {
                const isIncoming = tx.type === 'income' || (tx.type === 'transfer' && tx.toAccountId === account.id);
                const cat = getCategory(tx.categoryId);
                return (
                  <div
                    key={tx.id}
                    onClick={() => setEditingTransaction(tx)}
                    className="p-3 rounded-xl bg-[#121218] border border-zinc-800/40 flex items-center justify-between cursor-pointer active:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isIncoming ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        <CategoryIcon name={cat?.icon || 'Receipt'} size={15} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {tx.type === 'transfer' ? 'Transfer' : cat?.name || 'Other'}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {tx.date}
                        </div>
                      </div>
                    </div>
                    <div className={`text-xs font-mono font-bold tabular-nums ${isIncoming ? 'text-emerald-400' : 'text-white'}`}>
                      {isIncoming ? '+' : '-'}{formatCurrency(tx.amount, state.settings.currencySymbol)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Full Transactions History
            Visible on desktop always; visible on mobile when mobileTab === 'history'
        ═══════════════════════════════════════════════════════════════════ */}
        <div 
          className={`flex-col flex-1 min-h-0 overflow-hidden ${
            mobileTab === 'history' ? 'flex flex-1 min-h-0' : 'hidden lg:flex'
          }`}
        >
          {/* Header & View Filter Tabs */}
          <div className="px-5 pt-4 pb-3 shrink-0 border-b border-zinc-800/70 space-y-3 bg-[#0c0c10]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-bold tracking-wider text-zinc-400">
                History ({filteredTransactions.length})
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenQuickAddWithAccount(account.id);
                }}
                className="hidden lg:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold font-mono shadow cursor-pointer transition-all active:scale-95"
              >
                <Plus size={14} strokeWidth={2.8} />
                <span>Add Transaction</span>
              </button>
            </div>

            {/* Filter Tabs: All | Income | Expenses */}
            <div className="flex items-center gap-1.5 bg-[#121218] p-1 rounded-xl border border-zinc-800/70">
              {(['all', 'income', 'expense'] as const).map((f) => {
                const isAct = historyFilter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setHistoryFilter(f)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono capitalize transition-all cursor-pointer text-center ${
                      isAct ? 'bg-white text-black font-bold shadow-xs' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expenses'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transaction list — scrollable */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 pt-3 space-y-1">
            {filteredTransactions.length === 0 ? (
              <div className="bg-[#121218] rounded-2xl p-10 text-center text-xs text-zinc-500 mt-2 font-mono border border-zinc-800/40">
                No {historyFilter === 'all' ? '' : historyFilter} transactions recorded for this account.
              </div>
            ) : (
              <div className="bg-[#121218] rounded-2xl border border-zinc-800/50 divide-y divide-zinc-800/60 overflow-hidden">
                {filteredTransactions.map((tx) => {
                  const isIncoming =
                    tx.type === 'income' ||
                    (tx.type === 'transfer' && tx.toAccountId === account.id);
                  const cat = getCategory(tx.categoryId);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => setEditingTransaction(tx)}
                      className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors cursor-pointer group active:bg-zinc-800/60"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isIncoming ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          <CategoryIcon name={cat?.icon || 'Receipt'} size={17} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white group-hover:text-zinc-200 truncate">
                            {tx.type === 'transfer' ? 'Transfer' : cat?.name || 'Other'}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                            {tx.date}
                            {tx.time && ` · ${tx.time}`}
                            {tx.note && ` · ${tx.note}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-xs tabular-nums shrink-0 ml-3">
                        <span className={isIncoming ? 'text-emerald-400' : 'text-white'}>
                          {isIncoming ? '+' : '-'}
                          {formatCurrency(tx.amount, state.settings.currencySymbol)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransactionModal
          key={editingTransaction.id}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {/* Edit Account Modal */}
      {isEditingAccount && (
        <div
          className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md cursor-pointer animate-fade-in"
          onClick={() => setIsEditingAccount(false)}
        >
          <div
            className="w-full sm:max-w-md bg-[#0c0c10] rounded-t-3xl sm:rounded-3xl p-6 border-t sm:border border-zinc-800 shadow-2xl space-y-4 cursor-default safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700/80 rounded-full mx-auto sm:hidden mb-2" />
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
              <h3 className="text-base font-bold text-white font-mono">Edit Account</h3>
              <button
                type="button"
                onClick={() => setIsEditingAccount(false)}
                className="p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 bg-[#14141c] border border-zinc-800 rounded-xl px-3.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['bank', 'cash', 'credit', 'investment'] as Account['type'][]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditType(t)}
                      className={`py-2 px-3 rounded-xl text-xs font-mono capitalize transition-all cursor-pointer ${
                        editType === t
                          ? 'bg-white text-black font-bold shadow-xs'
                          : 'bg-[#14141c] text-zinc-400 hover:text-white border border-zinc-800/80'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                  Initial Balance
                </label>
                <CurrencyInput
                  currencySymbol={state.settings.currencySymbol}
                  type="number"
                  step="any"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="w-full h-11 bg-[#14141c] border border-zinc-800 rounded-xl px-3.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingAccount(false)}
                  className="flex-1 py-3 rounded-xl bg-zinc-900 text-zinc-300 text-xs font-bold font-mono hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-white text-black text-xs font-bold font-mono hover:bg-zinc-200 cursor-pointer shadow-md active:scale-98 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
