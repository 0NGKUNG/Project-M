import React, { useState, useRef, useEffect } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { BottomNav } from './components/layout/BottomNav';
import { Sidebar } from './components/layout/Sidebar';
import type { NavTab } from './components/layout/Sidebar';
import { TodayView } from './components/today/TodayView';
import { StatsView } from './components/stats/StatsView';
import { AccountsView } from './components/accounts/AccountsView';
import { SettingsView } from './components/settings/SettingsView';
import { QuickAddModal } from './components/transactions/QuickAddModal';
import { AccountDetailModal } from './components/accounts/AccountDetailModal';
import type { Account } from './types/finance';
import { AuthGate } from './components/auth/AuthGate';

const TABS: NavTab[] = ['today', 'stats', 'accounts', 'settings'];

export const AppContent: React.FC = () => {
  const { state } = useFinance();
  const [currentTab, setCurrentTab] = useState<NavTab>('today');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [preselectedAccountId, setPreselectedAccountId] = useState<string | undefined>(undefined);

  // Sidebar collapsed state — persisted across sessions
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  };

  // Swipe / Drag handling
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingFromCode = useRef(false);

  const handleOpenQuickAdd = (accId?: string) => {
    setPreselectedAccountId(accId);
    setIsQuickAddOpen(true);
  };

  // Switch tab and smooth scroll on mobile container
  const handleTabChange = (tab: NavTab) => {
    if (tab !== currentTab && navigator.vibrate) navigator.vibrate(8);
    setCurrentTab(tab);
    const tabIndex = TABS.indexOf(tab);
    if (containerRef.current && tabIndex !== -1) {
      isScrollingFromCode.current = true;
      const width = containerRef.current.clientWidth;
      containerRef.current.scrollTo({
        left: tabIndex * width,
        behavior: 'instant' as ScrollBehavior,
      });
      setTimeout(() => {
        isScrollingFromCode.current = false;
      }, 150);
    }
  };

  // Sync scroll position from touch swiping back to currentTab
  const handleScroll = () => {
    if (isScrollingFromCode.current || !containerRef.current) return;
    const { scrollLeft, clientWidth } = containerRef.current;
    if (clientWidth === 0) return;
    const newIndex = Math.round(scrollLeft / clientWidth);
    if (newIndex >= 0 && newIndex < TABS.length && TABS[newIndex] !== currentTab) {
      setCurrentTab(TABS[newIndex]);
    }
  };

  // Handle window resize adjustment
  useEffect(() => {
    const handleResize = () => {
      const tabIndex = TABS.indexOf(currentTab);
      if (containerRef.current && tabIndex !== -1) {
        containerRef.current.scrollLeft = tabIndex * containerRef.current.clientWidth;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentTab]);

  // Global keybind listener to open Quick Add
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
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
    <div className="h-full h-[100dvh] bg-black text-[#f4f4f5] flex justify-center selection:bg-white selection:text-black antialiased overflow-hidden">
      <div className="w-full flex h-full h-[100dvh] bg-[#060608] overflow-hidden">
        {/* Desktop / Laptop Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onOpenQuickAdd={() => handleOpenQuickAdd()}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />

        {/* Dynamic Main View Area with Mobile Swipe Navigation */}
        <div className="flex-1 flex flex-col h-full h-[100dvh] overflow-hidden bg-[#060608] relative">
          {/* Desktop display: static view without carousel overhead */}
          <main className="hidden lg:block flex-1 w-full py-6 px-0 overflow-y-auto">
            {currentTab === 'today' && (
              <TodayView
                onOpenQuickAdd={handleOpenQuickAdd}
                onNavigateTab={handleTabChange}
              />
            )}
            {currentTab === 'stats' && <StatsView />}
            {currentTab === 'accounts' && (
              <AccountsView
                onSelectAccount={(acc) => setSelectedAccount(acc)}
                onOpenQuickAddWithAccount={handleOpenQuickAdd}
              />
            )}
            {currentTab === 'settings' && <SettingsView />}
          </main>

          {/* Mobile display: Horizontal swipe/drag scroll snap container with 1-page snap lock */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="lg:hidden flex-1 w-full flex overflow-x-auto page-carousel-container no-scrollbar overscroll-x-none"
          >
            {/* View 1: Today */}
            <div className="w-full h-full shrink-0 page-carousel-item overflow-y-auto overscroll-y-contain pt-3">
              <TodayView
                onOpenQuickAdd={handleOpenQuickAdd}
                onNavigateTab={handleTabChange}
              />
            </div>

            {/* View 2: Stats */}
            <div className="w-full h-full shrink-0 page-carousel-item overflow-y-auto overscroll-y-contain pt-3">
              <StatsView />
            </div>

            {/* View 3: Accounts */}
            <div className="w-full h-full shrink-0 page-carousel-item overflow-y-auto overscroll-y-contain pt-3">
              <AccountsView
                onSelectAccount={(acc) => setSelectedAccount(acc)}
                onOpenQuickAddWithAccount={handleOpenQuickAdd}
              />
            </div>

            {/* View 4: Settings */}
            <div className="w-full h-full shrink-0 page-carousel-item overflow-y-auto overscroll-y-contain pt-3">
              <SettingsView />
            </div>
          </div>

          {/* Mobile Bottom Nav Bar */}
          <BottomNav
            currentTab={currentTab}
            onTabChange={handleTabChange}
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
      <AuthGate>
        <AppContent />
      </AuthGate>
    </FinanceProvider>
  );
}
