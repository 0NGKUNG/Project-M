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
 * period:
 * - daily: today (clears every day at midnight)
 * - weekly: this week starting Monday / Sunday / Saturday based on settings
 * - monthly: 1st of month till end of month (clears on 1st of next month)
 * Spent resets automatically when a new period begins.
 */
export function getBudgetWindow(budget: Budget, weekStartDay: number = 1): BudgetWindow {
  const now = new Date();

  if (budget.period === 'daily') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  if (budget.period === 'weekly') {
    // Week starts Monday (1), Sunday (0), or Saturday (6) based on weekStartDay setting
    const startDay = weekStartDay ?? 1;
    const currentDay = now.getDay();
    const diff = (currentDay < startDay ? 7 : 0) + currentDay - startDay;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (budget.period === 'monthly') {
    // 1st of month to last day of month
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  // daily or fixed-range: use stored dates if present, else today
  const start = parseLocalDate(budget.startDate || '') || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = parseLocalDate(budget.endDate || '') || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Formats a Date object to YYYY-MM-DD in local time (no UTC shift). */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns the current period's start and end date strings (YYYY-MM-DD) based on settings. */
export function getCurrentPeriodBounds(
  period: Budget['period'],
  weekStartDay: number = 1
): { startDate: string; endDate: string } {
  const now = new Date();

  if (period === 'daily') {
    const todayStr = formatLocalDate(now);
    return { startDate: todayStr, endDate: todayStr };
  }

  if (period === 'weekly') {
    const startDay = weekStartDay ?? 1;
    const currentDay = now.getDay();
    const diff = (currentDay < startDay ? 7 : 0) + currentDay - startDay;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { startDate: formatLocalDate(start), endDate: formatLocalDate(end) };
  }

  // monthly: 1st till last day of the month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: formatLocalDate(start), endDate: formatLocalDate(end) };
}

/**
 * Single source of truth for budget progress math.
 *
 * Used by the budgets page and any other budget UI so every screen
 * shows the same numbers for the same `state.budgets` data. No per-view duplicates.
 */
export function getBudgetSpending(
  budget: Budget,
  transactions: Transaction[],
  weekStartDay: number = 1
): { totalSpent: number; categorySpent: Record<string, number> } {
  const { start, end } = getBudgetWindow(budget, weekStartDay);

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
export function getBudgetDaysLeft(budget: Budget, weekStartDay: number = 1): number {
  const { end } = getBudgetWindow(budget, weekStartDay);
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

/** Display label for a budget's current window, e.g. "Today (Oct 5)" / "Oct 5 – Oct 11" / "Oct 1 – Oct 31". */
export function getBudgetWindowLabel(budget: Budget, weekStartDay: number = 1): string {
  const formatShort = (d: Date) => `${d.toLocaleDateString('default', { month: 'short' })} ${d.getDate()}`;
  const win = getBudgetWindow(budget, weekStartDay);

  if (budget.period === 'daily') {
    return `Today (${formatShort(win.start)})`;
  }
  if (budget.period === 'weekly') {
    return `${formatShort(win.start)} – ${formatShort(win.end)}`;
  }
  if (budget.period === 'monthly') {
    return `${formatShort(win.start)} – ${formatShort(win.end)}`;
  }
  const s = budget.startDate || '';
  const e = budget.endDate || '';
  return s && e ? `${s} – ${e}` : s || e || 'No dates';
}
