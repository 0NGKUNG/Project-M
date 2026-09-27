import React, { useState } from 'react';
import { X, Trash2, Check, ArrowRightLeft, ArrowDownRight, ArrowUpRight, Calendar, Clock } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import type { Transaction, TransactionType } from '../../types/finance';
import { CategoryIcon } from '../common/Icons';
import { CustomSelect } from '../common/CustomSelect';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

const getCurrentTimeStr = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  onClose,
}) => {
  const { state, updateTransaction, deleteTransaction, triggerHaptic } = useFinance();

  if (!transaction) return null;

  const [type, setType] = useState<TransactionType>(transaction.type);
  const [amountStr, setAmountStr] = useState<string>(String(transaction.amount));
  const [categoryId, setCategoryId] = useState<string>(transaction.categoryId);
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>(transaction.subcategoryId);
  const [accountId, setAccountId] = useState<string>(transaction.accountId);
  const [toAccountId, setToAccountId] = useState<string | undefined>(transaction.toAccountId);
  const [date, setDate] = useState<string>(transaction.date);
  const [time, setTime] = useState<string>(transaction.time || getCurrentTimeStr());
  const [note, setNote] = useState<string>(transaction.note || '');

  const parentCategories = state.categories.filter(
    (c) => !c.parentId && c.type === (type === 'income' ? 'income' : 'expense')
  );

  const availableSubcategories = state.categories.filter(
    (c) => c.parentId === categoryId
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amountStr);
    if (!parsedAmount || parsedAmount <= 0) return;

    updateTransaction({
      ...transaction,
      type,
      amount: parsedAmount,
      categoryId: type === 'transfer' ? 'transfer' : categoryId,
      subcategoryId: type === 'transfer' ? undefined : subcategoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      date,
      time: time || undefined,
      note: note.trim() || undefined,
    });

    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Delete this transaction?')) {
      deleteTransaction(transaction.id);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#101014] rounded-3xl p-6 border border-zinc-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white font-mono">Edit Transaction</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Transaction Type Tabs */}
          <div className="flex bg-[#16161d] p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setType('expense');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'expense' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowDownRight size={14} className={type === 'expense' ? 'text-rose-400' : ''} />
              Expense
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setType('income');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'income' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowUpRight size={14} className={type === 'income' ? 'text-emerald-400' : ''} />
              Income
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setType('transfer');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'transfer' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowRightLeft size={14} className={type === 'transfer' ? 'text-blue-400' : ''} />
              Transfer
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
              Amount ({state.settings.currencySymbol})
            </label>
            <input
              type="number"
              step="any"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none"
              required
            />
          </div>

          {/* Custom Date & Time Selectors */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 bg-[#16161d] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-zinc-400 shrink-0" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[8px] font-mono uppercase text-zinc-500">Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none w-full font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#16161d] rounded-xl px-3 py-2">
              <Clock size={14} className="text-zinc-400 shrink-0" />
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-mono uppercase text-zinc-500">Time</span>
                  <button
                    type="button"
                    onClick={() => setTime(getCurrentTimeStr())}
                    className="text-[8px] text-zinc-400 hover:text-white font-mono cursor-pointer"
                  >
                    Now
                  </button>
                </div>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none w-full font-mono"
                />
              </div>
            </div>
          </div>

          {/* Account Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                {type === 'transfer' ? 'Source Account' : 'Account'}
              </label>
              <CustomSelect
                value={accountId}
                onChange={(val) => setAccountId(val)}
                options={state.accounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
              />
            </div>

            {type === 'transfer' && (
              <div>
                <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                  Destination Account
                </label>
                <CustomSelect
                  value={toAccountId || state.accounts.find((a) => a.id !== accountId)?.id || ''}
                  onChange={(val) => setToAccountId(val)}
                  options={state.accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => ({
                      value: a.id,
                      label: a.name,
                    }))}
                />
              </div>
            )}
          </div>

          {/* Categories Grid (if not transfer) */}
          {type !== 'transfer' && (
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block">
                Category
              </label>
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                {parentCategories.map((cat) => {
                  const isSelected = categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setCategoryId(cat.id);
                        setSubcategoryId(undefined);
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-200 text-black shadow-sm font-semibold'
                          : 'bg-[#16161d] text-zinc-400 hover:bg-[#202028] hover:text-white'
                      }`}
                    >
                      <div className="mb-1">
                        <CategoryIcon name={cat.icon} size={15} />
                      </div>
                      <span className="text-[10px] truncate max-w-full">{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Subcategories (if any) */}
              {availableSubcategories.length > 0 && (
                <div className="pt-1 space-y-1">
                  <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider block">
                    Subcategory (optional)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSubcategoryId(undefined);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-mono cursor-pointer transition-all ${
                        subcategoryId === undefined
                          ? 'bg-white text-black font-bold'
                          : 'bg-[#16161d] text-zinc-400 hover:text-white'
                      }`}
                    >
                      General
                    </button>
                    {availableSubcategories.map((sub) => {
                      const isSubSelected = subcategoryId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setSubcategoryId(sub.id);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-mono cursor-pointer transition-all ${
                            isSubSelected
                              ? 'bg-white text-black font-bold'
                              : 'bg-[#16161d] text-zinc-400 hover:text-white'
                          }`}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
              Note
            </label>
            <input
              type="text"
              placeholder="e.g. Lunch with team"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-900">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer p-1"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-black font-bold text-xs rounded-xl cursor-pointer shadow-md hover:bg-zinc-200 transition-all"
              >
                <Check size={14} strokeWidth={2.8} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
