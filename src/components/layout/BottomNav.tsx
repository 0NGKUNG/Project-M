import React from 'react';
import { Calendar, BarChart3, Wallet, Settings, Plus } from 'lucide-react';
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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#09090b]/95 backdrop-blur-xl border-t border-zinc-900/80 safe-bottom">
      <div className="flex items-center justify-around px-3 pt-2 pb-1.5 max-w-md mx-auto">
        <button
          onClick={() => onTabChange('today')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer ${
            currentTab === 'today' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Today"
        >
          <div className={`p-1 rounded-xl transition-colors ${currentTab === 'today' ? 'bg-zinc-800' : ''}`}>
            <Calendar size={19} strokeWidth={currentTab === 'today' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Today</span>
        </button>

        <button
          onClick={() => onTabChange('stats')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer ${
            currentTab === 'stats' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Stats"
        >
          <div className={`p-1 rounded-xl transition-colors ${currentTab === 'stats' ? 'bg-zinc-800' : ''}`}>
            <BarChart3 size={19} strokeWidth={currentTab === 'stats' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Stats</span>
        </button>

        {/* Center Quick Add Floating Button */}
        <div className="flex-1 flex justify-center -mt-5">
          <button
            onClick={onOpenQuickAdd}
            className="w-13 h-13 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-90 active:bg-zinc-200 transition-all cursor-pointer"
            aria-label="Quick Add Transaction"
          >
            <Plus size={26} strokeWidth={2.8} />
          </button>
        </div>

        <button
          onClick={() => onTabChange('accounts')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer ${
            currentTab === 'accounts' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Accounts"
        >
          <div className={`p-1 rounded-xl transition-colors ${currentTab === 'accounts' ? 'bg-zinc-800' : ''}`}>
            <Wallet size={19} strokeWidth={currentTab === 'accounts' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Accounts</span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95 cursor-pointer ${
            currentTab === 'settings' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label="Settings"
        >
          <div className={`p-1 rounded-xl transition-colors ${currentTab === 'settings' ? 'bg-zinc-800' : ''}`}>
            <Settings size={19} strokeWidth={currentTab === 'settings' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Settings</span>
        </button>
      </div>
    </nav>
  );
};
