export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color?: string; // Subtle monochrome or muted hue
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
  accountId: string;
  toAccountId?: string; // Used for transfer
  date: string; // ISO date YYYY-MM-DD
  time?: string; // HH:mm
  note?: string;
  tags?: string[];
  createdAt: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number; // Monthly limit
  period: 'monthly';
}

export interface FinanceSettings {
  currencySymbol: string;
  currencyCode: string;
  monochromeOnly: boolean; // strict mono vs muted color accents
  vibrateOnTap: boolean;
  quickAddKeybind: string; // e.g. 'n', 't', '+', 'Space'
}

export interface FinanceState {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  settings: FinanceSettings;
}
