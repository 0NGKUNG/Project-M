import React, { useState } from 'react';
import { 
  RefreshCw, 
  Plus, 
  Trash2, 
  CheckCircle2
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import type { RecurringItem } from '../../types/finance';

export const RecurringManager: React.FC = () => {
  const { state, addRecurring, updateRecurring, deleteRecurring } = useFinance();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [frequency, setFrequency] = useState<RecurringItem['frequency']>('monthly');
  const [nextDueDate, setNextDueDate] = useState(() => new Date().toISOString().split('T')[0]);

  const recurringList = state.recurring || [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!name.trim() || !parsedAmount || parsedAmount <= 0) return;

    addRecurring({
      name: name.trim(),
      type,
      amount: parsedAmount,
      categoryId: categoryId || state.categories[0]?.id || '',
      accountId: accountId || state.accounts[0]?.id || '',
      frequency,
      nextDueDate,
      isActive: true,
    });

    setName('');
    setAmount('');
    setShowAddModal(false);
  };

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);
  const getAccount = (accId: string) => state.accounts.find((a) => a.id === accId);

  // Total monthly commitment
  const totalMonthlyCommitment = recurringList.reduce((sum, item) => {
    if (!item.isActive || item.type !== 'expense') return sum;
    let factor = 1;
    if (item.frequency === 'daily') factor = 30;
    if (item.frequency === 'weekly') factor = 4.33;
    if (item.frequency === 'yearly') factor = 1 / 12;
    return sum + item.amount * factor;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Top Banner & Summary */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase block">
            Recurring & Subscriptions ({recurringList.length})
          </span>
          <p className="text-[11px] text-zinc-500 font-mono">
            Est. Monthly Outflow: ~{formatCurrency(totalMonthlyCommitment, state.settings.currencySymbol)}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <Plus size={14} strokeWidth={2.8} />
          <span>New Recurring</span>
        </button>
      </div>

      {recurringList.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#101014] border border-zinc-900/40 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
            <RefreshCw size={18} />
          </div>
          <div className="text-xs text-zinc-400 font-medium">No recurring items yet</div>
          <p className="text-[10px] text-zinc-600">Track rent, Spotify, Netflix, gym memberships, or routine income.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recurringList.map((item) => {
            const cat = getCategory(item.categoryId);
            const acc = getAccount(item.accountId);
            const isExpense = item.type === 'expense';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl bg-[#101014] border transition-all flex flex-col justify-between ${
                  item.isActive ? 'border-zinc-900/60' : 'border-zinc-900/30 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300">
                        <CategoryIcon name={cat?.icon || 'Repeat'} size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{item.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 uppercase font-mono">
                            {item.frequency}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {acc?.name || 'Wallet'} • Due: {item.nextDueDate}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-sm font-bold font-mono ${
                        isExpense ? 'text-white' : 'text-emerald-400'
                      }`}>
                        {isExpense ? '-' : '+'}{formatCurrency(item.amount, state.settings.currencySymbol)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-2 border-t border-zinc-900/60 flex items-center justify-between text-xs">
                  <button
                    onClick={() => updateRecurring({ ...item, isActive: !item.isActive })}
                    className={`flex items-center gap-1.5 text-[11px] font-mono cursor-pointer ${
                      item.isActive ? 'text-emerald-400' : 'text-zinc-600'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>{item.isActive ? 'Active' : 'Paused'}</span>
                  </button>

                  <button
                    onClick={() => deleteRecurring(item.id)}
                    className="text-zinc-600 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                    aria-label="Delete recurring item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Recurring Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#101014] rounded-3xl p-6 border border-zinc-800 shadow-2xl space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white font-mono">Add Recurring Transaction</h3>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, Rent, Salary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'expense' | 'income')}
                    className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurringItem['frequency'])}
                    className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                    Wallet / Account
                  </label>
                  <select
                    value={accountId || state.accounts[0]?.id}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {state.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                    Category
                  </label>
                  <select
                    value={categoryId || state.categories.filter((c) => c.type === type)[0]?.id}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {state.categories
                      .filter((c) => c.type === type)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
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
                  Save Recurring
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
