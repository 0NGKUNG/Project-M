import React, { useState } from 'react';
import { 
  Wallet, 
  Plus, 
  RefreshCw,
  Users,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../common/Icons';
import { CustomSelect } from '../common/CustomSelect';
import type { Account } from '../../types/finance';
import { RecurringManager } from '../recurring/RecurringManager';
import { DebtManager } from '../debts/DebtManager';
import { useBackButton } from '../../hooks/useBackButton';

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

  useBackButton(Boolean(showAddModal || currentSubTab !== 'wallets'), () => {
    if (showAddModal) setShowAddModal(false);
    else if (currentSubTab !== 'wallets') setCurrentSubTab('wallets');
  });

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
    <div className="space-y-3 pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono">ACCOUNTS</h2>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-[0_2px_12px_rgba(255,255,255,0.12)] shrink-0"
        >
          <Plus size={14} strokeWidth={2.8} />
          <span>New</span>
        </button>
      </div>

      {/* View Sub-tabs: Wallets, Recurring, Debts - clean compact single line */}
      <div className="flex bg-[#101014] p-1 rounded-2xl border border-zinc-900 gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setCurrentSubTab('wallets')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            currentSubTab === 'wallets' ? 'bg-white text-black font-bold shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Wallet size={13} />
          <span>Wallets ({accountStats.length})</span>
        </button>

        <button
          onClick={() => setCurrentSubTab('recurring')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            currentSubTab === 'recurring' ? 'bg-white text-black font-bold shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <RefreshCw size={13} />
          <span>Recurring ({state.recurring?.length || 0})</span>
        </button>

        <button
          onClick={() => setCurrentSubTab('debts')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            currentSubTab === 'debts' ? 'bg-white text-black font-bold shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Users size={13} />
          <span>Debts ({state.debts?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Wallets & Asset Distribution */}
      {currentSubTab === 'wallets' && (
        <div className="space-y-3 animate-fade-in">
          {/* Net Worth Hero Card */}
          <div className="bg-gradient-to-br from-[#15151b] via-[#101014] to-[#0c0c0e] rounded-2xl p-7 border border-zinc-900/60 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center text-zinc-400 text-xs font-mono mb-2">
              <span className="flex items-center gap-2 uppercase tracking-widest text-zinc-400 font-semibold">
                <Wallet size={16} /> Total Combined Net Worth
              </span>
            </div>

            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-white mb-6">
              {formatCurrency(totalNetWorth, state.settings.currencySymbol)}
            </div>

            {/* Portfolio Distribution Segmented Bar & Individual Account Progress Bars */}
            <div className="space-y-4">
              {/* Individual Account Progress Bars List: a ----- 50%, b ---- 30% */}
              <div className="space-y-2.5">
                {accountStats.map((acc, idx) => {
                  const dotColors = [
                    'bg-white',
                    'bg-zinc-300',
                    'bg-zinc-500',
                    'bg-zinc-600',
                    'bg-zinc-700',
                    'bg-zinc-800',
                  ];
                  const barBg = dotColors[idx % dotColors.length];

                  return (
                    <div 
                      key={acc.id} 
                      onClick={() => onSelectAccount(acc)}
                      className="space-y-1 p-1.5 -mx-1.5 rounded-xl hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${barBg} shrink-0`} />
                          <span className="text-zinc-300 font-semibold truncate group-hover:text-white transition-colors">{acc.name}</span>
                          <span className="text-[10px] text-zinc-500 uppercase font-mono">({acc.type})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {formatCurrency(acc.currentBalance ?? 0, state.settings.currencySymbol)}
                          </span>
                          <span className="text-xs font-bold text-white font-mono w-10 text-right">
                            {acc.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Horizontal progress track */}
                      <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barBg}`}
                          style={{ width: `${Math.max(2, acc.percentage)}%` }}
                        />
                      </div>
                    </div>
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

            {/* Compact 2-per-row card grid on mobile and desktop */}
            {/* Bank Card / Folder Style 2-per-row grid on mobile and desktop */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {accountStats.map((acc, index) => {
                const isNegative = (acc.currentBalance ?? 0) < 0;
                // Subtle gradient accent variations for realistic card/folder look
                const cardGradients = [
                  'from-[#191924] via-[#14141c] to-[#0e0e14] border-zinc-800/90',
                  'from-[#1a1c24] via-[#14161c] to-[#0e0e14] border-zinc-800/90',
                  'from-[#1e1a24] via-[#16141c] to-[#0e0e14] border-zinc-800/90',
                  'from-[#181a20] via-[#13151a] to-[#0e0e14] border-zinc-800/90',
                ];
                const gradientClass = cardGradients[index % cardGradients.length];

                return (
                  <div
                    key={acc.id}
                    onClick={() => onSelectAccount(acc)}
                    className={`relative p-4 rounded-2xl bg-linear-to-br ${gradientClass} border hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between min-h-[110px] active:scale-[0.98] shadow-lg group overflow-hidden`}
                  >
                    {/* Subtle sheen accent */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.025] rounded-full blur-xl pointer-events-none -mr-6 -mt-6" />

                    {/* Top: Account name */}
                    <div className="relative z-10">
                      <div className="text-[12px] font-bold text-zinc-300 group-hover:text-white transition-colors truncate leading-tight">
                        {acc.name}
                      </div>
                    </div>

                    {/* Bottom-right: Balance label + value */}
                    <div className="relative z-10 flex flex-col items-end mt-3">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">
                        Balance
                      </div>
                      <div className={`text-sm sm:text-base font-extrabold font-mono tracking-tight truncate ${isNegative ? 'text-rose-400' : 'text-white'}`}>
                        {formatCurrency(acc.currentBalance ?? 0, state.settings.currencySymbol)}
                      </div>
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
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#101014] rounded-2xl p-6 border border-zinc-800 shadow-2xl space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
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
                  className="w-full h-11 bg-[#16161d] rounded-xl px-3.5 text-xs text-white focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                    Account Type
                  </label>
                  <CustomSelect
                    value={newAccType}
                    onChange={(val) => setNewAccType(val as Account['type'])}
                    options={[
                      { value: 'bank', label: 'Bank' },
                      { value: 'cash', label: 'Cash' },
                      { value: 'credit', label: 'Credit Card' },
                      { value: 'savings', label: 'Savings' },
                      { value: 'investment', label: 'Investment' },
                    ]}
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                    Initial Balance
                  </label>
                  <input
                    type="number"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full h-11 bg-[#16161d] rounded-xl px-3.5 text-xs text-white font-mono focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
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
