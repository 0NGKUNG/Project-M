import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PlusCircle, 
  Eye, 
  EyeOff,
  ArrowRight,
  Cloud,
  ChevronRight
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { SpendingChart } from './SpendingChart';
import type { Account } from '../../types/finance';

interface DashboardViewProps {
  onOpenQuickAdd: () => void;
  onViewAllTransactions: () => void;
  onSelectAccount: (account: Account) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenQuickAdd,
  onViewAllTransactions,
  onSelectAccount,
}) => {
  const {
    state,
    isCloudSynced,
    totalNetWorth,
    monthlyIncome,
    monthlyExpense,
    monthlySavingsRate,
    accountBalances,
  } = useFinance();

  const [hideBalances, setHideBalances] = useState(false);

  const recentTransactions = state.transactions.slice(0, 6);

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);
  const getAccount = (accId: string) => state.accounts.find((a) => a.id === accId);

  return (
    <div className="space-y-6 pb-24 md:pb-12 safe-top px-4 md:px-8 w-full animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-white font-display tracking-wider">NØVA</h1>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono ${
                isCloudSynced 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-zinc-800 text-zinc-400'
              }`}>
                {isCloudSynced ? <Cloud size={10} /> : <span className="font-mono">∅</span>}
                {isCloudSynced ? 'Supabase Synced' : 'Local Offline'}
              </span>
          </div>
        </div>

        <button
          onClick={() => setHideBalances(!hideBalances)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#101014] hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer text-xs font-medium"
          aria-label="Toggle privacy"
        >
          {hideBalances ? <EyeOff size={15} /> : <Eye size={15} />}
          <span>{hideBalances ? 'Show' : 'Hide'}</span>
        </button>
      </div>

      {/* Top Hero Cards: Net Worth & Savings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-gradient-to-br from-[#15151b] via-[#101014] to-[#0c0c0e] rounded-2xl p-5 sm:p-6 border border-zinc-800/70 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-2">
              <span className="flex items-center gap-2 uppercase tracking-widest text-zinc-400 font-semibold">
                <Wallet size={16} /> Net Worth
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-zinc-800/90 text-zinc-300 font-mono">
                {state.settings.currencyCode}
              </span>
            </div>

            <div className="text-4xl sm:text-6xl font-mono font-bold tracking-tight text-white my-3 tabular-nums">
              {hideBalances ? '••••••••' : formatCurrency(totalNetWorth, state.settings.currencySymbol)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-zinc-800/40">
            <div className="bg-[#181820]/70 rounded-xl p-3.5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="text-[11px] text-zinc-400 uppercase font-mono">Income</div>
                <div className="text-sm sm:text-base font-mono font-bold text-white tabular-nums">
                  {hideBalances ? '••••' : formatCurrency(monthlyIncome, state.settings.currencySymbol)}
                </div>
              </div>
            </div>

            <div className="bg-[#181820]/70 rounded-xl p-3.5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
                <TrendingDown size={20} />
              </div>
              <div>
                <div className="text-[11px] text-zinc-400 uppercase font-mono">Expenses</div>
                <div className="text-sm sm:text-base font-mono font-bold text-white tabular-nums">
                  {hideBalances ? '••••' : formatCurrency(monthlyExpense, state.settings.currencySymbol)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-[#101014] rounded-2xl p-5 sm:p-6 border border-zinc-800/70 flex flex-col justify-between shadow-sm">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Monthly Retention Rate
            </div>
            <div className="text-5xl font-mono font-bold text-white my-2">
              {monthlySavingsRate}%
            </div>
            <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
              {monthlySavingsRate >= 20
                ? 'Strong retention rate. Maintaining healthy financial reserve.'
                : 'Expenses currently close to incoming earnings.'}
            </p>
          </div>

          <div className="mt-6 pt-4">
            <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden p-0.5">
              <div
                style={{ width: `${Math.min(monthlySavingsRate, 100)}%` }}
                className="h-full bg-white rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Wallets & Accounts (Interactive: Click to inspect account stats & add to account) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono uppercase font-bold tracking-wider text-zinc-400">
            Vault Wallets & Accounts ({state.accounts.length})
          </span>
          <span className="text-[11px] text-zinc-500">Tap account to view details & stats</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {state.accounts.map((acc) => {
            const bal = accountBalances[acc.id] ?? acc.initialBalance;
            return (
              <button
                key={acc.id}
                onClick={() => onSelectAccount(acc)}
                className="bg-[#101014] hover:bg-[#15151c] active:scale-98 rounded-2xl p-5 border border-zinc-800/70 hover:border-zinc-700 flex flex-col justify-between transition-all group text-left cursor-pointer shadow-sm relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <div className="flex items-center justify-between mb-4 w-full">
                  <span className="text-xs text-zinc-300 font-semibold truncate group-hover:text-white transition-colors">
                    {acc.name}
                  </span>
                  <div className="w-7 h-7 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors shrink-0">
                    <ChevronRight size={14} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-0.5">
                    {acc.type}
                  </div>
                  <div className="text-base sm:text-xl font-mono font-bold text-white tabular-nums">
                    {hideBalances ? '••••' : formatCurrency(bal, state.settings.currencySymbol)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SpendingChart />

        <div className="bg-[#101014] rounded-2xl p-5 sm:p-6 border border-zinc-800/70 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-semibold tracking-wider text-zinc-400">
              Recent Vault Activity
            </span>
            <button
              onClick={onViewAllTransactions}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>View all logs</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center my-auto">
              <p className="text-xs text-zinc-500 mb-3">No activity recorded yet.</p>
              <button
                onClick={onOpenQuickAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white text-black text-xs font-bold"
              >
                <PlusCircle size={15} /> Log transaction
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-900">
              {recentTransactions.map((tx) => {
                const cat = getCategory(tx.categoryId);
                const acc = getAccount(tx.accountId);
                const isIncome = tx.type === 'income';
                const isTransfer = tx.type === 'transfer';

                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between hover:bg-white/[0.02] px-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : isTransfer
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-zinc-800/80 text-zinc-200'
                      }`}>
                        <CategoryIcon name={cat?.icon || 'Receipt'} size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-2">
                          <span>{isTransfer ? 'Transfer' : (cat?.name || 'Other')}</span>
                          {tx.note && (
                            <span className="text-[11px] text-zinc-500 font-normal truncate max-w-[150px] md:max-w-[220px]">
                              • {tx.note}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {acc?.name} • {tx.date}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className={`text-xs font-bold tabular-nums ${
                        isIncome
                          ? 'text-emerald-400'
                          : isTransfer
                          ? 'text-blue-400'
                          : 'text-white'
                      }`}>
                        {isIncome ? '+' : isTransfer ? '' : '-'}
                        {formatCurrency(tx.amount, state.settings.currencySymbol)}
                      </div>
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
