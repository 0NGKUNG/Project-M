import type { Transaction, Budget, BudgetCategoryAllocation } from '../types/finance';

/** Local-midnight timestamp for a YYYY-MM-DD string (no UTC shift). */
function parseLocalDate(dateStr: string): Date | null {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export interface BudgetWindow {
  start: Date; // local midnight
  end: Date;   // local end-of-day
}

/**
 * The budget's active window — for recurring budgets this is the CURRENT
 * period (this week starting Monday / this month starting the 1st), so
 * "spent" resets automatically when a new period begins.
 */
export function getBudgetWindow(budget: Budget): BudgetWindow {
  const now = new Date();
  // Every period auto-resets: weekly → this week, monthly → this month, daily → today.
  if (budget.period === 'weekly') {
    // Week starts Monday (matches the app's weekStartDay default)
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (budget.period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  // daily or fixed-range: use stored dates if present, else today
  const start = parseLocalDate(budget.startDate || '') || new Date(0);
  const end = parseLocalDate(budget.endDate || '');
  if (end) end.setHours(23, 59, 59, 999);
  return { start, end: end || new Date(8640000000000000) };
}

/**
 * Single source of truth for budget progress math.
 *
 * Used by the budgets page and any other budget UI so every screen
 * shows the same numbers for the same `state.budgets` data. No per-view duplicates.
 */
export function getBudgetSpending(
  budget: Budget,
  transactions: Transaction[]
): { totalSpent: number; categorySpent: Record<string, number> } {
  const { start, end } = getBudgetWindow(budget);

  const relevantTxs = transactions.filter((tx) => {
    if (tx.type !== 'expense') return false;
    const txDate = parseLocalDate(tx.date);
    if (!txDate) return false;
    return txDate >= start && txDate <= end;
  });

  const totalSpent = relevantTxs.reduce((sum, tx) => sum + tx.amount, 0);

  const categorySpent: Record<string, number> = {};
  relevantTxs.forEach((tx) => {
    categorySpent[tx.categoryId] = (categorySpent[tx.categoryId] || 0) + tx.amount;
  });

  return { totalSpent, categorySpent };
}

/** Percent of a budget consumed (0–100, clamped). */
export function getBudgetPercent(budget: Budget, totalSpent: number): number {
  return budget.amount > 0 ? Math.min(100, Math.round((totalSpent / budget.amount) * 100)) : 0;
}

/** Days remaining until a budget's window closes (minimum 1, inclusive of today). */
export function getBudgetDaysLeft(budget: Budget): number {
  const { end } = getBudgetWindow(budget);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((endDay.getTime() - today.getTime()) / 86400000) + 1);
}

/** Per-category allocation progress helper (used by the budget detail chips). */
export function getCategoryAllocPercent(alloc: BudgetCategoryAllocation, categorySpent: Record<string, number>): number {
  const used = categorySpent[alloc.categoryId] || 0;
  return alloc.amount > 0 ? Math.min(100, Math.round((used / alloc.amount) * 100)) : 0;
}

/** Display label for a budget's current window, e.g. "This week" / "Sep 30 – Oct 30". */
export function getBudgetWindowLabel(budget: Budget): string {
  if (budget.period === 'weekly') return 'This week';
  if (budget.period === 'monthly') return 'This month';
  if (budget.period === 'daily') return 'Today';
  const s = budget.startDate || '';
  const e = budget.endDate || '';
  return s && e ? `${s} ━ ${e}` : s || e || 'No dates';
}
