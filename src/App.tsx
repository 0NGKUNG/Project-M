import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { BottomNav } from './components/layout/BottomNav';
import { Sidebar } from './components/layout/Sidebar';
import type { NavTab } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { TransactionListView } from './components/transactions/TransactionListView';
import { BudgetsView } from './components/budgets/BudgetsView';
import { SettingsView } from './components/settings/SettingsView';
import { QuickAddModal } from './components/transactions/QuickAddModal';
import { AccountDetailModal } from './components/accounts/AccountDetailModal';
import type { Account } from './types/finance';

export const AppContent: React.FC = () => {
  const { state } = useFinance();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [preselectedAccountId, setPreselectedAccountId] = useState<string | undefined>(undefined);

  const handleOpenQuickAdd = (accId?: string) => {
    setPreselectedAccountId(accId);
    setIsQuickAddOpen(true);
  };

  // Global keybind listener to open Quick Add from anywhere
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or modal is already open
      const target = e.target as HTMLElement;
      if (
        isQuickAddOpen ||
        selectedAccount !== null ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const configuredKey = (state.settings.quickAddKeybind || 'n').toLowerCase();
      if (e.key.toLowerCase() === configuredKey) {
        e.preventDefault();
        handleOpenQuickAdd();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [state.settings.quickAddKeybind, isQuickAddOpen, selectedAccount]);

  return (
    <div className="min-h-screen bg-black text-[#f4f4f5] flex justify-center selection:bg-white selection:text-black antialiased">
      <div className="w-full flex min-h-screen bg-[#060608]">
        {/* Desktop / Laptop Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onOpenQuickAdd={() => handleOpenQuickAdd()}
        />

        {/* Dynamic Main View Area */}
        <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden bg-[#060608]">
          <main className="flex-1 w-full max-w-md lg:max-w-none mx-auto py-2 md:py-8 lg:px-6">
            {currentTab === 'dashboard' && (
              <DashboardView
                onOpenQuickAdd={() => handleOpenQuickAdd()}
                onViewAllTransactions={() => setCurrentTab('transactions')}
                onSelectAccount={(acc) => setSelectedAccount(acc)}
              />
            )}

            {currentTab === 'transactions' && <TransactionListView />}

            {currentTab === 'budgets' && <BudgetsView />}

            {currentTab === 'settings' && <SettingsView />}
          </main>

          {/* Mobile Bottom Nav Bar */}
          <BottomNav
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            onOpenQuickAdd={() => handleOpenQuickAdd()}
          />
        </div>

        {/* Account Details & Breakdown Modal */}
        <AccountDetailModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
          onOpenQuickAddWithAccount={(accId) => handleOpenQuickAdd(accId)}
        />

        {/* Quick Fast-Entry Drawer */}
        <QuickAddModal
          isOpen={isQuickAddOpen}
          onClose={() => {
            setIsQuickAddOpen(false);
            setPreselectedAccountId(undefined);
          }}
          defaultAccountId={preselectedAccountId}
        />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}
