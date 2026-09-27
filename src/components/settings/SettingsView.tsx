import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Vibrate,
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
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { supabase } from '../../db/supabaseClient';
import { CustomSelect } from '../common/CustomSelect';
import type { Account } from '../../types/finance';

type SettingsSubPage = null | 'goals' | 'categories';

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
    className={`w-full flex items-center gap-3 py-3 px-4 text-left transition-colors cursor-pointer ${onClick ? 'active:bg-zinc-900/60' : 'cursor-default'}`}
  >
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-rose-900/40 text-rose-400' : 'bg-zinc-900 text-zinc-300'}`}>
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

const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${on ? 'bg-white' : 'bg-zinc-800'}`}
  >
    <div className={`w-5 h-5 rounded-full transition-transform ${on ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white/70'}`} />
  </button>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] font-bold font-mono uppercase tracking-widest text-zinc-500 px-1 pt-2 pb-1">{children}</div>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-[#101014] rounded-2xl border border-zinc-900/60 overflow-hidden divide-y divide-zinc-900/70">
    {children}
  </div>
);

// ─── Sub-pages ────────────────────────────────────────────────────

const GoalsSubPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { state, updateSettings } = useFinance();
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 cursor-pointer hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-base font-bold text-white font-mono">Spending Goals</h2>
      </div>
      <p className="text-[11px] text-zinc-500">Cap your outflows per day, week, and month. Leave blank to disable a limit.</p>
      <div className="space-y-3">
        {[
          { label: 'Daily Limit', key: 'daily' as const, placeholder: 'e.g. 500' },
          { label: 'Weekly Limit', key: 'weekly' as const, placeholder: 'e.g. 3,000' },
          { label: 'Monthly Limit', key: 'monthly' as const, placeholder: 'e.g. 15,000' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="text-[10px] text-zinc-400 font-mono uppercase font-bold block mb-1.5">{label}</label>
            <input
              type="number"
              placeholder={placeholder}
              value={state.settings.goals?.[key] || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || undefined;
                updateSettings({ goals: { ...state.settings.goals, [key]: val } });
              }}
              className="w-full bg-[#16161d] rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none border border-zinc-800/60 focus:border-zinc-600 transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const CategoriesSubPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { state, addCategory, deleteCategory } = useFinance();
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const categories = state.categories.filter((c) => c.type === tab);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addCategory({ name: newName.trim(), type: tab, icon: 'Tag' });
    setNewName('');
    setShowAdd(false);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 cursor-pointer hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-base font-bold text-white font-mono">Categories</h2>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 active:scale-95 text-black text-xs font-bold transition-all cursor-pointer"
        >
          <Plus size={13} strokeWidth={2.8} />
          Add
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#101014] p-1 rounded-xl border border-zinc-900 gap-1">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
              tab === t ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t === 'expense' ? 'Expenses' : 'Income'}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="flex gap-2 animate-fade-in">
          <input
            type="text"
            placeholder={`New ${tab} category`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            className="flex-1 bg-[#16161d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none border border-zinc-800/60 focus:border-zinc-600 transition-colors"
          />
          <button type="submit" className="px-4 py-2 bg-white text-black text-xs font-bold rounded-xl cursor-pointer active:scale-95 transition-all">Save</button>
        </form>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between bg-[#101014] border border-zinc-900/60 rounded-xl px-3 py-2.5 group">
            <span className="text-xs font-medium text-white truncate flex-1">{cat.name}</span>
            <button
              onClick={() => deleteCategory(cat.id)}
              className="text-zinc-700 hover:text-rose-400 transition-colors cursor-pointer ml-2 shrink-0 opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="col-span-2 text-center text-[11px] text-zinc-600 py-6">No {tab} categories yet</div>
        )}
      </div>
    </div>
  );
};

// ─── Main Settings View ───────────────────────────────────────────

export const SettingsView: React.FC = () => {
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
    addAccount({ name: newAccName.trim(), type: newAccType, initialBalance: parseFloat(newAccBalance) || 0, icon: newAccType === 'cash' ? 'Wallet' : 'CreditCard' });
    setNewAccName('');
    setNewAccBalance('0');
    setShowAddAcc(false);
  };

  // ── Sub-pages ──
  if (subPage === 'goals') return (
    <div className="space-y-6 pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
      <GoalsSubPage onBack={() => setSubPage(null)} />
    </div>
  );

  if (subPage === 'categories') return (
    <div className="space-y-6 pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none">
      <CategoriesSubPage onBack={() => setSubPage(null)} />
    </div>
  );

  // ── Main Settings ──
  return (
    <div className="pb-28 md:pb-12 px-4 md:px-8 w-full animate-fade-in select-none space-y-1">
      <div className="flex items-center justify-between pt-1 pb-3">
        <h2 className="text-xl font-bold tracking-tight text-white font-mono">SETTINGS</h2>
      </div>

      {importStatus && (
        <div className="p-3 rounded-xl bg-white text-black text-xs font-bold text-center animate-fade-in font-mono mb-3">
          {importStatus}
        </div>
      )}

      {/* ── Preferences ── */}
      <SectionLabel>Preferences</SectionLabel>
      <Card>
        {/* Currency Symbol + Code inline */}
        <div className="flex items-center gap-3 py-3 px-4">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
            <DollarSign size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">Currency</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={state.settings.currencySymbol}
              onChange={(e) => updateSettings({ currencySymbol: e.target.value })}
              className="w-10 h-7 text-center bg-[#16161d] rounded-lg text-xs text-white font-mono focus:outline-none border border-zinc-800/60"
              maxLength={3}
              title="Symbol"
            />
            <input
              type="text"
              value={state.settings.currencyCode}
              onChange={(e) => updateSettings({ currencyCode: e.target.value.toUpperCase() })}
              className="w-14 h-7 text-center bg-[#16161d] rounded-lg text-[11px] text-white font-mono focus:outline-none border border-zinc-800/60 uppercase"
              maxLength={4}
              title="Currency Code"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 py-3 px-4">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
            <Vibrate size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">Haptic Vibration</div>
            <div className="text-[10px] text-zinc-500">Feedback when logging on phone</div>
          </div>
          <Toggle on={!!state.settings.vibrateOnTap} onChange={() => updateSettings({ vibrateOnTap: !state.settings.vibrateOnTap })} />
        </div>

        <div className="flex items-center gap-3 py-3 px-4">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-300 shrink-0">
            <Keyboard size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">Quick Add Shortcut</div>
            <div className="text-[10px] text-zinc-500">Press key anywhere to add transaction</div>
          </div>
          <input
            type="text"
            maxLength={1}
            value={state.settings.quickAddKeybind || 'n'}
            onChange={(e) => {
              const val = e.target.value.trim().toLowerCase();
              if (val) updateSettings({ quickAddKeybind: val });
            }}
            className="w-9 h-8 text-center bg-[#16161d] rounded-xl text-xs font-mono font-bold text-white uppercase border border-zinc-800 focus:outline-none focus:border-white transition-colors shrink-0"
          />
        </div>
      </Card>

      {/* ── Manage ── */}
      <SectionLabel>Manage</SectionLabel>
      <Card>
        <Row
          icon={<Target size={15} />}
          title="Spending Goals"
          subtitle="Set daily, weekly and monthly limits"
          onClick={() => setSubPage('goals')}
        />
        <Row
          icon={<Tag size={15} />}
          title="Categories"
          subtitle="Manage expense & income categories"
          onClick={() => setSubPage('categories')}
        />
        <Row
          icon={<Wallet size={15} />}
          title={`Wallets & Accounts (${state.accounts.length})`}
          subtitle="Add or remove linked wallets"
          onClick={() => setShowWallets(!showWallets)}
          right={<ChevronRight size={15} className={`text-zinc-600 transition-transform ${showWallets ? 'rotate-90' : ''}`} />}
        />
        {showWallets && (
          <div className="px-4 pb-3 space-y-2 animate-fade-in">
            {/* Add wallet form */}
            {showAddAcc && (
              <form onSubmit={handleCreateAccount} className="space-y-2 bg-[#16161d] rounded-xl p-3 border border-zinc-800/60">
                <input
                  type="text"
                  placeholder="Wallet name (e.g. PayPal)"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full bg-[#101014] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
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
                  <input
                    type="number"
                    placeholder="Initial balance"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="bg-[#101014] rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddAcc(false)} className="px-3 py-1 text-xs text-zinc-400 cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-xl cursor-pointer">Save</button>
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
                    <button onClick={() => deleteAccount(acc.id)} className="text-zinc-700 hover:text-rose-400 p-1 cursor-pointer transition-colors">
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
              <Plus size={13} /> Add wallet
            </button>
          </div>
        )}
      </Card>

      {/* ── Data ── */}
      <SectionLabel>Data &amp; Backup</SectionLabel>
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
          title="Lock &amp; Sign Out"
          subtitle="Log out and lock the vault"
          onClick={() => {
            if (window.confirm('Lock vault and sign out?')) supabase?.auth.signOut();
          }}
        />
      </Card>
    </div>
  );
};
