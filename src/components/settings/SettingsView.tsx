import React, { useRef, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Upload,
  Trash2,
  Plus,
  CreditCard,
  LogOut,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Target,
  Tag,
  Keyboard,
  DollarSign,
  Wallet,
  CalendarDays,
  X,
  RefreshCw,
  HandCoins,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { supabase } from '../../db/supabaseClient';
import { RecurringManager } from '../recurring/RecurringManager';
import { DebtManager } from '../debts/DebtManager';
import { CustomSelect } from '../common/CustomSelect';
import { BudgetsPage } from '../budgets/BudgetsPage';
import { FloatingClose } from '../common/FloatingClose';
import { CurrencyInput, parseFormattedNumber } from '../common/CurrencyInput';
import { CategoryIcon } from '../common/Icons';
import type { Account, Category } from '../../types/finance';
import { useBackButton } from '../../hooks/useBackButton';

type SettingsSubPage = null | 'goals' | 'categories' | 'recurring' | 'debts';

interface SettingsViewProps {
  /** Whether Settings is the visible tab — the mobile carousel keeps all views mounted, so fixed overlays must be gated on this. */
  isActive?: boolean;
  /** Notifies parent when subpage opens/closes (used to lock mobile swipe navigation). */
  onSubPageChange?: (hasSubPage: boolean) => void;
}

// ─── Row components ───────────────────────────────────────────────

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}> = ({ icon, title, subtitle, right, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 py-3.5 px-4 min-h-[58px] text-left transition-colors cursor-pointer first:rounded-t-2xl last:rounded-b-2xl ${
      onClick ? 'active:bg-zinc-900/60 hover:bg-zinc-900/40' : 'cursor-default'
    }`}
  >
    <div
      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        danger ? 'bg-rose-900/40 text-rose-400' : 'bg-zinc-900 text-zinc-300'
      }`}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className={`text-[13px] font-medium leading-tight ${danger ? 'text-rose-400' : 'text-white'}`}>{title}</div>
      {subtitle && <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{subtitle}</div>}
    </div>
    {right !== undefined ? (
      right
    ) : onClick ? (
      <ChevronRight size={15} className="text-zinc-600 shrink-0" />
    ) : null}
  </button>
);


const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500 px-1 pt-2 pb-1">{children}</div>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-[#101014] rounded-2xl border border-zinc-900/60 divide-y divide-zinc-900/70">
    {children}
  </div>
);

// ─── Sub-page 1: Spending Goals (Range + Category breakdown) ──────────

const CategoriesSubPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { state, addCategory, deleteCategory } = useFinance();
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  // Root is a stretching flex column so the empty state can fill leftover height on desktop.

  // Modals
  const [selectedParentCat, setSelectedParentCat] = useState<Category | null>(null);
  const [showAddParentModal, setShowAddParentModal] = useState(false);
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Tag');

  useBackButton(
    Boolean(selectedParentCat || showAddParentModal || showAddSubModal),
    () => {
      if (showAddSubModal) setShowAddSubModal(false);
      else if (showAddParentModal) setShowAddParentModal(false);
      else if (selectedParentCat) setSelectedParentCat(null);
    }
  );

  // Filter top-level parents and their subcategories
  const parentCategories = useMemo(
    () => state.categories.filter((c) => c.type === tab && !c.parentId),
    [state.categories, tab]
  );

  const getSubcategories = (parentId: string) => {
    return state.categories.filter((c) => c.parentId === parentId);
  };

  const handleCreateParent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory({
      name: newCatName.trim(),
      type: tab,
      icon: newCatIcon || 'Tag',
    });
    setNewCatName('');
    setShowAddParentModal(false);
  };

  const handleCreateSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !selectedParentCat) return;
    addCategory({
      name: newCatName.trim(),
      type: tab,
      icon: 'Tag',
      parentId: selectedParentCat.id,
    });
    setNewCatName('');
    setShowAddSubModal(false);
  };

  const availableIcons = [
    'Utensils',
    'Coffee',
    'ShoppingCart',
    'Car',
    'Home',
    'Film',
    'ShoppingBag',
    'HeartPulse',
    'Laptop',
    'Briefcase',
    'Zap',
    'TrendingUp',
    'Wallet',
    'Target',
    'Tag',
  ];

  return (
    <div className="space-y-3 animate-fade-in min-h-full flex flex-col flex-1">
      {/* Header */}
      <div className="h-8 flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="hidden sm:flex w-8 h-8 rounded-xl bg-zinc-900 items-center justify-center text-zinc-300 cursor-pointer hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono">CATEGORIES</h2>
        </div>

        <button
          onClick={() => {
            setNewCatName('');
            setNewCatIcon('Tag');
            setShowAddParentModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          <Plus size={13} strokeWidth={2.8} />
          Add Category
        </button>
      </div>

      {/* Expense / Income Pill Switcher */}
      <div className="flex bg-[#101014] p-1 rounded-xl border border-zinc-900 gap-1">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer capitalize ${
              tab === t ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t === 'expense' ? 'Expenses' : 'Income'}
          </button>
        ))}
      </div>

      {/* Grid of Categories (1 col mobile, 2 col sm, 3 col md, 4 col lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {parentCategories.map((cat) => {
          const subs = getSubcategories(cat.id);

          return (
            <div
              key={cat.id}
              onClick={() => setSelectedParentCat(cat)}
              className="p-3 rounded-2xl bg-[#101014] border border-zinc-900/60 hover:border-zinc-700 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-98 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-white transition-colors shrink-0">
                  <CategoryIcon name={cat.icon || 'Tag'} size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{cat.name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono leading-tight truncate">
                    {subs.length > 0 ? `${subs.length} subcategories` : 'No subcategories'}
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-zinc-600 font-mono group-hover:text-zinc-400 transition-colors shrink-0 px-1">
                ☰
              </div>
            </div>
          );
        })}
      </div>

      {parentCategories.length === 0 && (
        <div className="p-8 rounded-2xl bg-[#101014] border border-zinc-900/60 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
            <Tag size={18} />
          </div>
          <div className="text-xs text-zinc-400 font-medium">No {tab} categories yet</div>
          <button
            onClick={() => {
              setNewCatName('');
              setNewCatIcon('Tag');
              setShowAddParentModal(true);
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold cursor-pointer"
          >
            <Plus size={13} /> Add Category
          </button>
        </div>
      )}

      {/* Parent Category Action Modal (Matching 3rd reference screenshot) */}
      {selectedParentCat &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
            onClick={() => setSelectedParentCat(null)}
          >
            <div
              className="w-full sm:max-w-md max-h-[85dvh] bg-[#0c0c10] border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-3 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-white shrink-0">
                    <CategoryIcon name={selectedParentCat.icon || 'Tag'} size={17} />
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-bold text-white truncate">{selectedParentCat.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono uppercase">
                      {selectedParentCat.type} Category
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedParentCat(null)}
                  className="p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Subcategories list inside */}
                {(() => {
                  const subs = getSubcategories(selectedParentCat.id);
                  return (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-mono uppercase text-zinc-500 font-bold px-1">
                        Subcategories ({subs.length})
                      </div>
                      <div className="space-y-1 pr-1">
                        {subs.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-[#14141c] border border-zinc-800/60 text-xs"
                          >
                            <span className="text-zinc-200 truncate">{sub.name}</span>
                            <button
                              onClick={() => deleteCategory(sub.id)}
                              className="text-zinc-600 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        {subs.length === 0 && (
                          <div className="text-[11px] text-zinc-500 italic py-3 text-center bg-[#14141c]/50 rounded-xl border border-zinc-800/40">
                            No subcategories added yet
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Add Subcategory Trigger Button */}
                <button
                  onClick={() => {
                    setNewCatName('');
                    setShowAddSubModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#14141c] hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-white transition-all cursor-pointer font-mono"
                >
                  <Plus size={14} /> Add Subcategory
                </button>
              </div>

              {/* Modal Bottom Actions (Delete vs Done) */}
              <div className="p-4 sm:p-6 border-t border-zinc-800/80 bg-[#0c0c10] flex items-center gap-2.5 shrink-0 safe-bottom">
                <button
                  onClick={() => {
                    deleteCategory(selectedParentCat.id);
                    setSelectedParentCat(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-950/60 hover:text-rose-400 text-zinc-400 text-xs font-mono font-bold transition-colors cursor-pointer"
                >
                  Delete Category
                </button>
                <button
                  onClick={() => setSelectedParentCat(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-mono font-bold transition-all cursor-pointer shadow-md"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Add Subcategory Inline Modal */}
      {showAddSubModal && selectedParentCat &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
            onClick={() => setShowAddSubModal(false)}
          >
            <div
              className="w-full sm:max-w-sm max-h-[85dvh] bg-[#0c0c10] border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-3 border-b border-zinc-800/80 shrink-0">
                <h3 className="text-sm font-bold text-white font-mono">
                  Add to {selectedParentCat.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddSubModal(false)}
                  className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
              <form onSubmit={handleCreateSubcategory} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1">
                    Subcategory Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Coffee, Taxi, Internet"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    autoFocus
                    className="w-full h-11 bg-[#14141c] rounded-xl px-3.5 text-xs text-white focus:outline-none border border-zinc-800/80 focus:border-zinc-500 font-mono"
                    required
                  />
                </div>
                <div className="p-4 sm:p-6 border-t border-zinc-800/80 bg-[#0c0c10] flex justify-end gap-2.5 shrink-0 safe-bottom">
                  <button
                    type="button"
                    onClick={() => setShowAddSubModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-400 hover:text-white cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-white text-black text-xs font-bold font-mono rounded-xl cursor-pointer active:scale-95 shadow-md"
                  >
                    Add Subcategory
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Add Top-Level Category Modal */}
      {showAddParentModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
            onClick={() => setShowAddParentModal(false)}
          >
            <div
              className="w-full sm:max-w-md md:max-w-lg max-h-[85dvh] bg-[#0c0c10] border border-zinc-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-3 border-b border-zinc-800/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                    <Tag size={16} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-mono capitalize">
                    New {tab} Category
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddParentModal(false)}
                  className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateParent} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                      Category Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Essentials, Savings, Entertainment"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      autoFocus
                      className="w-full h-11 bg-[#14141c] rounded-xl px-3.5 text-xs text-white focus:outline-none border border-zinc-800/80 focus:border-zinc-500 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">
                      Icon
                    </label>
                    <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 gap-1.5 max-h-48 overflow-y-auto p-2 bg-[#14141c] rounded-xl border border-zinc-800/60">
                      {availableIcons.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setNewCatIcon(ic)}
                          className={`p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                            newCatIcon === ic
                              ? 'bg-white text-black font-bold shadow-xs'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          <CategoryIcon name={ic} size={15} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-zinc-800/80 bg-[#0c0c10] flex justify-end gap-2.5 shrink-0 safe-bottom">
                  <button
                    type="button"
                    onClick={() => setShowAddParentModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-mono text-zinc-400 hover:text-white cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-white text-black text-xs font-bold font-mono rounded-xl cursor-pointer active:scale-95 hover:bg-zinc-200 transition-all shadow-md"
                  >
                    Create Category
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

// ─── Main Settings View ───────────────────────────────────────────

export const SettingsView: React.FC<SettingsViewProps> = ({ isActive, onSubPageChange }) => {
  const {
    state,
    updateSettings,
    exportDataJSON,
    importDataJSON,
    clearAllData,
    addAccount,
    deleteAccount,
  } = useFinance();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [subPage, setSubPage] = useState<SettingsSubPage>(null);
  useBackButton(Boolean(subPage), () => setSubPage(null));

  useEffect(() => {
    onSubPageChange?.(subPage !== null);
    return () => {
      onSubPageChange?.(false);
    };
  }, [subPage, onSubPageChange]);

  // Re-tapping Settings pops sub-pages; switching to another tab closes them so returning shows the main list.
  useEffect(() => {
    const handleTabRetap = (e: Event) => {
      if ((e as CustomEvent).detail === 'settings') setSubPage(null);
    };
    const handleTabChanged = () => setSubPage(null);
    window.addEventListener('nova:tab-retap', handleTabRetap);
    window.addEventListener('nova:tab-changed', handleTabChanged);
    return () => {
      window.removeEventListener('nova:tab-retap', handleTabRetap);
      window.removeEventListener('nova:tab-changed', handleTabChanged);
    };
  }, []);
  const [showWallets, setShowWallets] = useState(false);
  const [showAddAcc, setShowAddAcc] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<Account['type']>('bank');
  const [newAccBalance, setNewAccBalance] = useState('0');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJSON(content);
        setImportStatus(success ? 'Backup restored!' : 'Invalid backup file.');
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    addAccount({
      name: newAccName.trim(),
      type: newAccType,
      initialBalance: parseFormattedNumber(newAccBalance),
      icon: newAccType === 'cash' ? 'Wallet' : 'CreditCard',
    });
    setNewAccName('');
    setNewAccBalance('0');
    setShowAddAcc(false);
  };

  // ── Sub-pages ──
  if (subPage === 'goals')
    return (
      <div className="space-y-6 pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 px-4 md:px-8 w-full animate-fade-in select-none min-h-full flex flex-col">
        <BudgetsPage onBack={() => setSubPage(null)} />
        {isActive && <FloatingClose onClick={() => setSubPage(null)} />}
      </div>
    );

  if (subPage === 'categories')
    return (
      <div className="space-y-6 pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 px-4 md:px-8 w-full animate-fade-in select-none min-h-full flex flex-col">
        <CategoriesSubPage onBack={() => setSubPage(null)} />
        {isActive && <FloatingClose onClick={() => setSubPage(null)} />}
      </div>
    );

  if (subPage === 'recurring')
    return (
      <div className="space-y-6 pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 px-4 md:px-8 w-full animate-fade-in select-none min-h-full flex flex-col">
        <RecurringManager onBack={() => setSubPage(null)} />
        {isActive && <FloatingClose onClick={() => setSubPage(null)} />}
      </div>
    );

  if (subPage === 'debts')
    return (
      <div className="space-y-6 pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 px-4 md:px-8 w-full animate-fade-in select-none min-h-full flex flex-col">
        <DebtManager onBack={() => setSubPage(null)} />
        {isActive && <FloatingClose onClick={() => setSubPage(null)} />}
      </div>
    );

  // ── Main Settings ──
  return (
    <div className="pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-8 px-4 md:px-8 w-full animate-fade-in select-none space-y-3">
      <div className="h-8 flex items-center justify-between pt-1">
        <h2 className="text-xl font-bold tracking-tight text-white font-mono">SETTINGS</h2>
      </div>

      {importStatus && (
        <div className="p-3 rounded-xl bg-white text-black text-xs font-bold text-center animate-fade-in font-mono mb-3">
          {importStatus}
        </div>
      )}

      {/* ── Preferences ── */}
      <Card>
        {/* Currency Symbol + Code inline */}
        <div className="flex items-center gap-3 py-3.5 px-4 min-h-[58px]">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
            <DollarSign size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">Currency</div>
            <div className="text-[10px] text-zinc-500 font-mono">
              Active: {state.settings.currencySymbol} ({state.settings.currencyCode})
            </div>
          </div>
          <div className="w-40 shrink-0">
            <CustomSelect
              value={`${state.settings.currencySymbol}|${state.settings.currencyCode}`}
              onChange={(val) => {
                const [sym, code] = val.split('|');
                updateSettings({ currencySymbol: sym, currencyCode: code });
              }}
              options={[
                { value: '฿|THB', label: '฿ THB (Baht)' },
                { value: '$|USD', label: '$ USD (Dollar)' },
                { value: '€|EUR', label: '€ EUR (Euro)' },
                { value: '¥|JPY', label: '¥ JPY (Yen)' },
                { value: '£|GBP', label: '£ GBP (Pound)' },
                { value: 'S$|SGD', label: 'S$ SGD (Singapore)' },
                { value: 'A$|AUD', label: 'A$ AUD (Australia)' },
                { value: '₩|KRW', label: '₩ KRW (Won)' },
                { value: '¥|CNY', label: '¥ CNY (Yuan)' },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 py-3.5 px-4 min-h-[58px]">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
            <CalendarDays size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">Start Day of Week</div>
            <div className="text-[10px] text-zinc-500 font-mono">
              Calendar — weekly calculations
            </div>
          </div>
          <div className="w-40 shrink-0">
            <CustomSelect
              value={String(state.settings.weekStartDay ?? 1)}
              onChange={(val) => {
                const day = parseInt(val, 10) as 0 | 1 | 6;
                updateSettings({ weekStartDay: day });
              }}
              options={[
                { value: '1', label: 'Monday' },
                { value: '0', label: 'Sunday' },
                { value: '6', label: 'Saturday' },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 py-3.5 px-4 min-h-[58px]">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
            <Keyboard size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">Quick Add Shortcut</div>
          </div>
          <input
            type="text"
            maxLength={1}
            value={state.settings.quickAddKeybind || 'n'}
            onChange={(e) => {
              const val = e.target.value.trim().toLowerCase();
              if (val) updateSettings({ quickAddKeybind: val });
            }}
            className="w-10 h-9 text-center bg-[#16161d] rounded-xl text-xs font-mono font-bold text-white uppercase border border-zinc-800 focus:outline-none focus:border-white transition-colors shrink-0"
          />
        </div>
      </Card>

      {/* ── Manage ── */}
      <SectionLabel>Manage</SectionLabel>
      <Card>
        <Row
          icon={<Tag size={15} />}
          title="Categories"
          subtitle="Manage parent and subcategories"
          onClick={() => setSubPage('categories')}
        />
        <Row
          icon={<Target size={15} />}
          title="Budgets"            subtitle="Set range budgets and category allocations"
          onClick={() => setSubPage('goals')}
        />
        <Row
          icon={<RefreshCw size={15} />}
          title={`Recurring (${state.recurring?.length || 0})`}
          subtitle="Manage scheduled bills, salaries and subscriptions"
          onClick={() => setSubPage('recurring')}
        />
        <Row
          icon={<HandCoins size={15} />}
          title={`Debts (${state.debts?.filter((d) => d.status === 'active').length || 0})`}
          subtitle="Track money lent to friends or borrowed amounts"
          onClick={() => setSubPage('debts')}
        />
        <Row
          icon={<Wallet size={15} />}
          title={`Accounts (${state.accounts.length})`}
          subtitle="Add or remove linked accounts"
          onClick={() => setShowWallets(!showWallets)}
          right={
            <ChevronRight
              size={15}
              className={`text-zinc-600 transition-transform ${showWallets ? 'rotate-90' : ''}`}
            />
          }
        />
        {showWallets && (
          <div className="px-4 pb-3 space-y-2 animate-fade-in">
            {/* Add wallet form */}
            {showAddAcc && (
              <form
                onSubmit={handleCreateAccount}
                className="space-y-2 bg-[#16161d] rounded-xl p-3 border border-zinc-800/60"
              >
                <input
                  type="text"
                  placeholder="Account name (e.g. PayPal)"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full h-11 bg-[#101014] rounded-xl px-3.5 text-xs text-white focus:outline-none border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <CustomSelect
                    value={newAccType}
                    onChange={(val) => setNewAccType(val as Account['type'])}
                    options={[
                      { value: 'bank', label: 'Bank' },
                      { value: 'cash', label: 'Cash' },
                      { value: 'credit', label: 'Credit' },
                      { value: 'savings', label: 'Savings' },
                      { value: 'investment', label: 'Investment' },
                    ]}
                  />
                  <CurrencyInput
                    currencySymbol={state.settings.currencySymbol}
                    type="number"
                    placeholder="Initial balance"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full h-11 bg-[#101014] rounded-xl px-3.5 text-xs text-white focus:outline-none font-mono border border-zinc-800/80 focus:border-zinc-600 transition-colors"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAcc(false)}
                    className="px-3 py-1 text-xs text-zinc-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}
            <div className="divide-y divide-zinc-900/60">
              {state.accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <CreditCard size={13} className="text-zinc-500" />
                    <span className="text-xs text-white">{acc.name}</span>
                    <span className="text-[9px] text-zinc-600 uppercase font-mono">({acc.type})</span>
                  </div>
                  {state.accounts.length > 1 && (
                    <button
                      onClick={() => deleteAccount(acc.id)}
                      className="text-zinc-700 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowAddAcc(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors mt-1"
            >
              <Plus size={13} /> Add account
            </button>
          </div>
        )}
      </Card>

      {/* ── Data ── */}
      <SectionLabel>Data</SectionLabel>
      <Card>
        <Row
          icon={<Download size={15} />}
          title="Export Backup"
          subtitle="Save a JSON file of all your data"
          onClick={exportDataJSON}
        />
        <Row
          icon={<Upload size={15} />}
          title="Restore Backup"
          subtitle="Import a previously exported JSON file"
          onClick={() => fileInputRef.current?.click()}
        />
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
        <Row
          icon={<Trash2 size={15} />}
          title="Reset All Data"
          subtitle="Erase everything and start fresh"
          danger
          onClick={() => {
            if (window.confirm('Erase all data and reset to defaults?')) clearAllData();
          }}
        />
      </Card>

      {/* ── Security ── */}
      <SectionLabel>Security</SectionLabel>
      <Card>
        <div className="flex items-center gap-3 py-3 px-4">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck size={15} />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-medium text-white">Owner Vault</div>
            <div className="text-[10px] text-zinc-500">Encrypted Supabase Auth — stays signed in</div>
          </div>
        </div>
        <Row
          icon={<LogOut size={15} />}
          title="Sign Out"
          subtitle="Log out and lock the vault"
          onClick={() => {
            if (window.confirm('Lock vault and sign out?')) supabase?.auth.signOut();
          }}
        />
      </Card>
    </div>
  );
};
