import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../common/Icons';
import type { DebtItem } from '../../types/finance';

export const DebtManager: React.FC = () => {
  const { state, addDebt, updateDebt, deleteDebt } = useFinance();
  const [showAddModal, setShowAddModal] = useState(false);
  const [personName, setPersonName] = useState('');
  const [type, setType] = useState<'lend' | 'borrow'>('lend');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  const [settleDebtId, setSettleDebtId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState('');

  const debtList = state.debts || [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!personName.trim() || !parsedAmount || parsedAmount <= 0) return;

    addDebt({
      personName: personName.trim(),
      type,
      totalAmount: parsedAmount,
      remainingAmount: parsedAmount,
      dueDate: dueDate || undefined,
      note: note.trim() || undefined,
      status: 'active',
    });

    setPersonName('');
    setAmount('');
    setDueDate('');
    setNote('');
    setShowAddModal(false);
  };

  // Settle or record partial repayment
  const handleRepayment = (debt: DebtItem) => {
    const pay = parseFloat(settleAmount);
    if (!pay || pay <= 0) return;

    const newRemaining = Math.max(0, debt.remainingAmount - pay);
    updateDebt({
      ...debt,
      remainingAmount: newRemaining,
      status: newRemaining === 0 ? 'settled' : 'active',
    });

    setSettleDebtId(null);
    setSettleAmount('');
  };

  // Summaries
  const totalLent = debtList
    .filter((d) => d.type === 'lend' && d.status === 'active')
    .reduce((sum, d) => sum + d.remainingAmount, 0);

  const totalBorrowed = debtList
    .filter((d) => d.type === 'borrow' && d.status === 'active')
    .reduce((sum, d) => sum + d.remainingAmount, 0);

  return (
    <div className="space-y-4">
      {/* Top Banner & Summary */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 uppercase block">
            Borrow & Lend Tracker ({debtList.length})
          </span>
          <p className="text-[11px] text-zinc-500 font-mono">
            Owed to you: <span className="text-emerald-400 font-bold">+{formatCurrency(totalLent, state.settings.currencySymbol)}</span> • 
            You owe: <span className="text-rose-400 font-bold">-{formatCurrency(totalBorrowed, state.settings.currencySymbol)}</span>
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <Plus size={14} strokeWidth={2.8} />
          <span>New Entry</span>
        </button>
      </div>

      {debtList.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#101014] border border-zinc-900/40 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
            <Users size={18} />
          </div>
          <div className="text-xs text-zinc-400 font-medium">No debts or loans tracked</div>
          <p className="text-[10px] text-zinc-600">Track money lent to friends or borrowed amounts with due dates.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {debtList.map((debt) => {
            const isLend = debt.type === 'lend';
            const isSettled = debt.status === 'settled';

            return (
              <div
                key={debt.id}
                className={`p-4 rounded-2xl bg-[#101014] border transition-all flex flex-col justify-between ${
                  isSettled ? 'border-zinc-900/30 opacity-60' : 'border-zinc-900/60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isLend ? 'bg-emerald-950/60 text-emerald-400' : 'bg-rose-950/60 text-rose-400'
                      }`}>
                        {isLend ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{debt.personName}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase font-mono ${
                            isLend ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}>
                            {isLend ? 'Owes You' : 'You Owe'}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {debt.dueDate ? `Due: ${debt.dueDate}` : 'No due date'}
                          {debt.note && ` • ${debt.note}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-sm font-bold font-mono ${
                        isLend ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {isSettled ? 'Settled' : formatCurrency(debt.remainingAmount, state.settings.currencySymbol)}
                      </div>
                      {!isSettled && debt.remainingAmount < debt.totalAmount && (
                        <div className="text-[9px] text-zinc-500 font-mono">
                          orig. {formatCurrency(debt.totalAmount, state.settings.currencySymbol)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Repayment and Action Controls */}
                <div className="pt-3 mt-2 border-t border-zinc-900/60 flex items-center justify-between text-xs">
                  {settleDebtId === debt.id ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                        className="flex-1 bg-[#16161d] rounded-xl px-2.5 py-1 text-xs text-white font-mono focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRepayment(debt)}
                        className="px-2.5 py-1 bg-white text-black font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Repay
                      </button>
                      <button
                        onClick={() => setSettleDebtId(null)}
                        className="text-[10px] text-zinc-500 hover:text-white px-1 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isSettled ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSettleDebtId(debt.id);
                              setSettleAmount(String(debt.remainingAmount));
                            }}
                            className="text-[11px] font-mono text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-xl cursor-pointer"
                          >
                            Record Repayment
                          </button>
                          <button
                            onClick={() => updateDebt({ ...debt, remainingAmount: 0, status: 'settled' })}
                            className="text-[10px] font-mono text-zinc-500 hover:text-emerald-400 cursor-pointer"
                          >
                            Mark Settled
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-500">Fully Settled</span>
                      )}

                      <button
                        onClick={() => deleteDebt(debt.id)}
                        className="text-zinc-600 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                        aria-label="Delete entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Debt / Loan Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-[#101014] rounded-2xl p-6 border border-zinc-800 shadow-2xl space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white font-mono">Track Borrow or Loan</h3>

            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('lend')}
                  className={`py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    type === 'lend' ? 'bg-emerald-500 text-black font-bold' : 'bg-[#16161d] text-zinc-400'
                  }`}
                >
                  I Lent Money
                </button>
                <button
                  type="button"
                  onClick={() => setType('borrow')}
                  className={`py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    type === 'borrow' ? 'bg-rose-500 text-white font-bold' : 'bg-[#16161d] text-zinc-400'
                  }`}
                >
                  I Borrowed Money
                </button>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                  Person Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex, Mom, Landlord"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
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

                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                    Due Date (optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                  Note / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dinner split, emergency ticket"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
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
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
