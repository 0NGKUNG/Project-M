import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  RefreshCw, 
  Plus, 
  Trash2, 
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { CustomSelect } from '../common/CustomSelect';
import { CurrencyInput, parseFormattedNumber } from '../common/CurrencyInput';
import type { RecurringItem } from '../../types/finance';
import { useBackButton } from '../../hooks/useBackButton';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function computeNextDue(
  frequency: RecurringItem['frequency'],
  repeatEvery: number,
  dayOfWeek: number,
  dayOfMonth: number | 'last',
  monthOfYear: number,
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (frequency === 'daily') {
    const d = new Date(today);
    d.setDate(d.getDate() + repeatEvery);
    return d.toISOString().split('T')[0];
  }

  if (frequency === 'weekly') {
    const d = new Date(today);
    let diff = (dayOfWeek - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7 * repeatEvery;
    else diff += 7 * (repeatEvery - 1);
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  if (frequency === 'monthly') {
    const getDay = (year: number, month: number) =>
      dayOfMonth === 'last'
        ? new Date(year, month + 1, 0).getDate()
        : (dayOfMonth as number);
    let d = new Date(today.getFullYear(), today.getMonth(), getDay(today.getFullYear(), today.getMonth()));
    if (d <= today) d = new Date(today.getFullYear(), today.getMonth() + repeatEvery, getDay(today.getFullYear(), today.getMonth() + repeatEvery));
    return d.toISOString().split('T')[0];
  }

  if (frequency === 'yearly') {
    const getDay = (year: number) =>
      dayOfMonth === 'last'
        ? new Date(year, monthOfYear + 1, 0).getDate()
        : (dayOfMonth as number);
    let d = new Date(today.getFullYear(), monthOfYear, getDay(today.getFullYear()));
    if (d <= today) d = new Date(today.getFullYear() + repeatEvery, monthOfYear, getDay(today.getFullYear() + repeatEvery));
    return d.toISOString().split('T')[0];
  }

  return today.toISOString().split('T')[0];
}

export interface RecurringManagerProps {
  onBack?: () => void;
}

export const RecurringManager: React.FC<RecurringManagerProps> = ({ onBack }) => {
  const { state, addRecurring, updateRecurring, deleteRecurring } = useFinance();
  const [showAddModal, setShowAddModal] = useState(false);
  useBackButton(showAddModal, () => setShowAddModal(false));
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [frequency, setFrequency] = useState<RecurringItem['frequency']>('monthly');
  const [repeatEvery, setRepeatEvery] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(new Date().getDay());
  const [dayOfMonth, setDayOfMonth] = useState<number | 'last'>(new Date().getDate());
  const [monthOfYear, setMonthOfYear] = useState(new Date().getMonth());

  const recurringList = state.recurring || [];

  const resetForm = () => {
    setName('');
    setAmount('');
    setType('expense');
    setCategoryId('');
    setAccountId('');
    setFrequency('monthly');
    setRepeatEvery(1);
    setDayOfWeek(new Date().getDay());
    setDayOfMonth(new Date().getDate());
    setMonthOfYear(new Date().getMonth());
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFormattedNumber(amount);
    if (!name.trim() || !parsedAmount || parsedAmount <= 0) return;

    const nextDueDate = computeNextDue(frequency, repeatEvery, dayOfWeek, dayOfMonth, monthOfYear);

    addRecurring({
      name: name.trim(),
      type,
      amount: parsedAmount,
      categoryId: categoryId || state.categories.find(c => c.type === type)?.id || '',
      accountId: accountId || state.accounts[0]?.id || '',
      frequency,
      nextDueDate,
      isActive: true,
    });

    resetForm();
    setShowAddModal(false);
  };

  const getCategory = (catId: string) => state.categories.find((c) => c.id === catId);
  const getAccount = (accId: string) => state.accounts.find((a) => a.id === accId);

  const freqLabel = useCallback(() => {
    const unit = frequency === 'daily' ? (repeatEvery === 1 ? 'day' : 'days')
      : frequency === 'weekly' ? (repeatEvery === 1 ? 'week' : 'weeks')
      : frequency === 'monthly' ? (repeatEvery === 1 ? 'month' : 'months')
      : (repeatEvery === 1 ? 'year' : 'years');
    return `Every ${repeatEvery} ${unit}`;
  }, [frequency, repeatEvery]);

  return (
    <div className="space-y-3 animate-fade-in min-h-full flex flex-col flex-1">
      {/* Header */}
      <div className="h-8 flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="hidden sm:flex w-8 h-8 rounded-xl bg-zinc-900 items-center justify-center text-zinc-300 cursor-pointer hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <span className="text-xl font-bold tracking-tight text-white font-mono uppercase block">
            RECURRING ({recurringList.length})
          </span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <Plus size={13} strokeWidth={2.8} />
          New
        </button>
      </div>

      {recurringList.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#101014] border border-zinc-900/60 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
            <RefreshCw size={18} />
          </div>
          <div className="text-xs text-zinc-400 font-medium">No recurring items yet</div>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold cursor-pointer"
          >
            <Plus size={13} /> New Recurring
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:flex-1 lg:content-start">
          {recurringList.map((item) => {
            const cat = getCategory(item.categoryId);
            const acc = getAccount(item.accountId);
            const isExpense = item.type === 'expense';

            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl bg-[#101014] border transition-all flex flex-col justify-between group active:scale-98 shadow-sm hover:border-zinc-700 ${
                  item.isActive ? 'border-zinc-900/60' : 'border-zinc-900/30 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors shrink-0">
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
                          {acc?.name || 'Account'} • Due: {item.nextDueDate}
                        </div>
                      </div>
                    </div>
                    <div className={`text-sm font-bold font-mono ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isExpense ? '-' : '+'}{formatCurrency(item.amount, state.settings.currencySymbol)}
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
      {showAddModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
            onClick={() => { resetForm(); setShowAddModal(false); }}
          >
            <div
              className="w-full sm:max-w-xl md:max-w-2xl max-h-[85dvh] bg-[#0c0c10] border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center px-4 sm:px-6 pt-4 pb-3 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <RefreshCw size={16} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-mono">New Recurring Item</h3>
                </div>
              </div>

              <form onSubmit={handleCreate} className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* 2-Column Grid on md+ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="md:col-span-2">
                    <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Netflix, Rent, Salary"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-11 bg-[#16161d] rounded-xl px-3.5 text-xs text-white focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                      autoFocus
                      required
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">Type</label>
                    <CustomSelect
                      value={type}
                      onChange={(val) => setType(val as 'expense' | 'income')}
                      options={[
                        { value: 'expense', label: 'Expense' },
                        { value: 'income', label: 'Income' },
                      ]}
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">Amount</label>
                    <CurrencyInput
                      currencySymbol={state.settings.currencySymbol}
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full h-11 bg-[#16161d] rounded-xl px-3.5 text-xs text-white font-mono focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                      required
                    />
                  </div>

                  {/* Account */}
                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">Account</label>
                    <CustomSelect
                      value={accountId || state.accounts[0]?.id || ''}
                      onChange={(val) => setAccountId(val)}
                      options={state.accounts.map((a) => ({ value: a.id, label: a.name }))}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">Category</label>
                    <CustomSelect
                      value={categoryId || state.categories.filter((c) => c.type === type)[0]?.id || ''}
                      onChange={(val) => setCategoryId(val)}
                      options={state.categories.filter((c) => c.type === type).map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                </div>

                {/* ─── Frequency Picker ─── */}
                <div>
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">Repeat</label>

                  {/* Tabs */}
                  <div className="bg-[#16161d] rounded-xl p-1 flex gap-1 border border-zinc-800/60 mb-3">
                    {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => { setFrequency(f); setRepeatEvery(1); }}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-mono font-medium transition-all cursor-pointer ${
                          frequency === f ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {f === 'daily' ? 'Day' : f === 'weekly' ? 'Week' : f === 'monthly' ? 'Month' : 'Year'}
                      </button>
                    ))}
                  </div>

                  {/* Weekly: day-of-week grid */}
                  {frequency === 'weekly' && (
                    <div className="grid grid-cols-7 gap-1 mb-3">
                      {DAY_LABELS.map((day, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setDayOfWeek(i)}
                          className={`py-2 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            dayOfWeek === i
                              ? 'bg-white text-black'
                              : 'bg-[#16161d] text-zinc-400 border border-zinc-800/60 hover:border-zinc-600'
                          }`}
                        >
                          {day.slice(0, 2)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Monthly / Yearly: day-of-month grid */}
                  {(frequency === 'monthly' || frequency === 'yearly') && (
                    <>
                      {/* Yearly: month picker */}
                      {frequency === 'yearly' && (
                        <div className="grid grid-cols-4 gap-1 mb-2">
                          {MONTH_LABELS.map((m, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setMonthOfYear(i)}
                              className={`py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                monthOfYear === i
                                  ? 'bg-white text-black'
                                  : 'bg-[#16161d] text-zinc-400 border border-zinc-800/60 hover:border-zinc-600'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Day-of-month grid */}
                      <div className="grid grid-cols-7 gap-1 mb-3">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDayOfMonth(d)}
                            className={`py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              dayOfMonth === d
                                ? 'bg-white text-black'
                                : 'bg-[#16161d] text-zinc-400 border border-zinc-800/60 hover:border-zinc-600'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setDayOfMonth('last')}
                          className={`col-span-3 py-1.5 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            dayOfMonth === 'last'
                              ? 'bg-white text-black'
                              : 'bg-[#16161d] text-zinc-400 border border-zinc-800/60 hover:border-zinc-600'
                          }`}
                        >
                          End of month
                        </button>
                      </div>
                    </>
                  )}

                  {/* Interval +/- */}
                  <div className="flex items-center gap-2 bg-[#16161d] rounded-xl border border-zinc-800/60 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setRepeatEvery(Math.max(1, repeatEvery - 1))}
                      className="w-7 h-7 rounded-lg bg-zinc-800 text-white flex items-center justify-center text-base font-bold cursor-pointer hover:bg-zinc-700 transition-colors shrink-0"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-xs font-mono text-white">{freqLabel()}</span>
                    <button
                      type="button"
                      onClick={() => setRepeatEvery(repeatEvery + 1)}
                      className="w-7 h-7 rounded-lg bg-zinc-800 text-white flex items-center justify-center text-base font-bold cursor-pointer hover:bg-zinc-700 transition-colors shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>

                </div>

                {/* Actions (Sticky bottom bar) */}
                <div className="p-4 sm:px-6 border-t border-zinc-800/80 bg-[#0c0c10] shrink-0 safe-bottom">
                  <button
                    type="submit"
                    className="w-full py-3 bg-white text-black text-xs font-bold font-mono rounded-full cursor-pointer active:scale-[0.98] hover:bg-zinc-200 transition-all shadow-md"
                  >
                    Save Item
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
