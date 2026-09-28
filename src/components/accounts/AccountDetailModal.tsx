import React, { useState } from 'react';
import { X, CreditCard, TrendingUp, TrendingDown, Edit2, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
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

  if (!account) return null;

  const currentBalance = accountBalances[account.id] ?? account.initialBalance;

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
      initialBalance: parseFloat(editBalance) || 0,
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

  // Transactions belonging to this account
  const accountTransactions = state.transactions.filter(
    (t) => t.accountId === account.id || t.toAccountId === account.id
  );

  // Calculate total in & out for this account
  let totalIn = 0;
  let totalOut = 0;
  accountTransactions.forEach((t) => {
    if (t.accountId === account.id && t.type === 'expense') totalOut += t.amount;
    if (t.accountId === account.id && t.type === 'income') totalIn += t.amount;
    if (t.type === 'transfer') {
      if (t.accountId === account.id) totalOut += t.amount;
      if (t.toAccountId === account.id) totalIn += t.amount;
    }
  });

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#0e0e12] border-t sm:border border-zinc-800 sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl safe-bottom cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-white">
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
              <Edit2 size={16} />
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              title="Delete Account"
              className="p-2 rounded-full bg-zinc-800/80 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Balance & Stats Card */}
        <div className="px-6 py-3">
          <div className="bg-[#14141a] rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Current Available Balance
              </div>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-white mt-1 tabular-nums">
                {formatCurrency(currentBalance, state.settings.currencySymbol)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-mono">Total In</div>
                  <div className="text-xs font-mono font-bold text-white tabular-nums">
                    +{formatCurrency(totalIn, state.settings.currencySymbol)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
                  <TrendingDown size={16} />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-mono">Total Out</div>
                  <div className="text-xs font-mono font-bold text-white tabular-nums">
                    -{formatCurrency(totalOut, state.settings.currencySymbol)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="px-6 py-2">
          <button
            onClick={() => {
              onClose();
              onOpenQuickAddWithAccount(account.id);
            }}
            className="w-full py-3 rounded-2xl bg-white hover:bg-zinc-100 active:scale-98 text-black text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <span>+ Add Transaction To This Account</span>
          </button>
        </div>

        {/* Account History List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
          <div className="text-xs font-mono uppercase font-semibold tracking-wider text-zinc-400">
            Account History ({accountTransactions.length})
          </div>

          {accountTransactions.length === 0 ? (
            <div className="bg-[#121216] rounded-2xl p-8 text-center text-xs text-zinc-500">
              No transactions recorded for this account yet.
            </div>
          ) : (
            <div className="bg-[#121216] rounded-2xl divide-y divide-zinc-900 overflow-hidden">
              {accountTransactions.map((tx) => {
                const isIncoming = tx.type === 'income' || (tx.type === 'transfer' && tx.toAccountId === account.id);
                const cat = getCategory(tx.categoryId);

                return (
                  <div
                    key={tx.id}
                    onClick={() => setEditingTransaction(tx)}
                    className="p-3.5 flex items-center justify-between hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncoming ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        <CategoryIcon name={cat?.icon || 'Receipt'} size={17} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-zinc-200">
                          {tx.type === 'transfer' ? 'Transfer' : (cat?.name || 'Other')}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {tx.date} {tx.time && `• ${tx.time}`} {tx.note && `• ${tx.note}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono font-bold text-xs tabular-nums">
                      <span className={isIncoming ? 'text-emerald-400' : 'text-white'}>
                        {isIncoming ? '+' : '-'}{formatCurrency(tx.amount, state.settings.currencySymbol)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Edit / Delete Transaction Modal */}
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />

        {/* Edit Account Modal */}
        {isEditingAccount && (
          <div 
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-fade-in cursor-pointer"
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
                  <input
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
    </div>
  );
};
