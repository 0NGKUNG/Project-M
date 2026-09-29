import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackButton } from '../../hooks/useBackButton';

interface ManagerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Frame for the Recurring / Borrow & Lend managers.
 *
 * They used to be sub-tabs of Accounts (and, for recurring, a hidden Settings sub-page), which meant
 * you could only view them from one place. Hosting them in a sheet lets any screen open them for
 * reading while Settings keeps the "set things up" entry points.
 */
export const ManagerSheet: React.FC<ManagerSheetProps> = ({ isOpen, onClose, children }) => {
  useBackButton(isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in cursor-pointer select-none"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl lg:max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[88vh] bg-[#0c0c10] sm:border border-zinc-800 rounded-none sm:rounded-3xl flex flex-col shadow-2xl safe-top safe-bottom overflow-hidden cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end px-3 sm:px-5 pt-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6 pt-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
