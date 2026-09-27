import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Account, Budget, FinanceSettings, FinanceState, Transaction } from '../types/finance';
import { loadFinanceData, saveFinanceData, DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from '../db/storage';
import { supabase, isSupabaseConfigured } from '../db/supabaseClient';

interface FinanceContextType {
  state: FinanceState;
  isCloudSynced: boolean;
  isSyncing: boolean;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (budget: Budget) => void;
  deleteBudget: (id: string) => void;
  updateSettings: (settings: Partial<FinanceSettings>) => void;
  exportDataJSON: () => void;
  importDataJSON: (jsonString: string) => boolean;
  clearAllData: () => void;
  triggerHaptic: () => void;
  syncFromSupabase: () => Promise<void>;
  // Computed values
  totalNetWorth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySavingsRate: number;
  accountBalances: Record<string, number>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<FinanceState>(() => loadFinanceData());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sync to local storage always as instant cache
  useEffect(() => {
    saveFinanceData(state);
  }, [state]);

  // Seed default accounts and categories if remote Supabase database is completely empty
  const seedRemoteDefaultsIfNeeded = async (remoteAccounts: any[], remoteCategories: any[]) => {
    if (!supabase) return;
    try {
      if (!remoteAccounts || remoteAccounts.length === 0) {
        const initialAccs = state.accounts.length > 0 ? state.accounts : DEFAULT_ACCOUNTS;
        await supabase.from('accounts').upsert(
          initialAccs.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            initial_balance: a.initialBalance,
            icon: a.icon || 'CreditCard',
          }))
        );
      }

      if (!remoteCategories || remoteCategories.length === 0) {
        const initialCats = state.categories.length > 0 ? state.categories : DEFAULT_CATEGORIES;
        await supabase.from('categories').upsert(
          initialCats.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            icon: c.icon,
          }))
        );
      }
    } catch (e) {
      console.warn('Auto-seed remote notice:', e);
    }
  };

  // If Supabase is connected, fetch remote data or sync initial state
  const syncFromSupabase = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      setIsSyncing(true);
      const [txRes, catRes, accRes, bgRes, stRes] = await Promise.all([
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('budgets').select('*'),
        supabase.from('settings').select('*').maybeSingle(),
      ]);

      // If remote accounts or categories are empty, seed them so the database has valid foreign keys!
      await seedRemoteDefaultsIfNeeded(accRes.data || [], catRes.data || []);

      setState((prev) => ({
        ...prev,
        transactions: txRes.data && txRes.data.length > 0 ? txRes.data.map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          categoryId: t.category_id,
          accountId: t.account_id,
          toAccountId: t.to_account_id,
          date: t.date,
          note: t.note,
          createdAt: Number(t.created_at),
        })) : prev.transactions,
        accounts: accRes.data && accRes.data.length > 0 ? accRes.data.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          initialBalance: Number(a.initial_balance),
          icon: a.icon,
        })) : prev.accounts,
        categories: catRes.data && catRes.data.length > 0 ? catRes.data : prev.categories,
        budgets: bgRes.data && bgRes.data.length > 0 ? bgRes.data.map((b) => ({
          id: b.id,
          categoryId: b.category_id,
          amount: Number(b.amount),
          period: b.period,
        })) : prev.budgets,
        settings: stRes.data ? {
          currencySymbol: stRes.data.currency_symbol || '$',
          currencyCode: stRes.data.currency_code || 'USD',
          monochromeOnly: false,
          vibrateOnTap: stRes.data.vibrate_on_tap ?? true,
          quickAddKeybind: stRes.data.quick_add_keybind || prev.settings.quickAddKeybind || 'n',
        } : prev.settings,
      }));
    } catch (e) {
      console.warn('Supabase fetch notice:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured) {
      syncFromSupabase();
    }
  }, []);

  const triggerHaptic = () => {
    if (state.settings.vibrateOnTap && typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Restricted
      }
    }
  };

  const addTransaction = async (txData: Omit<Transaction, 'id' | 'createdAt'>) => {
    triggerHaptic();
    const newTx: Transaction = {
      ...txData,
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: Date.now(),
    };

    // Update local state immediately for 0ms lag
    setState((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        // Ensure account exists in Supabase before foreign key insert
        const targetAcc = state.accounts.find((a) => a.id === newTx.accountId);
        if (targetAcc) {
          await supabase.from('accounts').upsert({
            id: targetAcc.id,
            name: targetAcc.name,
            type: targetAcc.type,
            initial_balance: targetAcc.initialBalance,
            icon: targetAcc.icon || 'CreditCard',
          });
        }

        const { error } = await supabase.from('transactions').insert({
          id: newTx.id,
          type: newTx.type,
          amount: newTx.amount,
          category_id: newTx.categoryId,
          account_id: newTx.accountId,
          to_account_id: newTx.toAccountId,
          date: newTx.date,
          note: newTx.note,
          created_at: newTx.createdAt,
        });

        if (error) {
          console.error('Supabase transaction insert error:', error);
        }
      } catch (err) {
        console.error('Supabase transaction sync error:', err);
      }
    }
  };

  const updateTransaction = (updatedTx: Transaction) => {
    triggerHaptic();
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t)),
    }));

    if (isSupabaseConfigured && supabase) {
      supabase.from('transactions').update({
        type: updatedTx.type,
        amount: updatedTx.amount,
        category_id: updatedTx.categoryId,
        account_id: updatedTx.accountId,
        to_account_id: updatedTx.toAccountId,
        date: updatedTx.date,
        note: updatedTx.note,
      }).eq('id', updatedTx.id).then();
    }
  };

  const deleteTransaction = (id: string) => {
    triggerHaptic();
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));

    if (isSupabaseConfigured && supabase) {
      supabase.from('transactions').delete().eq('id', id).then();
    }
  };

  const addAccount = async (accountData: Omit<Account, 'id'>) => {
    triggerHaptic();
    const newAccount: Account = {
      ...accountData,
      id: 'acc_' + Date.now(),
    };
    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('accounts').insert({
          id: newAccount.id,
          name: newAccount.name,
          type: newAccount.type,
          initial_balance: newAccount.initialBalance,
          icon: newAccount.icon,
        });
        if (error) console.error('Supabase account insert error:', error);
      } catch (err) {
        console.error('Supabase account insert catch:', err);
      }
    }
  };

  const updateAccount = (updatedAcc: Account) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.id === updatedAcc.id ? updatedAcc : a)),
    }));

    if (isSupabaseConfigured && supabase) {
      supabase.from('accounts').update({
        name: updatedAcc.name,
        type: updatedAcc.type,
        initial_balance: updatedAcc.initialBalance,
        icon: updatedAcc.icon,
      }).eq('id', updatedAcc.id).then();
    }
  };

  const deleteAccount = (id: string) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));

    if (isSupabaseConfigured && supabase) {
      supabase.from('accounts').delete().eq('id', id).then();
    }
  };

  const addBudget = (budgetData: Omit<Budget, 'id'>) => {
    triggerHaptic();
    const newBudget: Budget = {
      ...budgetData,
      id: 'b_' + Date.now(),
    };
    setState((prev) => ({
      ...prev,
      budgets: [...prev.budgets, newBudget],
    }));

    if (isSupabaseConfigured && supabase) {
      supabase.from('budgets').insert({
        id: newBudget.id,
        category_id: newBudget.categoryId,
        amount: newBudget.amount,
        period: newBudget.period,
      }).then();
    }
  };

  const updateBudget = (updatedBudget: Budget) => {
    setState((prev) => ({
      ...prev,
      budgets: prev.budgets.map((b) => (b.id === updatedBudget.id ? updatedBudget : b)),
    }));
  };

  const deleteBudget = (id: string) => {
    setState((prev) => ({
      ...prev,
      budgets: prev.budgets.filter((b) => b.id !== id),
    }));

    if (isSupabaseConfigured && supabase) {
      supabase.from('budgets').delete().eq('id', id).then();
    }
  };

  const updateSettings = (newSettings: Partial<FinanceSettings>) => {
    const updated = { ...state.settings, ...newSettings };
    setState((prev) => ({
      ...prev,
      settings: updated,
    }));

    if (isSupabaseConfigured && supabase) {
      supabase.from('settings').upsert({
        id: 'app_settings',
        currency_symbol: updated.currencySymbol,
        currency_code: updated.currencyCode,
        vibrate_on_tap: updated.vibrateOnTap,
      }).then();
    }
  };

  const exportDataJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `nullvault-finance-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importDataJSON = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.transactions) && Array.isArray(parsed.categories)) {
        setState({
          transactions: parsed.transactions,
          categories: parsed.categories,
          accounts: parsed.accounts || state.accounts,
          budgets: parsed.budgets || state.budgets,
          settings: { ...state.settings, ...(parsed.settings || {}) },
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to parse import data', e);
      return false;
    }
  };

  const clearAllData = () => {
    localStorage.removeItem('monodark_finance_state_v1');
    window.location.reload();
  };

  // Computations
  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    state.accounts.forEach((acc) => {
      balances[acc.id] = acc.initialBalance;
    });

    state.transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        if (balances[tx.accountId] !== undefined) {
          balances[tx.accountId] -= tx.amount;
        }
      } else if (tx.type === 'income') {
        if (balances[tx.accountId] !== undefined) {
          balances[tx.accountId] += tx.amount;
        }
      } else if (tx.type === 'transfer' && tx.toAccountId) {
        if (balances[tx.accountId] !== undefined) {
          balances[tx.accountId] -= tx.amount;
        }
        if (balances[tx.toAccountId] !== undefined) {
          balances[tx.toAccountId] += tx.amount;
        }
      }
    });

    return balances;
  }, [state.accounts, state.transactions]);

  const totalNetWorth = useMemo(() => {
    return Object.values(accountBalances).reduce((sum, b) => sum + b, 0);
  }, [accountBalances]);

  const { monthlyIncome, monthlyExpense, monthlySavingsRate } = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let income = 0;
    let expense = 0;

    state.transactions.forEach((tx) => {
      if (tx.date.startsWith(currentMonthPrefix)) {
        if (tx.type === 'income') income += tx.amount;
        if (tx.type === 'expense') expense += tx.amount;
      }
    });

    const savings = income - expense;
    const rate = income > 0 ? Math.max(0, Math.round((savings / income) * 100)) : 0;

    return {
      monthlyIncome: income,
      monthlyExpense: expense,
      monthlySavingsRate: rate,
    };
  }, [state.transactions]);

  return (
    <FinanceContext.Provider
      value={{
        state,
        isCloudSynced: isSupabaseConfigured,
        isSyncing,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addAccount,
        updateAccount,
        deleteAccount,
        addBudget,
        updateBudget,
        deleteBudget,
        updateSettings,
        exportDataJSON,
        importDataJSON,
        clearAllData,
        triggerHaptic,
        syncFromSupabase,
        totalNetWorth,
        monthlyIncome,
        monthlyExpense,
        monthlySavingsRate,
        accountBalances,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
