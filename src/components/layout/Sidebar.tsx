import React from 'react';
import { LayoutDashboard, ReceiptText, Plus, Target, Settings } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

export type NavTab = 'dashboard' | 'transactions' | 'budgets' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onOpenQuickAdd,
}) => {
  const { state } = useFinance();
  const keybind = (state.settings.quickAddKeybind || 'n').toUpperCase();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions' as NavTab, label: 'Transactions', icon: ReceiptText },
    { id: 'budgets' as NavTab, label: 'Budgets & Goals', icon: Target },
    { id: 'settings' as NavTab, label: 'Settings & Vault', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-[#09090c] p-6 shrink-0 select-none justify-between">
      <div>
        {/* Brand Header with ∅ Null Set Symbol */}
        <div className="flex items-center gap-3.5 mb-8 px-2">
          <div className="w-10 h-10 rounded-2xl bg-white text-black font-mono font-bold flex items-center justify-center text-lg shadow-[0_4px_20px_rgba(255,255,255,0.18)]">
            ∅
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">NULLVAULT</h1>
              <span className="text-[10px] text-zinc-400 font-mono">v1.0</span>
            </div>
            <p className="text-[10px] text-zinc-500 font-mono tracking-wider">ongkung.me / vault</p>
          </div>
        </div>

        {/* Quick Add Action Button */}
        <div className="mb-8">
          <button
            onClick={onOpenQuickAdd}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-zinc-100 active:scale-98 text-black text-xs font-bold flex items-center justify-between shadow-[0_4px_24px_rgba(255,255,255,0.15)] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Plus size={18} strokeWidth={2.8} />
              <span>New Transaction</span>
            </div>
            <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-zinc-100 border border-zinc-300/80 text-[10px] font-mono font-semibold text-zinc-600 shadow-[0_1px_1px_rgba(0,0,0,0.06)] group-hover:border-zinc-400/80 transition-colors uppercase">
              {keybind}
            </kbd>
          </button>
        </div>

        {/* Nav Menu */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-800 text-white font-bold shadow-inner'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                }`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-zinc-500'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer Card */}
      <div className="bg-[#101014] rounded-2xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300 shrink-0 font-mono font-bold text-sm">
          ∅
        </div>
        <div className="text-[11px]">
          <div className="text-zinc-300 font-medium">Sovereign Vault</div>
          <div className="text-zinc-500 text-[10px]">Zero leak • Local / Cloud</div>
        </div>
      </div>
    </aside>
  );
};
