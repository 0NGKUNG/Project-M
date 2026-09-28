import React from 'react';
import { Calendar, BarChart3, Wallet, Settings, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

export type NavTab = 'today' | 'stats' | 'accounts' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onOpenQuickAdd,
  collapsed,
  onToggleCollapse,
}) => {
  const { state } = useFinance();
  const keybind = (state.settings.quickAddKeybind || 'n').toUpperCase();

  const navItems = [
    { id: 'today'    as NavTab, label: 'Today',    icon: Calendar  },
    { id: 'stats'    as NavTab, label: 'Stats',    icon: BarChart3 },
    { id: 'accounts' as NavTab, label: 'Accounts', icon: Wallet    },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings  },
  ];

  return (
    <aside
      className={`
        hidden lg:flex flex-col bg-[#09090c] shrink-0 select-none justify-between
        transition-[width] duration-300 ease-in-out overflow-visible relative
        ${collapsed ? 'w-24' : 'w-72'}
      `}
    >
      {/* Keep the toggle outside the content column so it never competes with the wordmark. */}
      <button
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute top-6 -right-4 z-30 w-8 h-8 rounded-full bg-[#18181d] border border-zinc-700 shadow-[0_4px_16px_rgba(0,0,0,0.55)] hover:bg-zinc-700 hover:border-zinc-500 hover:scale-105 flex items-center justify-center text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-all cursor-pointer"
      >
        {collapsed ? <ChevronRight size={16} strokeWidth={2.5} /> : <ChevronLeft size={16} strokeWidth={2.5} />}
      </button>

      {/* ── Top section ── */}
      <div className="flex flex-col p-6">

        {/* Brand */}
        <div className="relative mb-8 flex h-8 items-center overflow-hidden">
          <h1 className={`text-2xl font-extrabold text-white leading-tight font-display tracking-wider transition-transform duration-300 ease-in-out ${collapsed ? 'translate-x-3.5' : 'translate-x-0'}`}>
            N<span className={`inline-block overflow-hidden align-bottom transition-[max-width,opacity] duration-300 ease-in-out ${collapsed ? 'max-w-0 opacity-0' : 'max-w-20 opacity-100'}`}>ØVA</span>
          </h1>
        </div>

        {/* Quick Add */}
        <div className="mb-8">
          <button
            onClick={onOpenQuickAdd}
            title={`New Transaction (${keybind})`}
            aria-label={`New Transaction (${keybind})`}
            className="relative w-full h-12 px-4 rounded-2xl bg-white hover:bg-zinc-100 active:scale-[0.98] text-black text-xs font-bold flex items-center justify-start shadow-[0_4px_24px_rgba(255,255,255,0.12)] transition-[background-color,transform] cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Plus size={18} strokeWidth={2.8} className="shrink-0" />
            <span className={`ml-2 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out ${collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'}`}>
              New Transaction
            </span>
            <kbd className={`absolute right-4 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-zinc-100 border border-zinc-300/80 text-[10px] font-mono font-semibold text-zinc-600 shadow-[0_1px_1px_rgba(0,0,0,0.06)] transition-opacity duration-200 uppercase ${collapsed ? 'opacity-0' : 'opacity-100 group-hover:border-zinc-400/80'}`}>
              {keybind}
            </kbd>
          </button>
        </div>

        {/* Nav items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={collapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer
                  h-11
                  px-1
                  ${isActive
                    ? 'bg-zinc-800 text-white font-bold shadow-inner'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                  }
                `}
              >
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`shrink-0 transition-[margin] duration-300 ease-in-out ${collapsed ? 'ml-[10px]' : 'ml-0'} ${isActive ? 'text-white' : 'text-zinc-500'}`}
                />
                <span className={`overflow-hidden whitespace-nowrap truncate transition-[max-width,opacity] duration-200 ease-in-out ${collapsed ? 'max-w-0 opacity-0' : 'max-w-40 opacity-100'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

    </aside>
  );
};
