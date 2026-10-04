import React from 'react';
import { X } from 'lucide-react';

/**
 * Fixed bottom-center Close pill shown on phone for open sub-pages.
 * Rendered by the HOST view (Today/Settings) — gated on the view being the
 * active tab, because the mobile carousel keeps all views mounted and a
 * fixed-position button would otherwise bleed across tabs.
 */
export const FloatingClose: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="sm:hidden fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-12 py-3 rounded-full bg-zinc-900/95 backdrop-blur-sm shadow-lg active:scale-95 text-zinc-300 text-sm font-mono font-bold transition-all cursor-pointer"
  >
    <X size={16} />
    <span>Close</span>
  </button>
);
