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
  const [isTodaySubPageOpen, setIsTodaySubPageOpen] = useState(false);
  const [isSettingsSubPageOpen, setIsSettingsSubPageOpen] = useState(false);
  const isAnySubPageOrModalOpen = isTodaySubPageOpen || isSettingsSubPageOpen || isQuickAddOpen || Boolean(selectedAccount);

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
    // Re-tapping the active tab (navbar/sidebar) lets views pop sub-pages back to their root.
    if (tab === currentTab) {
      window.dispatchEvent(new CustomEvent<NavTab>('nova:tab-retap', { detail: tab }));
    } else {
      // Switching views: open sub-pages close so returning shows the root view.
      window.dispatchEvent(new CustomEvent<NavTab>('nova:tab-changed', { detail: tab }));
    }
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

  // Sync scroll position from touch swiping back to currentTab (ignored when subpage/modal is open)
  const handleScroll = () => {
    if (isScrollingFromCode.current || !containerRef.current || isAnySubPageOrModalOpen) return;
    const { scrollLeft, clientWidth } = containerRef.current;
    if (clientWidth === 0) return;
    const newIndex = Math.round(scrollLeft / clientWidth);
    if (newIndex >= 0 && newIndex < TABS.length && TABS[newIndex] !== currentTab) {
      setCurrentTab(TABS[newIndex]);
      // Swipe-driven tab switch: close any open sub-pages so returning shows the root view.
      window.dispatchEvent(new CustomEvent<NavTab>('nova:tab-changed', { detail: TABS[newIndex] }));
    }
  };

  // Handle window resize adjustment and maintain alignment when swipe is locked/unlocked
  useEffect(() => {
    const handleResize = () => {
      const tabIndex = TABS.indexOf(currentTab);
      if (containerRef.current && tabIndex !== -1) {
        containerRef.current.scrollLeft = tabIndex * containerRef.current.clientWidth;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [currentTab, isAnySubPageOrModalOpen]);

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
          {/* Desktop display: static view with max-w container to prevent overstretching on big screens */}
          <main className="hidden lg:block h-full w-full py-6 overflow-y-auto">
            {currentTab === 'today' && (
              <TodayView
                onOpenQuickAdd={handleOpenQuickAdd}
                onNavigateTab={handleTabChange}
                isActive={currentTab === 'today'}
                onSubPageChange={setIsTodaySubPageOpen}
              />
            )}
            {currentTab === 'stats' && <StatsView />}
            {currentTab === 'accounts' && (
              <AccountsView
                onSelectAccount={(acc) => setSelectedAccount(acc)}
                onOpenQuickAddWithAccount={handleOpenQuickAdd}
              />
            )}
            {currentTab === 'settings' && (
              <SettingsView
                isActive
                onSubPageChange={setIsSettingsSubPageOpen}
              />
            )}
          </main>

          {/* Mobile display: Horizontal swipe/drag scroll snap container (locked when subpage/modal is open) */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className={`lg:hidden flex-1 w-full flex ${
              isAnySubPageOrModalOpen
                ? 'overflow-x-hidden touch-pan-y'
                : 'overflow-x-auto page-carousel-container overscroll-x-none'
            } no-scrollbar`}
          >
            {/* View 1: Today */}
            <div className="w-full h-full shrink-0 page-carousel-item overflow-y-auto overscroll-y-contain pt-3">
              <TodayView
                onOpenQuickAdd={handleOpenQuickAdd}
                onNavigateTab={handleTabChange}
                isActive={currentTab === 'today'}
                onSubPageChange={setIsTodaySubPageOpen}
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
              <SettingsView
                isActive={currentTab === 'settings'}
                onSubPageChange={setIsSettingsSubPageOpen}
              />
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
