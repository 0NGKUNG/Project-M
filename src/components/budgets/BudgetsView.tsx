import React, { useState } from 'react';
import { Target, Plus, AlertCircle, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, CategoryIcon } from '../common/Icons';
import { CustomSelect } from '../common/CustomSelect';

export const BudgetsView: React.FC = () => {
  const { state, addBudget, deleteBudget } = useFinance();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState(state.categories[0]?.id || '');
  const [limitAmount, setLimitAmount] = useState('');

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const categorySpending: Record<string, number> = {};
  state.transactions.forEach((tx) => {
    if (tx.type === 'expense' && tx.date.startsWith(currentMonthPrefix)) {
      categorySpending[tx.categoryId] = (categorySpending[tx.categoryId] || 0) + tx.amount;
    }
  });

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(limitAmount);
    if (!val || val <= 0) return;

    addBudget({
      categoryId: selectedCatId,
      amount: val,
      period: 'monthly',
    });

    setLimitAmount('');
    setShowAddForm(false);
  };

  const expenseCategories = state.categories.filter((c) => c.type === 'expense');

  return (
    <div className="space-y-5 pb-24 md:pb-12 safe-top px-4 md:px-8 w-full animate-fade-in">
      <div className="pt-1 flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">Monthly Budgets</h2>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">Limits & dynamic threshold indicators</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white text-black text-xs font-bold hover:bg-zinc-100 transition-all cursor-pointer shadow-lg"
        >
          <Plus size={15} strokeWidth={2.6} /> Add Limit
        </button>
      </div>

      {/* Add Budget Form Card */}
      {showAddForm && (
        <form
          onSubmit={handleCreateBudget}
          className="bg-[#101014] rounded-2xl p-6 space-y-4 animate-fade-in max-w-2xl shadow-xl"
        >
          <div className="text-sm font-bold text-white">Set Monthly Category Limit</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1.5">
                Category
              </label>
              <CustomSelect
                value={selectedCatId}
                onChange={(val) => setSelectedCatId(val)}
                options={expenseCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1.5">
                Limit Amount ({state.settings.currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 350.00"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                className="w-full bg-[#16161d] rounded-2xl px-4 py-3 text-xs text-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs bg-white text-black font-bold hover:bg-zinc-100 cursor-pointer shadow-md"
            >
              Save Budget
            </button>
          </div>
        </form>
      )}

      {/* Budgets List (Grid filling width) */}
      {state.budgets.length === 0 ? (
        <div className="bg-[#101014] rounded-2xl p-12 text-center">
          <Target className="mx-auto text-zinc-600 mb-2" size={28} />
          <p className="text-xs text-zinc-500">No budget limits defined yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.budgets.map((budget) => {
            const catId = budget.categoryId || '';
            const cat = state.categories.find((c) => c.id === catId);
            const spent = categorySpending[catId] || 0;
            const percent = Math.min(Math.round((spent / budget.amount) * 100), 100);
            const isExceeded = spent > budget.amount;
            const remaining = budget.amount - spent;

            return (
              <div
                key={budget.id}
                className="bg-[#101014] hover:bg-[#14141a] rounded-2xl p-5 space-y-3.5 relative transition-all shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-white shrink-0">
                      <CategoryIcon name={cat?.icon || 'Target'} size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{cat?.name || 'Category'}</div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {isExceeded ? (
                          <span className="text-rose-400 flex items-center gap-1 font-semibold">
                            <AlertCircle size={11} /> Over by{' '}
                            {formatCurrency(Math.abs(remaining), state.settings.currencySymbol)}
                          </span>
                        ) : (
                          <span>
                            {formatCurrency(remaining, state.settings.currencySymbol)} left
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-white tabular-nums">
                        {formatCurrency(spent, state.settings.currencySymbol)}
                      </div>
                      <div className="text-[10px] text-zinc-500">of {formatCurrency(budget.amount, state.settings.currencySymbol)}</div>
                    </div>

                    <button
                      onClick={() => deleteBudget(budget.id)}
                      className="p-1.5 text-zinc-600 hover:text-rose-400 active:scale-95 transition-colors cursor-pointer"
                      aria-label="Delete budget"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Minimalist Progress Meter */}
                <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                  <div
                    style={{ width: `${percent}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      isExceeded
                        ? 'bg-rose-500'
                        : percent > 80
                        ? 'bg-amber-400'
                        : 'bg-white'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
