import React from 'react';
import { LayoutDashboard, ReceiptText, Plus, Target, Settings } from 'lucide-react';
import type { NavTab } from './Sidebar';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  onOpenQuickAdd,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#09090b]/95 backdrop-blur-md border-t border-[#27272a] safe-bottom max-w-md mx-auto">
      <div className="flex items-center justify-around px-2 py-2">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 ${
            currentTab === 'dashboard' ? 'text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
          aria-label="Dashboard"
        >
          <div className={`p-1 rounded-xl transition-colors ${currentTab === 'dashboard' ? 'bg-[#18181b]' : ''}`}>
            <LayoutDashboard size={20} strokeWidth={currentTab === 'dashboard' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Overview</span>
        </button>

        <button
          onClick={() => onTabChange('transactions')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 ${
            currentTab === 'transactions' ? 'text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
          aria-label="Transactions"
        >
          <div className={`p-1 rounded-xl transition-colors ${currentTab === 'transactions' ? 'bg-[#18181b]' : ''}`}>
            <ReceiptText size={20} strokeWidth={currentTab === 'transactions' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">History</span>
        </button>

        {/* Center Quick Add Floating Button */}
        <div className="flex-1 flex justify-center -mt-5">
          <button
            onClick={onOpenQuickAdd}
            className="w-13 h-13 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-90 active:bg-zinc-200 transition-all cursor-pointer"
            aria-label="Quick Add Transaction"
          >
            <Plus size={28} strokeWidth={2.6} />
          </button>
        </div>

        <button
          onClick={() => onTabChange('budgets')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 ${
            currentTab === 'budgets' ? 'text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
          aria-label="Budgets"
        >
          <div className={`p-1 rounded-xl transition-colors ${currentTab === 'budgets' ? 'bg-[#18181b]' : ''}`}>
            <Target size={20} strokeWidth={currentTab === 'budgets' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Budgets</span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 ${
            currentTab === 'settings' ? 'text-white' : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
          aria-label="Settings"
        >
          <div className={`p-1 rounded-xl transition-colors ${currentTab === 'settings' ? 'bg-[#18181b]' : ''}`}>
            <Settings size={20} strokeWidth={currentTab === 'settings' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Settings</span>
        </button>
      </div>
    </nav>
  );
};
