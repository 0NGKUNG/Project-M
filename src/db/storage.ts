import type { Account, Category, FinanceSettings, FinanceState, Transaction } from '../types/finance';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc_cash', name: 'Cash Wallet', type: 'cash', initialBalance: 500, icon: 'Wallet' },
  { id: 'acc_bank', name: 'Checking Account', type: 'bank', initialBalance: 2400, icon: 'Building2' },
  { id: 'acc_savings', name: 'High Yield Savings', type: 'savings', initialBalance: 8500, icon: 'PiggyBank' },
  { id: 'acc_cc', name: 'Credit Card', type: 'credit', initialBalance: 0, icon: 'CreditCard' },
];

export const DEFAULT_CATEGORIES: Category[] = [
  // Expenses - Core Parents
  { id: 'cat_food', name: 'Food & Dining', type: 'expense', icon: 'Utensils' },
  { id: 'sub_coffee', name: 'Coffee & Drinks', type: 'expense', icon: 'Coffee', parentId: 'cat_food' },
  { id: 'sub_groceries', name: 'Groceries', type: 'expense', icon: 'ShoppingCart', parentId: 'cat_food' },
  { id: 'sub_restaurant', name: 'Restaurants', type: 'expense', icon: 'Utensils', parentId: 'cat_food' },

  { id: 'cat_transport', name: 'Transit & Auto', type: 'expense', icon: 'Car' },
  { id: 'sub_fuel', name: 'Fuel / Gas', type: 'expense', icon: 'Car', parentId: 'cat_transport' },
  { id: 'sub_rideshare', name: 'Taxi & Train', type: 'expense', icon: 'Car', parentId: 'cat_transport' },

  { id: 'cat_housing', name: 'Rent & Utilities', type: 'expense', icon: 'Home' },
  { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', icon: 'Film' },
  { id: 'cat_shopping', name: 'Shopping', type: 'expense', icon: 'ShoppingBag' },
  { id: 'cat_health', name: 'Health & Fitness', type: 'expense', icon: 'HeartPulse' },
  { id: 'cat_tech', name: 'Tech & Subscriptions', type: 'expense', icon: 'Laptop' },
  { id: 'cat_other_exp', name: 'General & Misc', type: 'expense', icon: 'MoreHorizontal' },

  // Income
  { id: 'cat_salary', name: 'Salary', type: 'income', icon: 'Briefcase' },
  { id: 'cat_freelance', name: 'Freelance & Side gigs', type: 'income', icon: 'Zap' },
  { id: 'cat_investments', name: 'Dividends & Yield', type: 'income', icon: 'TrendingUp' },
  { id: 'cat_other_inc', name: 'Other Income', type: 'income', icon: 'ArrowDownLeft' },
];

export const DEFAULT_SETTINGS: FinanceSettings = {
  currencySymbol: '$',
  currencyCode: 'USD',
  monochromeOnly: false,
  vibrateOnTap: true,
  quickAddKeybind: 'n',
};

const STORAGE_KEY = 'monodark_finance_state_v1';

export function loadFinanceData(): FinanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getInitialState();
    }
    const parsed = JSON.parse(raw);
    return {
      transactions: parsed.transactions || [],
      categories: parsed.categories && parsed.categories.length ? parsed.categories : DEFAULT_CATEGORIES,
      accounts: parsed.accounts && parsed.accounts.length ? parsed.accounts : DEFAULT_ACCOUNTS,
      budgets: parsed.budgets || [],
      recurring: parsed.recurring || [],
      debts: parsed.debts || [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch (e) {
    console.error('Failed to load local finance storage:', e);
    return getInitialState();
  }
}

export function saveFinanceData(state: FinanceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save to local finance storage:', e);
  }
}

function getInitialState(): FinanceState {
  const today = new Date().toISOString().split('T')[0];
  const initialTransactions: Transaction[] = [
    {
      id: 'tx_demo_1',
      type: 'income',
      amount: 3200,
      categoryId: 'cat_salary',
      accountId: 'acc_bank',
      date: today,
      note: 'Monthly salary',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'tx_demo_2',
      type: 'expense',
      amount: 14.5,
      categoryId: 'cat_coffee',
      accountId: 'acc_cash',
      date: today,
      note: 'Espresso & pastry',
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'tx_demo_3',
      type: 'expense',
      amount: 68.2,
      categoryId: 'cat_groceries',
      accountId: 'acc_bank',
      date: today,
      note: 'Weekly essentials',
      createdAt: Date.now() - 3600000 * 3,
    },
  ];

  return {
    transactions: initialTransactions,
    categories: DEFAULT_CATEGORIES,
    accounts: DEFAULT_ACCOUNTS,
    budgets: [
      { id: 'b_food', categoryId: 'cat_food', amount: 450, period: 'monthly' },
      { id: 'b_groceries', categoryId: 'cat_groceries', amount: 350, period: 'monthly' },
      { id: 'b_coffee', categoryId: 'cat_coffee', amount: 80, period: 'monthly' },
    ],
    recurring: [],
    debts: [],
    settings: DEFAULT_SETTINGS,
  };
}
