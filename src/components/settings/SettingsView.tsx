import React, { useRef, useState } from 'react';
import { 
  Download, 
  Upload, 
  Trash2, 
  Vibrate, 
  Plus, 
  CreditCard,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { supabase } from '../../db/supabaseClient';
import { CustomSelect } from '../common/CustomSelect';
import type { Account } from '../../types/finance';

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
        if (success) {
          setImportStatus('Backup restored successfully!');
          setTimeout(() => setImportStatus(null), 3500);
        } else {
          setImportStatus('Invalid backup file format.');
          setTimeout(() => setImportStatus(null), 3500);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;

    addAccount({
      name: newAccName.trim(),
      type: newAccType,
      initialBalance: parseFloat(newAccBalance) || 0,
      icon: newAccType === 'cash' ? 'Wallet' : 'CreditCard',
    });

    setNewAccName('');
    setNewAccBalance('0');
    setShowAddAcc(false);
  };

  return (
    <div className="space-y-5 pb-24 md:pb-12 safe-top px-4 md:px-8 w-full animate-fade-in">
      <div className="pt-1">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">Settings & Vault</h2>
        <p className="text-xs text-zinc-500 font-mono mt-0.5">Preferences, Wallets & Offline Backups</p>
      </div>

      {importStatus && (
        <div className="p-3.5 rounded-2xl bg-white text-black text-xs font-bold text-center animate-fade-in">
          {importStatus}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Currency & Interface Preference */}
        <div className="bg-[#101014] rounded-3xl p-6 space-y-4 shadow-sm">
          <span className="text-xs font-mono uppercase font-bold tracking-wider text-zinc-400 block">
            Currency Preference
          </span>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1.5">
                Symbol
              </label>
              <input
                type="text"
                value={state.settings.currencySymbol}
                onChange={(e) => updateSettings({ currencySymbol: e.target.value })}
                className="w-full bg-[#16161d] rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1.5">
                Currency Code
              </label>
              <input
                type="text"
                value={state.settings.currencyCode}
                onChange={(e) => updateSettings({ currencyCode: e.target.value.toUpperCase() })}
                className="w-full bg-[#16161d] rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono uppercase"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Vibrate size={18} className="text-zinc-400" />
              <div>
                <div className="text-xs text-white font-medium">Tactile Vibration</div>
                <div className="text-[10px] text-zinc-500">Haptic feedback when logging on phones</div>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ vibrateOnTap: !state.settings.vibrateOnTap })}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                state.settings.vibrateOnTap ? 'bg-white' : 'bg-zinc-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full transition-transform ${
                  state.settings.vibrateOnTap ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white/70'
                }`}
              />
            </button>
          </div>

          <div className="pt-3 border-t border-zinc-900 flex items-center justify-between">
            <div>
              <div className="text-xs text-white font-medium">Quick Add Shortcut (PC/Laptop)</div>
              <div className="text-[10px] text-zinc-500">Press this key anywhere to open Add Transaction</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={1}
                value={state.settings.quickAddKeybind || 'n'}
                onChange={(e) => {
                  const val = e.target.value.trim().toLowerCase();
                  if (val) updateSettings({ quickAddKeybind: val });
                }}
                className="w-10 h-9 text-center bg-[#16161d] rounded-xl text-xs font-mono font-bold text-white uppercase border border-zinc-800 focus:outline-none focus:border-white transition-colors"
                title="Single letter keybind (default: N)"
              />
            </div>
          </div>

          {/* Spending Goals (Day, Week, Month) */}
          <div className="pt-3 border-t border-zinc-900 space-y-2">
            <div>
              <div className="text-xs text-white font-medium">Spending Goals & Limits</div>
              <div className="text-[10px] text-zinc-500">Cap your outflows per day, week, and month</div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-mono block mb-1">Day Limit</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={state.settings.goals?.daily || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || undefined;
                    updateSettings({ goals: { ...state.settings.goals, daily: val } });
                  }}
                  className="w-full bg-[#16161d] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-mono block mb-1">Week Limit</label>
                <input
                  type="number"
                  placeholder="e.g. 3000"
                  value={state.settings.goals?.weekly || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || undefined;
                    updateSettings({ goals: { ...state.settings.goals, weekly: val } });
                  }}
                  className="w-full bg-[#16161d] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 uppercase font-mono block mb-1">Month Limit</label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={state.settings.goals?.monthly || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || undefined;
                    updateSettings({ goals: { ...state.settings.goals, monthly: val } });
                  }}
                  className="w-full bg-[#16161d] rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Wallets & Accounts Management */}
        <div className="bg-[#101014] rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase font-bold tracking-wider text-zinc-400">
              Wallets & Accounts ({state.accounts.length})
            </span>
            <button
              onClick={() => setShowAddAcc(!showAddAcc)}
              className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white cursor-pointer font-medium"
            >
              <Plus size={14} /> Add Wallet
            </button>
          </div>

          {showAddAcc && (
            <form onSubmit={handleCreateAccount} className="bg-[#16161d] p-4 rounded-2xl space-y-3">
              <input
                type="text"
                placeholder="Account name (e.g. PayPal, Vault)"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="w-full bg-[#101014] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <CustomSelect
                  value={newAccType}
                  onChange={(val) => setNewAccType(val as Account['type'])}
                  options={[
                    { value: 'bank', label: 'Bank' },
                    { value: 'cash', label: 'Cash' },
                    { value: 'credit', label: 'Credit Card' },
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
              <div className="flex justify-end gap-2 pt-1">
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

          <div className="divide-y divide-zinc-900 max-h-56 overflow-y-auto pr-1">
            {state.accounts.map((acc) => (
              <div key={acc.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <CreditCard size={15} className="text-zinc-500" />
                  <span className="text-white font-medium">{acc.name}</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-mono">({acc.type})</span>
                </div>
                {state.accounts.length > 1 && (
                  <button
                    onClick={() => deleteAccount(acc.id)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                    aria-label="Remove account"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Backup and Data Export / Import */}
        <div className="bg-[#101014] rounded-3xl p-6 space-y-4 shadow-sm">
          <span className="text-xs font-mono uppercase font-bold tracking-wider text-zinc-400 block">
            Local Storage & Data Ownership
          </span>
          <p className="text-xs text-zinc-400 leading-relaxed">
            All data stays safely stored in your browser's private storage. Export JSON files anytime to sync between your phone and laptop without a middleman.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={exportDataJSON}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#16161d] hover:bg-zinc-800 text-xs font-semibold text-white active:scale-95 transition-all cursor-pointer"
            >
              <Download size={15} /> Export Backup
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#16161d] hover:bg-zinc-800 text-xs font-semibold text-white active:scale-95 transition-all cursor-pointer"
            >
              <Upload size={15} /> Restore Backup
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />

          <div className="pt-3 border-t border-zinc-900">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to erase all data and reset to defaults?')) {
                  clearAllData();
                }
              }}
              className="w-full py-1.5 text-center text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer"
            >
              Reset All Financial Data
            </button>
          </div>
        </div>

        {/* Multi-Device Tip & Security */}
        <div className="bg-[#101014] rounded-3xl p-6 flex flex-col justify-between shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck size={20} />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-white">Owner Vault Security</div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Protected by encrypted Supabase Auth. All unauthorized internet traffic is blocked.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-900 flex justify-between items-center">
            <span className="text-[10px] text-zinc-500 font-mono">STAYS SIGNED IN</span>
            <button
              onClick={() => {
                if (window.confirm('Lock Vault and log out?')) {
                  supabase?.auth.signOut();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span>Lock Vault</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
