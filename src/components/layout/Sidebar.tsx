import React from 'react';
import { Calendar, BarChart3, Wallet, Settings, Plus, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
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
    { id: 'today'    as NavTab, label: 'Today (Flow)',     icon: Calendar  },
    { id: 'stats'    as NavTab, label: 'Stats & Trends',   icon: BarChart3 },
    { id: 'accounts' as NavTab, label: 'Accounts & Net',   icon: Wallet    },
    { id: 'settings' as NavTab, label: 'Vault & Settings', icon: Settings  },
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
        className="absolute top-5 -right-4 z-30 w-8 h-8 rounded-full bg-[#18181d] border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-500 flex items-center justify-center text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-all cursor-pointer shadow-lg"
      >
        {collapsed ? <ChevronRight size={16} strokeWidth={2.5} /> : <ChevronLeft size={16} strokeWidth={2.5} />}
      </button>

      {/* ── Top section ── */}
      <div className="flex flex-col p-6">

        {/* Brand */}
        <div className="mb-8 flex h-8 items-center overflow-hidden">
          <h1 className="text-2xl font-extrabold text-white leading-tight font-display tracking-wider">
            {collapsed ? 'N' : 'NØVA'}
          </h1>
        </div>

        {/* Quick Add */}
        <div className="mb-8">
          {collapsed ? (
            <button
              onClick={onOpenQuickAdd}
              title={`New Transaction (${keybind})`}
              aria-label={`New Transaction (${keybind})`}
              className="w-full h-12 flex items-center justify-center rounded-2xl bg-white hover:bg-zinc-100 active:scale-95 text-black transition-all cursor-pointer shadow-[0_4px_24px_rgba(255,255,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Plus size={18} strokeWidth={2.8} />
            </button>
          ) : (
            <button
              onClick={onOpenQuickAdd}
              className="w-full h-12 px-4 rounded-2xl bg-white hover:bg-zinc-100 active:scale-98 text-black text-xs font-bold flex items-center justify-between shadow-[0_4px_24px_rgba(255,255,255,0.12)] transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <div className="flex items-center gap-2">
                <Plus size={18} strokeWidth={2.8} />
                <span>New Transaction</span>
              </div>
              <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-zinc-100 border border-zinc-300/80 text-[10px] font-mono font-semibold text-zinc-600 shadow-[0_1px_1px_rgba(0,0,0,0.06)] group-hover:border-zinc-400/80 transition-colors uppercase">
                {keybind}
              </kbd>
            </button>
          )}
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
                  ${collapsed ? 'justify-center px-2' : 'px-4'}
                  ${isActive
                    ? 'bg-zinc-800 text-white font-bold shadow-inner'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                  }
                `}
              >
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? 'text-white shrink-0' : 'text-zinc-500 shrink-0'}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Footer ── */}
      <div className="p-6">
        {collapsed ? (
          <div
            title="Sovereign Vault — Zero leak • Local / Cloud"
            className="w-full flex items-center justify-center p-2 rounded-xl bg-[#101014] border border-zinc-900/60"
          >
            <Shield size={16} className="text-zinc-400 shrink-0" />
          </div>
        ) : (
          <div className="bg-[#101014] rounded-2xl p-4 flex items-center gap-3 border border-zinc-900/60">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-400 shrink-0">
              <Shield size={16} />
            </div>
            <div className="text-[11px] overflow-hidden">
              <div className="text-zinc-300 font-medium truncate">Sovereign Vault</div>
              <div className="text-zinc-500 text-[10px] truncate">Zero leak • Local / Cloud</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
