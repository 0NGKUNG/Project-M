export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color?: string; // Subtle monochrome or muted hue
  parentId?: string; // For subcategory hierarchy
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'savings' | 'investment';
  initialBalance: number;
  currentBalance?: number;
  color?: string;
  icon?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  subcategoryId?: string;
  accountId: string;
  toAccountId?: string; // Used for transfer
  date: string; // ISO date YYYY-MM-DD
  time?: string; // HH:mm
  note?: string;
  tags?: string[];
  createdAt: number;
}

export interface SpendingGoal {
  daily?: number;
  weekly?: number;
  monthly?: number;
}

export interface RecurringItem {
  id: string;
  name: string;
  type: 'expense' | 'income';
  amount: number;
  categoryId: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string; // ISO date YYYY-MM-DD
  isActive: boolean;
}

export interface DebtItem {
  id: string;
  type: 'lend' | 'borrow'; // 'lend' = someone owes me, 'borrow' = I owe someone
  personName: string;
  totalAmount: number;
  remainingAmount: number;
  dueDate?: string;
  note?: string;
  status: 'active' | 'settled';
  createdAt: number;
}

export interface BudgetCategoryAllocation {
  categoryId: string;
  amount: number;
}

export interface Budget {
  id: string;
  name?: string;
  categoryId?: string; // For single category legacy compatibility
  amount: number; // Overall limit
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  categories?: BudgetCategoryAllocation[];
}

export interface FinanceSettings {
  currencySymbol: string;
  currencyCode: string;
  monochromeOnly: boolean; // strict mono vs muted color accents
  vibrateOnTap: boolean;
  quickAddKeybind: string; // e.g. 'n', 't', '+', 'Space'
  weekStartDay?: 0 | 1 | 6; // 0 = Sunday, 1 = Monday, 6 = Saturday
  goals?: SpendingGoal;
}

export interface FinanceState {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  recurring: RecurringItem[];
  debts: DebtItem[];
  settings: FinanceSettings;
}

