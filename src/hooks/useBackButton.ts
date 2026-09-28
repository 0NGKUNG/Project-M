import { useEffect, useRef } from 'react';

interface ModalEntry {
  id: string;
  onClose: () => void;
}

// Global stack of active modal handlers (LIFO)
const modalStack: ModalEntry[] = [];

// Counter of programmatic history.back() calls that will fire a 'popstate' event
// which should be ignored by modal stack handlers.
let programmaticBackCount = 0;

let isGlobalListenerAttached = false;

function ensureGlobalListener() {
  if (isGlobalListenerAttached || typeof window === 'undefined') return;
  isGlobalListenerAttached = true;

  window.addEventListener('popstate', () => {
    if (programmaticBackCount > 0) {
      programmaticBackCount--;
      return;
    }

    // Topmost modal handles the back gesture
    if (modalStack.length > 0) {
      const top = modalStack.pop();
      if (top) {
        top.onClose();
      }
    }
  });
}

/**
 * Hook to handle mobile swipe-back gesture and browser Back button.
 * 
 * - When `isOpen` is true, registers on a global LIFO stack and pushes a synthetic
 *   history state.
 * - When user swipes back on mobile / presses Back, popstate dismisses only the topmost
 *   active modal without duplicating back navigations.
 * - When closed programmatically (X button, Cancel, Save, backdrop), cleans up history
 *   and absorbs the resulting popstate event so underlying modals are not affected.
 * - Defers unmount cleanup with a 0ms timeout so React StrictMode mount->unmount->mount
 *   cycles in development do NOT prematurely close or flash modals.
 */
export function useBackButton(isOpen: boolean, onClose: () => void) {
  const idRef = useRef<string>('');
  if (!idRef.current) {
    idRef.current = Math.random().toString(36).slice(2, 9);
  }
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isPushedRef = useRef(false);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      // If a pending cleanup was scheduled (e.g. React StrictMode simulated unmount), cancel it
      if (cleanupTimeoutRef.current !== null) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }

      ensureGlobalListener();

      if (!isPushedRef.current) {
        try {
          window.history.pushState({ modalId: idRef.current, timestamp: Date.now() }, '');
          isPushedRef.current = true;
          modalStack.push({
            id: idRef.current,
            onClose: () => onCloseRef.current(),
          });
        } catch {
          // In case history.pushState is restricted
        }
      }

      return () => {
        // Schedule cleanup on next tick to absorb React StrictMode mount->unmount->mount cycles
        cleanupTimeoutRef.current = setTimeout(() => {
          cleanupTimeoutRef.current = null;
          const idx = modalStack.findIndex((m) => m.id === idRef.current);
          if (idx !== -1) {
            // It was not closed by popstate (still in stack) -> programmatic close
            modalStack.splice(idx, 1);
            if (isPushedRef.current) {
              isPushedRef.current = false;
              programmaticBackCount++;
              try {
                window.history.back();
              } catch {
                programmaticBackCount = Math.max(0, programmaticBackCount - 1);
              }
            }
          } else {
            // Already removed by popstate handler
            isPushedRef.current = false;
          }
        }, 0);
      };
    } else {
      // isOpen changed to false
      if (cleanupTimeoutRef.current !== null) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
      const idx = modalStack.findIndex((m) => m.id === idRef.current);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
        if (isPushedRef.current) {
          isPushedRef.current = false;
          programmaticBackCount++;
          try {
            window.history.back();
          } catch {
            programmaticBackCount = Math.max(0, programmaticBackCount - 1);
          }
        }
      } else {
        isPushedRef.current = false;
      }
    }
  }, [isOpen]);
}
