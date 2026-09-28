import React, { useState, useMemo } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { CustomSelect } from '../common/CustomSelect';
import type { Transaction, TransactionType } from '../../types/finance';
import { EditTransactionModal } from './EditTransactionModal';

export const TransactionListView: React.FC = () => {
  const { state, deleteTransaction } = useFinance();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  const filteredTransactions = useMemo(() => {
    return state.transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (selectedAccountId !== 'all' && tx.accountId !== selectedAccountId && tx.toAccountId !== selectedAccountId) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const cat = state.categories.find((c) => c.id === tx.categoryId);
        const query = searchQuery.toLowerCase();
        const matchesNote = tx.note?.toLowerCase().includes(query);
        const matchesCategory = cat?.name.toLowerCase().includes(query);
        const matchesAmount = tx.amount.toString().includes(query);
        if (!matchesNote && !matchesCategory && !matchesAmount) return false;
      }
      return true;
    });
  }, [state.transactions, state.categories, typeFilter, selectedAccountId, searchQuery]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, typeof filteredTransactions> = {};
    filteredTransactions.forEach((tx) => {
      if (!groups[tx.date]) {
        groups[tx.date] = [];
      }
      groups[tx.date].push(tx);
    });
    return Object.entries(groups).sort((a, b) => (a[0] > b[0] ? -1 : 1));
  }, [filteredTransactions]);

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);
  const getAccount = (accId: string) => state.accounts.find((a) => a.id === accId);

  return (
    <div className="space-y-5 pb-24 md:pb-12 safe-top px-4 md:px-8 w-full animate-fade-in">
      {/* Title */}
      <div className="pt-1 flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">Transaction Logs</h2>
        </div>
        <span className="text-xs font-mono text-zinc-300 bg-[#121216] px-3.5 py-1.5 rounded-full">
          {filteredTransactions.length} entries
        </span>
      </div>

      {/* Search & Filter Toolbar (Borderless, floating chips) */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#101014] rounded-2xl py-3 pl-11 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex gap-1 bg-[#101014] p-1 rounded-2xl">
            {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium capitalize whitespace-nowrap transition-colors cursor-pointer ${
                  typeFilter === t
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <CustomSelect
            value={selectedAccountId}
            onChange={(val) => setSelectedAccountId(val)}
            options={[
              { value: 'all', label: 'All Accounts' },
              ...state.accounts.map((acc) => ({
                value: acc.id,
                label: acc.name,
              })),
            ]}
            className="min-w-[130px]"
          />
        </div>
      </div>

      {/* Transaction Feed */}
      {groupedTransactions.length === 0 ? (
        <div className="bg-[#101014] rounded-2xl p-12 text-center mt-4">
          <p className="text-xs text-zinc-500">No matching transactions found.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedTransactions.map(([dateString, txList]) => {
            const isToday = new Date().toISOString().split('T')[0] === dateString;
            const displayDate = isToday ? 'Today' : dateString;

            const dayExpense = txList
              .filter((t) => t.type === 'expense')
              .reduce((sum, t) => sum + t.amount, 0);

            return (
              <div key={dateString} className="space-y-2">
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                    {displayDate}
                  </span>
                  {dayExpense > 0 && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      Day spent: -{formatCurrency(dayExpense, state.settings.currencySymbol)}
                    </span>
                  )}
                </div>

                <div className="bg-[#101014] rounded-2xl divide-y divide-zinc-900 overflow-hidden shadow-sm">
                  {txList.map((tx) => {
                    const cat = getCategory(tx.categoryId);
                    const acc = getAccount(tx.accountId);
                    const toAcc = tx.toAccountId ? getAccount(tx.toAccountId) : null;
                    const isIncome = tx.type === 'income';
                    const isTransfer = tx.type === 'transfer';

                    return (
                      <div
                        key={tx.id}
                        onClick={() => setEditingTransaction(tx)}
                        className="p-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors group cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                              isIncome
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : isTransfer
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-zinc-800/80 text-zinc-200'
                            }`}
                          >
                            <CategoryIcon name={cat?.icon || 'Receipt'} size={18} />
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-2">
                              <span>
                                {isTransfer
                                  ? `${acc?.name} → ${toAcc?.name}`
                                  : cat?.name || 'Other'}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1.5">
                              {!isTransfer && <span>{acc?.name}</span>}
                              {tx.time && <span>• {tx.time}</span>}
                              {tx.note && <span>• {tx.note}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right font-mono">
                            <div
                              className={`text-xs sm:text-sm font-bold tabular-nums ${
                                isIncome
                                  ? 'text-emerald-400'
                                  : isTransfer
                                  ? 'text-blue-400'
                                  : 'text-white'
                              }`}
                            >
                              {isIncome ? '+' : isTransfer ? '' : '-'}
                              {formatCurrency(tx.amount, state.settings.currencySymbol)}
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTransaction(tx.id);
                            }}
                            className="p-2 text-zinc-600 hover:text-rose-400 active:scale-95 transition-colors cursor-pointer"
                            aria-label="Delete entry"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransactionModal
          key={editingTransaction.id}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
};
