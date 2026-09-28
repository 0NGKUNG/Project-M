import React, { useState } from 'react';
import { X, CreditCard, TrendingUp, TrendingDown, Edit2, Trash2 } from 'lucide-react';
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

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  onClose,
  onOpenQuickAddWithAccount,
}) => {
  useBackButton(Boolean(account), onClose);
  const { state, accountBalances, updateAccount, deleteAccount } = useFinance();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Account Editing State
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<Account['type']>('bank');
  const [editBalance, setEditBalance] = useState('0');
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── All hooks above the early-return guard ──────────────────────────────
  const currentBalance = account ? (accountBalances[account.id] ?? account.initialBalance) : 0;

  const accountTransactions = React.useMemo(() => {
    if (!account) return [];
    return [...state.transactions.filter(
      (t) => t.accountId === account.id || t.toAccountId === account.id
    )].sort((a, b) => {
      const da = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const db = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return db - da;
    });
  }, [account, state.transactions]);

  // Filter state for history list (All | Income | Expenses)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Daily balance chart: 30-day (or date range) daily points
  const allTimeChart = React.useMemo(() => {
    if (!account) return [];

    const today = new Date();
    let startDate = new Date();
    startDate.setDate(today.getDate() - 30);

    if (accountTransactions.length > 0) {
      const earliest = new Date(`${accountTransactions[accountTransactions.length - 1].date}T00:00:00`);
      if (!isNaN(earliest.getTime()) && earliest < startDate) {
        startDate = earliest;
      }
    }

    const dates: string[] = [];
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);

    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    if (dates.length < 2) {
      dates.length = 0;
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
    }

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

    let rolling = currentBalance;
    for (let i = points.length - 1; i >= 0; i--) {
      points[i].balance = rolling;
      rolling -= (netByDay[points[i].date] || 0);
    }

    return points;
  }, [account, currentBalance, accountTransactions]);

  const filteredTransactions = React.useMemo(() => {
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

  // ─── Income / Expenses totals ─────────────────────────────────────────────
  const { totalIncome, totalExpenses } = React.useMemo(() => {
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

  // ─── Guard ────────────────────────────────────────────────────────────────
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
    if (window.confirm(`Are you sure you want to permanently delete account "${account.name}" and all its transactions? This will also remove them from Supabase.`)) {
      setIsDeleting(true);
      await deleteAccount(account.id);
      setIsDeleting(false);
      onClose();
    }
  };

  // ─── SVG chart renderer (shared) ──────────────────────────────────────────
  const renderChart = (points: { label: string; balance: number }[], chartId: string) => {
    if (points.length < 2) {
      return (
        <div className="w-full h-full flex items-center justify-center text-[11px] font-mono text-zinc-600">
          Not enough data yet
        </div>
      );
    }
    const balances = points.map((p) => (Number.isFinite(p.balance) ? p.balance : 0));
    const minBal = Math.min(...balances);
    const maxBal = Math.max(...balances);
    const diff = maxBal - minBal;
    const range = diff > 0 ? diff : 1;
    const W = 320;
    const H = 80;

    const coords = points.map((p, idx) => {
      const safeBal = Number.isFinite(p.balance) ? p.balance : minBal;
      const x = (idx / Math.max(1, points.length - 1)) * W;
      const y = diff === 0 ? H / 2 : (H - 8) - ((safeBal - minBal) / range) * (H - 16);
      return { x, y, ...p };
    });

    const pointsStr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const areaStr = `0,${H} ${pointsStr} ${W},${H}`;

    return (
      <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon points={areaStr} fill={`url(#grad-${chartId})`} />
        <polyline
          points={pointsStr}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Only show first, last, and every nth label to avoid overcrowding */}
        {coords.map((c, i) => {
          const isLast = i === coords.length - 1;
          const isFirst = i === 0;
          return (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={isLast ? 3.5 : isFirst ? 2.5 : 1.5}
              className={
                isLast
                  ? 'fill-white stroke-[#0d0d12] stroke-2'
                  : 'fill-zinc-500'
              }
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal shell — larger on desktop */}
      <div
        className="w-full max-w-5xl 2xl:max-w-6xl bg-[#0e0e12] border-t lg:border border-zinc-800 rounded-t-2xl lg:rounded-2xl flex flex-col lg:flex-row overflow-hidden shadow-2xl max-h-[94vh] lg:max-h-[90vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══════════════════════════════════════════════════════════════════
            LEFT COLUMN — header + cards (always visible, scrollable on mobile)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col lg:w-[460px] 2xl:w-[500px] lg:shrink-0 overflow-y-auto lg:overflow-y-auto lg:border-r border-zinc-800/70">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-white shrink-0">
                <CreditCard size={18} />
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
                className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                title="Delete Account"
                className="p-2 rounded-full bg-zinc-800/80 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-0.5"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="px-6 space-y-3 pb-6">
            {/* ── Card 1 · Balance + Income / Expenses ── */}
            <div className="bg-[#141418] rounded-2xl p-5 space-y-4 border border-zinc-800/50">
              <div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  Total Balance
                </div>
                <div className="text-3xl font-mono font-bold text-white mt-1 tabular-nums">
                  {formatCurrency(currentBalance, state.settings.currencySymbol)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800/60">
                {/* Income */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider">Income</div>
                    <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                      +{formatCurrency(totalIncome, state.settings.currencySymbol)}
                    </div>
                  </div>
                </div>

                {/* Expenses */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
                    <TrendingDown size={16} />
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider">Expenses</div>
                    <div className="text-sm font-mono font-bold text-rose-400 tabular-nums">
                      -{formatCurrency(totalExpenses, state.settings.currencySymbol)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Card 2 · Clean Chart Only in Grey Card ── */}
            <div className="bg-[#141418] rounded-2xl p-4 border border-zinc-800/50 flex flex-col justify-between">
              <div className="relative h-44 w-full rounded-xl overflow-hidden">
                {renderChart(allTimeChart, `alltime-${account.id}`)}
              </div>

              {/* Month labels at bottom of the chart card */}
              {allTimeChart.length >= 2 && (
                <div className="flex justify-between px-2 pt-2 border-t border-zinc-800/40 mt-1">
                  {(() => {
                    const total = allTimeChart.length;
                    const idxs = total <= 5
                      ? allTimeChart.map((_, i) => i)
                      : [0, Math.floor(total * 0.25), Math.floor(total * 0.5), Math.floor(total * 0.75), total - 1];
                    const unique = [...new Set(idxs)];
                    return unique.map((i) => (
                      <span key={i} className="text-[9px] font-mono text-zinc-500">
                        {allTimeChart[i].label}
                      </span>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* ── Add Transaction button (always visible on mobile; hidden on desktop — shown in right col) ── */}
            <button
              onClick={() => {
                onClose();
                onOpenQuickAddWithAccount(account.id);
              }}
              className="w-full py-3 rounded-2xl bg-white hover:bg-zinc-100 active:scale-[0.98] text-black text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all lg:hidden"
            >
              + Add Transaction To This Account
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Transactions (right on desktop, below on mobile)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Header & View Filter Tabs */}
          <div className="px-5 pt-4 pb-3 shrink-0 border-b border-zinc-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase font-semibold tracking-wider text-zinc-400">
                Account History ({filteredTransactions.length})
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenQuickAddWithAccount(account.id);
                }}
                className="hidden lg:block px-4 py-2 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-bold shadow cursor-pointer transition-all"
              >
                + Add Transaction
              </button>
            </div>

            {/* Filter Tabs: All | Income | Expenses */}
            <div className="flex items-center gap-1.5 bg-[#141418] p-1 rounded-xl border border-zinc-800/70">
              {(['all', 'income', 'expense'] as const).map((f) => {
                const isAct = historyFilter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setHistoryFilter(f)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold capitalize transition-all cursor-pointer text-center ${
                      isAct ? 'bg-white text-black shadow-xs font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expenses'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transaction list — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3 space-y-1">
            {filteredTransactions.length === 0 ? (
              <div className="bg-[#121216] rounded-2xl p-8 text-center text-xs text-zinc-500 mt-2 font-mono">
                No {historyFilter === 'all' ? '' : historyFilter} transactions found.
              </div>
            ) : (
              <div className="bg-[#121216] rounded-2xl divide-y divide-zinc-900 overflow-hidden">
                {filteredTransactions.map((tx) => {
                  const isIncoming =
                    tx.type === 'income' ||
                    (tx.type === 'transfer' && tx.toAccountId === account.id);
                  const cat = getCategory(tx.categoryId);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => setEditingTransaction(tx)}
                      className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isIncoming ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          <CategoryIcon name={cat?.icon || 'Receipt'} size={17} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-zinc-200">
                            {tx.type === 'transfer' ? 'Transfer' : cat?.name || 'Other'}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
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
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs cursor-pointer"
          onClick={() => setIsEditingAccount(false)}
        >
          <div
            className="w-full max-w-sm bg-[#101014] rounded-2xl p-6 border border-zinc-800 shadow-2xl space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-mono">Edit Account</h3>
              <button
                type="button"
                onClick={() => setIsEditingAccount(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 bg-[#16161c] border border-zinc-800/80 rounded-xl px-3.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
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
                          ? 'bg-white text-black font-bold'
                          : 'bg-[#16161c] text-zinc-400 hover:text-white border border-zinc-800/80'
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
                  className="w-full h-11 bg-[#16161c] border border-zinc-800/80 rounded-xl px-3.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingAccount(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold font-mono hover:bg-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-bold font-mono hover:bg-zinc-200 cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
