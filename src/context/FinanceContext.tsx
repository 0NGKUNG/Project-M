import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { Account, Budget, Category, DebtItem, FinanceSettings, FinanceState, RecurringItem, Transaction } from '../types/finance';
import { 
  loadFinanceData, 
  saveFinanceData, 
  DEFAULT_ACCOUNTS, 
  DEFAULT_CATEGORIES,
  getCategoryParentMap,
  saveCategoryParentMap 
} from '../db/storage';
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
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  addRecurring: (item: Omit<RecurringItem, 'id'>) => void;
  updateRecurring: (item: RecurringItem) => void;
  deleteRecurring: (id: string) => void;
  addDebt: (item: Omit<DebtItem, 'id' | 'createdAt'>) => void;
  updateDebt: (item: DebtItem) => void;
  deleteDebt: (id: string) => void;
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
  todayExpense: number;
  todayIncome: number;
  thisWeekExpense: number;
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
      const [txRes, catRes, accRes, bgRes, recRes, debtRes, stRes] = await Promise.all([
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('budgets').select('*'),
        supabase.from('recurring').select('*'),
        supabase.from('debts').select('*'),
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
          subcategoryId: t.subcategory_id || undefined,
          accountId: t.account_id,
          toAccountId: t.to_account_id,
          date: t.date,
          time: t.time,
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
        categories: catRes.data && catRes.data.length > 0 ? (() => {
          const localParentMap = getCategoryParentMap();
          // Known default subcategory relationships
          const defaultParentMap: Record<string, string> = {
            sub_coffee: 'cat_food',
            sub_groceries: 'cat_food',
            sub_restaurant: 'cat_food',
            cat_coffee: 'cat_food',
            cat_groceries: 'cat_food',
            cat_restaurant: 'cat_food',
            sub_fuel: 'cat_transport',
            sub_rideshare: 'cat_transport',
            cat_fuel: 'cat_transport',
            cat_rideshare: 'cat_transport',
          };
          return catRes.data.map((c) => {
            const rawParent = c.parent_id || c.parentId;
            const parentId = rawParent 
              || localParentMap[c.id] 
              || defaultParentMap[c.id] 
              || prev.categories.find((pc) => pc.id === c.id)?.parentId 
              || undefined;
            return {
              id: c.id,
              name: c.name,
              type: c.type,
              icon: c.icon,
              parentId,
            };
          });
        })() : prev.categories,
        budgets: bgRes.data ? bgRes.data.map((b) => ({
          id: b.id,
          name: b.name || undefined,
          categoryId: b.category_id || undefined,
          amount: Number(b.amount),
          period: b.period || 'monthly',
          startDate: b.start_date || b.startDate || undefined,
          endDate: b.end_date || b.endDate || undefined,
          categories: b.categories || undefined,
        })) : prev.budgets,
        recurring: recRes.data && recRes.data.length > 0 ? recRes.data.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          amount: Number(r.amount),
          categoryId: r.category_id || r.categoryId,
          accountId: r.account_id || r.accountId,
          frequency: r.frequency,
          nextDueDate: r.next_due_date || r.nextDueDate,
          isActive: r.is_active ?? r.isActive ?? true,
        })) : prev.recurring,
        debts: debtRes.data && debtRes.data.length > 0 ? debtRes.data.map((d) => ({
          id: d.id,
          type: d.type,
          personName: d.person_name || d.personName,
          totalAmount: Number(d.total_amount || d.totalAmount),
          remainingAmount: Number(d.remaining_amount || d.remainingAmount),
          dueDate: d.due_date || d.dueDate || undefined,
          note: d.note || undefined,
          status: d.status || 'active',
          createdAt: Number(d.created_at || d.createdAt || Date.now()),
        })) : prev.debts,
        settings: stRes.data ? {
          currencySymbol: stRes.data.currency_symbol || prev.settings.currencySymbol || '$',
          currencyCode: stRes.data.currency_code || prev.settings.currencyCode || 'USD',
          monochromeOnly: false,
          vibrateOnTap: stRes.data.vibrate_on_tap ?? prev.settings.vibrateOnTap ?? true,
          quickAddKeybind: stRes.data.quick_add_keybind || prev.settings.quickAddKeybind || 'n',
          weekStartDay: stRes.data.week_start_day ?? prev.settings.weekStartDay ?? 1,
          goals: stRes.data.goals || prev.settings.goals,
        } : prev.settings,
      }));

      // If Supabase does not have an app_settings row yet, upload the current settings so it is persisted in the cloud!
      if (!stRes.data && isSupabaseConfigured && supabase) {
        try {
          const currentSettings = loadFinanceData().settings;
          await supabase.from('settings').upsert({
            id: 'app_settings',
            currency_symbol: currentSettings.currencySymbol,
            currency_code: currentSettings.currencyCode,
            vibrate_on_tap: currentSettings.vibrateOnTap,
            quick_add_keybind: currentSettings.quickAddKeybind,
            week_start_day: currentSettings.weekStartDay,
            goals: currentSettings.goals,
          });
        } catch (seedErr) {
          console.warn('Initial settings sync to Supabase notice:', seedErr);
        }
      }
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

    // Update local state immediately for instant feedback
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

  const updateTransaction = async (updatedTx: Transaction) => {
    triggerHaptic();
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t)),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('transactions').update({
          type: updatedTx.type,
          amount: updatedTx.amount,
          category_id: updatedTx.categoryId,
          account_id: updatedTx.accountId,
          to_account_id: updatedTx.toAccountId,
          date: updatedTx.date,
          note: updatedTx.note,
        }).eq('id', updatedTx.id);
        if (error) console.error('Supabase transaction update error:', error);
      } catch (err) {
        console.error('Supabase transaction update catch:', err);
      }
    }
  };

  const deleteTransaction = async (id: string) => {
    triggerHaptic();
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) console.error('Supabase transaction delete error:', error);
      } catch (err) {
        console.error('Supabase transaction delete catch:', err);
      }
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

  const updateAccount = async (updatedAcc: Account) => {
    triggerHaptic();
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => (a.id === updatedAcc.id ? updatedAcc : a)),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('accounts').update({
          name: updatedAcc.name,
          type: updatedAcc.type,
          initial_balance: updatedAcc.initialBalance,
          icon: updatedAcc.icon,
        }).eq('id', updatedAcc.id);
        if (error) console.error('Supabase account update error:', error);
      } catch (err) {
        console.error('Supabase account update catch:', err);
      }
    }
  };

  const deleteAccount = async (id: string) => {
    triggerHaptic();
    // Also remove any transactions tied to this deleted account locally
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
      transactions: prev.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        // First delete any transactions tied to this account to prevent foreign key constraints
        await supabase.from('transactions').delete().eq('account_id', id);
        await supabase.from('transactions').delete().eq('to_account_id', id);
        const { error } = await supabase.from('accounts').delete().eq('id', id);
        if (error) console.error('Supabase account delete error:', error);
      } catch (err) {
        console.error('Supabase account delete catch:', err);
      }
    }
  };

  const addBudget = async (budgetData: Omit<Budget, 'id'>) => {
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
      try {
        const { error } = await supabase.from('budgets').insert({
          id: newBudget.id,
          name: newBudget.name || null,
          category_id: newBudget.categoryId || null,
          amount: newBudget.amount,
          period: newBudget.period,
          start_date: newBudget.startDate || null,
          end_date: newBudget.endDate || null,
          categories: newBudget.categories || null,
        });
        if (error) {
          // If columns don't exist yet, fallback to minimal insert
          await supabase.from('budgets').insert({
            id: newBudget.id,
            category_id: newBudget.categoryId || null,
            amount: newBudget.amount,
            period: newBudget.period,
          });
        }
      } catch (err) {
        console.error('Supabase budget insert error:', err);
      }
    }
  };

  const updateBudget = async (updatedBudget: Budget) => {
    triggerHaptic();
    setState((prev) => ({
      ...prev,
      budgets: prev.budgets.map((b) => (b.id === updatedBudget.id ? updatedBudget : b)),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('budgets').update({
          name: updatedBudget.name || null,
          category_id: updatedBudget.categoryId || null,
          amount: updatedBudget.amount,
          period: updatedBudget.period,
          start_date: updatedBudget.startDate || null,
          end_date: updatedBudget.endDate || null,
          categories: updatedBudget.categories || null,
        }).eq('id', updatedBudget.id);
        if (error) console.error('Supabase budget update error:', error);
      } catch (err) {
        console.error('Supabase budget update error:', err);
      }
    }
  };

  const deleteBudget = async (id: string) => {
    triggerHaptic();
    setState((prev) => ({
      ...prev,
      budgets: prev.budgets.filter((b) => b.id !== id),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('budgets').delete().eq('id', id);
        if (error) console.error('Supabase budget delete error:', error);
      } catch (err) {
        console.error('Supabase budget delete catch:', err);
      }
    }
  };

  const addCategory = async (catData: Omit<Category, 'id'>) => {
    triggerHaptic();
    const newCategory: Category = {
      ...catData,
      id: 'cat_' + Date.now(),
    };
    if (newCategory.parentId) {
      const currentMap = getCategoryParentMap();
      currentMap[newCategory.id] = newCategory.parentId;
      saveCategoryParentMap(currentMap);
    }
    setState((prev) => ({
      ...prev,
      categories: [...prev.categories, newCategory],
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('categories').insert({
          id: newCategory.id,
          name: newCategory.name,
          type: newCategory.type,
          icon: newCategory.icon,
          parent_id: newCategory.parentId || null,
        });
        if (error) {
          // Fallback if parent_id column isn't created yet in remote table
          await supabase.from('categories').insert({
            id: newCategory.id,
            name: newCategory.name,
            type: newCategory.type,
            icon: newCategory.icon,
          });
        }
      } catch (err) {
        console.error('Supabase category insert error:', err);
      }
    }
  };

  const updateCategory = async (updatedCat: Category) => {
    triggerHaptic();
    const currentMap = getCategoryParentMap();
    if (updatedCat.parentId) {
      currentMap[updatedCat.id] = updatedCat.parentId;
    } else {
      delete currentMap[updatedCat.id];
    }
    saveCategoryParentMap(currentMap);

    setState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === updatedCat.id ? updatedCat : c)),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('categories').update({
          name: updatedCat.name,
          type: updatedCat.type,
          icon: updatedCat.icon,
          parent_id: updatedCat.parentId || null,
        }).eq('id', updatedCat.id);
        if (error) console.error('Supabase category update error:', error);
      } catch (err) {
        console.error('Supabase category update catch:', err);
      }
    }
  };

  const deleteCategory = async (id: string) => {
    triggerHaptic();
    const currentMap = getCategoryParentMap();
    delete currentMap[id];
    saveCategoryParentMap(currentMap);

    setState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id && c.parentId !== id),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        // Also remove any subcategories referencing this id
        await supabase.from('categories').delete().eq('parent_id', id);
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) console.error('Supabase category delete error:', error);
      } catch (err) {
        console.error('Supabase category delete catch:', err);
      }
    }
  };

  const addRecurring = async (itemData: Omit<RecurringItem, 'id'>) => {
    triggerHaptic();
    const newItem: RecurringItem = {
      ...itemData,
      id: 'rec_' + Date.now(),
    };
    setState((prev) => ({
      ...prev,
      recurring: [...(prev.recurring || []), newItem],
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('recurring').insert({
          id: newItem.id,
          name: newItem.name,
          type: newItem.type,
          amount: newItem.amount,
          category_id: newItem.categoryId,
          account_id: newItem.accountId,
          frequency: newItem.frequency,
          next_due_date: newItem.nextDueDate,
          is_active: newItem.isActive,
        });
        if (error) console.warn('Supabase recurring insert notice:', error);
      } catch (err) {
        console.warn('Supabase recurring insert catch:', err);
      }
    }
  };

  const updateRecurring = async (updatedItem: RecurringItem) => {
    setState((prev) => ({
      ...prev,
      recurring: (prev.recurring || []).map((r) => (r.id === updatedItem.id ? updatedItem : r)),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('recurring').update({
          name: updatedItem.name,
          type: updatedItem.type,
          amount: updatedItem.amount,
          category_id: updatedItem.categoryId,
          account_id: updatedItem.accountId,
          frequency: updatedItem.frequency,
          next_due_date: updatedItem.nextDueDate,
          is_active: updatedItem.isActive,
        }).eq('id', updatedItem.id);
        if (error) console.warn('Supabase recurring update notice:', error);
      } catch (err) {
        console.warn('Supabase recurring update catch:', err);
      }
    }
  };

  const deleteRecurring = async (id: string) => {
    setState((prev) => ({
      ...prev,
      recurring: (prev.recurring || []).filter((r) => r.id !== id),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('recurring').delete().eq('id', id);
        if (error) console.warn('Supabase recurring delete notice:', error);
      } catch (err) {
        console.warn('Supabase recurring delete catch:', err);
      }
    }
  };

  const addDebt = async (itemData: Omit<DebtItem, 'id' | 'createdAt'>) => {
    triggerHaptic();
    const newDebt: DebtItem = {
      ...itemData,
      id: 'debt_' + Date.now(),
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      debts: [...(prev.debts || []), newDebt],
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('debts').insert({
          id: newDebt.id,
          type: newDebt.type,
          person_name: newDebt.personName,
          total_amount: newDebt.totalAmount,
          remaining_amount: newDebt.remainingAmount,
          due_date: newDebt.dueDate,
          note: newDebt.note,
          status: newDebt.status,
          created_at: newDebt.createdAt,
        });
        if (error) console.warn('Supabase debt insert notice:', error);
      } catch (err) {
        console.warn('Supabase debt insert catch:', err);
      }
    }
  };

  const updateDebt = async (updatedDebt: DebtItem) => {
    setState((prev) => ({
      ...prev,
      debts: (prev.debts || []).map((d) => (d.id === updatedDebt.id ? updatedDebt : d)),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('debts').update({
          type: updatedDebt.type,
          person_name: updatedDebt.personName,
          total_amount: updatedDebt.totalAmount,
          remaining_amount: updatedDebt.remainingAmount,
          due_date: updatedDebt.dueDate,
          note: updatedDebt.note,
          status: updatedDebt.status,
        }).eq('id', updatedDebt.id);
        if (error) console.warn('Supabase debt update notice:', error);
      } catch (err) {
        console.warn('Supabase debt update catch:', err);
      }
    }
  };

  const deleteDebt = async (id: string) => {
    setState((prev) => ({
      ...prev,
      debts: (prev.debts || []).filter((d) => d.id !== id),
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('debts').delete().eq('id', id);
        if (error) console.warn('Supabase debt delete notice:', error);
      } catch (err) {
        console.warn('Supabase debt delete catch:', err);
      }
    }
  };

  const updateSettings = async (newSettings: Partial<FinanceSettings>) => {
    const updated = { ...state.settings, ...newSettings };
    setState((prev) => ({
      ...prev,
      settings: updated,
    }));

    if (isSupabaseConfigured && supabase) {
      try {
        const payload: any = {
          id: 'app_settings',
          currency_symbol: updated.currencySymbol,
          currency_code: updated.currencyCode,
          vibrate_on_tap: updated.vibrateOnTap,
          quick_add_keybind: updated.quickAddKeybind,
          week_start_day: updated.weekStartDay,
          goals: updated.goals,
        };

        const { error } = await supabase.from('settings').upsert(payload);
        if (error) {
          console.warn('Full settings upsert failed, falling back to core columns:', error);
          // If columns like week_start_day or goals don't exist yet in user's SQL table, fallback to core settings
          const { error: fallbackError } = await supabase.from('settings').upsert({
            id: 'app_settings',
            currency_symbol: updated.currencySymbol,
            currency_code: updated.currencyCode,
            vibrate_on_tap: updated.vibrateOnTap,
          });
          if (fallbackError) {
            console.error('Supabase fallback settings upsert error:', fallbackError);
          }
        }
      } catch (err) {
        console.warn('Supabase settings upsert error:', err);
      }
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
          recurring: parsed.recurring || state.recurring || [],
          debts: parsed.debts || state.debts || [],
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

  const clearAllData = async () => {
    localStorage.removeItem('monodark_finance_state_v1');
    if (isSupabaseConfigured && supabase) {
      try {
        await Promise.allSettled([
          supabase.from('transactions').delete().neq('id', 'keep_none'),
          supabase.from('budgets').delete().neq('id', 'keep_none'),
          supabase.from('recurring').delete().neq('id', 'keep_none'),
          supabase.from('debts').delete().neq('id', 'keep_none'),
        ]);
      } catch (err) {
        console.warn('Supabase remote clear error:', err);
      }
    }
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

  const { todayIncome, todayExpense, thisWeekExpense } = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    // Compute start of current week based on weekStartDay setting (0=Sun, 1=Mon, 6=Sat)
    const startDay = state.settings.weekStartDay ?? 1;
    const currentDay = now.getDay();
    const diff = (currentDay < startDay ? 7 : 0) + currentDay - startDay;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    let tIncome = 0;
    let tExpense = 0;
    let wExpense = 0;

    state.transactions.forEach((tx) => {
      if (tx.date === todayStr) {
        if (tx.type === 'income') tIncome += tx.amount;
        if (tx.type === 'expense') tExpense += tx.amount;
      }
      const txDate = new Date(tx.date);
      if (txDate >= weekStart && txDate <= now && tx.type === 'expense') {
        wExpense += tx.amount;
      }
    });

    return {
      todayIncome: tIncome,
      todayExpense: tExpense,
      thisWeekExpense: wExpense,
    };
  }, [state.transactions, state.settings.weekStartDay]);

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
        addCategory,
        updateCategory,
        deleteCategory,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        addDebt,
        updateDebt,
        deleteDebt,
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
        todayExpense,
        todayIncome,
        thisWeekExpense,
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
