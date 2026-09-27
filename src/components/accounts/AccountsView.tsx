import React, { useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  Plus, 
  PieChart, 
  ChevronRight,
  RefreshCw,
  Users
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../common/Icons';
import type { Account } from '../../types/finance';
import { RecurringManager } from '../recurring/RecurringManager';
import { DebtManager } from '../debts/DebtManager';

type AccountsSubTab = 'wallets' | 'recurring' | 'debts';

interface AccountsViewProps {
  onSelectAccount: (account: Account) => void;
  onOpenQuickAddWithAccount?: (accId: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  onSelectAccount,
}) => {
  const { state, totalNetWorth, accountBalances, addAccount } = useFinance();
  const [currentSubTab, setCurrentSubTab] = useState<AccountsSubTab>('wallets');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<Account['type']>('bank');
  const [newAccBalance, setNewAccBalance] = useState('0');

  // Calculate percentage of total net worth for each account
  const accountStats = state.accounts.map((acc) => {
    const balance = accountBalances[acc.id] ?? acc.initialBalance;
    const positiveNetWorth = Math.max(1, totalNetWorth);
    const percentage = totalNetWorth > 0 && balance > 0 
      ? Math.round((balance / positiveNetWorth) * 100) 
      : 0;

    return {
      ...acc,
      currentBalance: balance,
      percentage,
    };
  }).sort((a, b) => (b.currentBalance ?? 0) - (a.currentBalance ?? 0));

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;

    addAccount({
      name: newAccName.trim(),
      type: newAccType,
      initialBalance: parseFloat(newAccBalance) || 0,
      icon: newAccType === 'cash' ? 'Wallet' : 'CreditCard',
    });

    setNewAccName('');
    setNewAccBalance('0');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-12 px-4 md:px-8 w-full max-w-4xl mx-auto animate-fade-in select-none">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono">PORTFOLIO & ACCOUNTS</h2>
          <p className="text-xs text-zinc-500 font-mono">Balance Distribution & Net Worth</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-[0_2px_12px_rgba(255,255,255,0.12)]"
        >
          <Plus size={14} strokeWidth={2.8} />
          <span>New Account</span>
        </button>
      </div>

      {/* View Sub-tabs: Wallets, Recurring, Debts */}
      <div className="flex bg-[#101014] p-1.5 rounded-2xl border border-zinc-900 gap-1">
        <button
          onClick={() => setCurrentSubTab('wallets')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
            currentSubTab === 'wallets' ? 'bg-white text-black font-bold shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Wallet size={14} />
          <span>Wallets ({accountStats.length})</span>
        </button>

        <button
          onClick={() => setCurrentSubTab('recurring')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
            currentSubTab === 'recurring' ? 'bg-white text-black font-bold shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <RefreshCw size={14} />
          <span>Recurring ({state.recurring?.length || 0})</span>
        </button>

        <button
          onClick={() => setCurrentSubTab('debts')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
            currentSubTab === 'debts' ? 'bg-white text-black font-bold shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Users size={14} />
          <span>Borrow & Lend ({state.debts?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Wallets & Asset Distribution */}
      {currentSubTab === 'wallets' && (
        <div className="space-y-6 animate-fade-in">
          {/* Net Worth Hero Card */}
          <div className="bg-gradient-to-br from-[#15151b] via-[#101014] to-[#0c0c0e] rounded-3xl p-7 border border-zinc-900/60 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between text-zinc-400 text-xs font-mono mb-2">
              <span className="flex items-center gap-2 uppercase tracking-widest text-zinc-400 font-semibold">
                <Wallet size={16} /> Total Combined Net Worth
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">{state.accounts.length} Active Accounts</span>
            </div>

            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-white mb-6">
              {formatCurrency(totalNetWorth, state.settings.currencySymbol)}
            </div>

            {/* Portfolio Distribution Segmented Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <PieChart size={13} className="text-zinc-500" />
                  <span>Asset Distribution (%)</span>
                </span>
                <span className="text-[10px] text-zinc-500">100% Total</span>
              </div>

              {/* Segmented Visual Bar */}
              <div className="w-full h-3 rounded-full bg-zinc-900 flex overflow-hidden gap-0.5 p-0.5 border border-zinc-800/80">
                {accountStats.map((acc, idx) => {
                  if (acc.percentage <= 0) return null;
                  const hues = ['bg-white', 'bg-zinc-400', 'bg-zinc-600', 'bg-zinc-700', 'bg-emerald-500'];
                  const bg = hues[idx % hues.length];
                  return (
                    <div
                      key={acc.id}
                      title={`${acc.name}: ${acc.percentage}%`}
                      className={`h-full rounded-xs transition-all ${bg}`}
                      style={{ width: `${acc.percentage}%` }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Account Cards List with Percentage Breakdown */}
          <div className="space-y-3">
            <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase block px-1">
              Account Ledger ({accountStats.length})
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accountStats.map((acc) => {
                const isNegative = (acc.currentBalance ?? 0) < 0;

                return (
                  <div
                    key={acc.id}
                    onClick={() => onSelectAccount(acc)}
                    className="p-5 rounded-2xl bg-[#101014] border border-zinc-900/60 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between group active:scale-98 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors">
                            {acc.type === 'cash' ? <Wallet size={16} /> : <CreditCard size={16} />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-zinc-200 transition-colors">
                              {acc.name}
                            </div>
                            <span className="text-[10px] text-zinc-500 uppercase font-mono">
                              {acc.type}
                            </span>
                          </div>
                        </div>

                        {/* Percentage Pill */}
                        <div className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 font-semibold">
                          {acc.percentage}%
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">Current Balance</div>
                        <div className={`text-xl font-extrabold font-mono mt-0.5 ${
                          isNegative ? 'text-rose-400' : 'text-white'
                        }`}>
                          {formatCurrency(acc.currentBalance ?? 0, state.settings.currencySymbol)}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-zinc-900/80 flex items-center justify-between text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      <span>View isolated ledger</span>
                      <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Recurring & Subscriptions */}
      {currentSubTab === 'recurring' && (
        <div className="animate-fade-in">
          <RecurringManager />
        </div>
      )}

      {/* Tab 3: Borrow & Lend */}
      {currentSubTab === 'debts' && (
        <div className="animate-fade-in">
          <DebtManager />
        </div>
      )}

      {/* Quick Account Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-[#101014] rounded-3xl p-6 border border-zinc-800 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white font-mono">Create New Account</h3>

            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kasikorn Bank, Wallet"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                    Account Type
                  </label>
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as Account['type'])}
                    className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="bank">Bank</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit Card</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                    Initial Balance
                  </label>
                  <input
                    type="number"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
