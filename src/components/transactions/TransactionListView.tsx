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
    <div className="space-y-5 pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 safe-top px-4 md:px-8 w-full animate-fade-in">
      {/* Title — same header pattern as other pages */}
      <div className="h-8 flex items-center justify-between pt-1">
        <h2 className="text-xl font-bold tracking-tight text-white font-mono">TRANSACTIONS</h2>
        <span className="text-[10px] font-mono font-bold text-zinc-400 bg-[#101014] border border-zinc-900 px-2.5 py-1 rounded-xl">
          {filteredTransactions.length}
        </span>
      </div>

      {/* Search & Filter Toolbar (Borderless, floating chips) */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Search by note, category, or amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-[#101014] border border-zinc-900/60 rounded-xl pl-10 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
          <div className="flex gap-1 bg-[#101014] p-1 rounded-2xl overflow-x-auto no-scrollbar shrink-0">
            {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium capitalize whitespace-nowrap transition-all cursor-pointer ${
                  typeFilter === t
                    ? 'bg-white text-black font-bold shadow-sm'
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
            className="min-w-[130px] flex-1 sm:flex-initial"
          />
        </div>
      </div>

      {/* Transaction Feed */}
      {groupedTransactions.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#101014] border border-zinc-900/60 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600">
            <Search size={18} />
          </div>
          <div className="text-xs text-zinc-400 font-medium">No matching transactions</div>
          <p className="text-[10px] text-zinc-600">Try a different search or filter.</p>
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
                <div className="sticky top-0 z-10 bg-[#060608]/90 backdrop-blur-md py-1.5 flex items-center justify-between px-2">
                  <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                    {displayDate}
                  </span>
                  {dayExpense > 0 && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      Day spent: -{formatCurrency(dayExpense, state.settings.currencySymbol)}
                    </span>
                  )}
                </div>


                <div className="bg-[#101014] rounded-2xl border border-zinc-900/60 divide-y divide-zinc-900/60 overflow-hidden shadow-sm">
                    {txList.map((tx) => {
                      const cat = getCategory(tx.categoryId);
                      const acc = getAccount(tx.accountId);
                      const toAcc = tx.toAccountId ? getAccount(tx.toAccountId) : null;
                      const isIncome = tx.type === 'income';
                      const isTransfer = tx.type === 'transfer';

                      const timeDisplay = tx.time || (tx.createdAt ? (() => {
                        const d = new Date(tx.createdAt);
                        return !isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
                      })() : '');

                      return (
                        <div
                          key={tx.id}
                          onClick={() => setEditingTransaction(tx)}
                          className="p-2 sm:p-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors group cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div
                              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                isIncome
                                  ? 'bg-emerald-950/60 text-emerald-400 group-hover:text-emerald-300'
                                  : isTransfer
                                  ? 'bg-blue-950/60 text-blue-400 group-hover:text-blue-300'
                                  : 'bg-zinc-900 text-zinc-300 group-hover:text-white'
                              }`}
                            >
                              <CategoryIcon name={cat?.icon || 'Receipt'} size={13} className="sm:w-4 sm:h-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="text-[11px] sm:text-xs font-bold text-white truncate">
                                {isTransfer
                                  ? `${acc?.name || 'Account'} → ${toAcc?.name || 'Account'}`
                                  : cat?.name || 'Other'}
                              </div>
                              <div className="text-[9px] sm:text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1 truncate">
                                {timeDisplay && <span className="text-zinc-400 font-bold">{timeDisplay}</span>}
                                {!isTransfer && <span className="truncate">• {acc?.name || 'Account'}</span>}
                                {tx.note && <span className="truncate">• {tx.note}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="text-right font-mono">
                              <div
                                className={`text-[11px] sm:text-xs font-bold tabular-nums ${
                                  isIncome
                                    ? 'text-emerald-400'
                                    : isTransfer
                                    ? 'text-blue-400'
                                    : 'text-rose-400'
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
                              className="p-1 text-zinc-700 hover:text-rose-400 active:scale-95 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 sm:opacity-100"
                              aria-label="Delete entry"
                            >
                              <Trash2 size={12} />
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
