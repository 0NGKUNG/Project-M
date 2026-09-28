import { useEffect, useRef } from 'react';

/**
 * Hook to handle mobile swipe-back gesture and browser Back button.
 * 
 * When `isOpen` is true, it pushes a synthetic state to `history`
 * so when the user swipes from the edge of the phone (or presses Back),
 * `window.onpopstate` fires and triggers `onClose` instead of exiting the PWA / closing the browser tab.
 * 
 * If closed programmatically (e.g. tapping the close / back button on screen),
 * it reverts the history state cleanly without triggering an extra popstate.
 */
export function useBackButton(isOpen: boolean, onClose: () => void) {
  const isPushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      // Push state only once per open
      if (!isPushedRef.current) {
        window.history.pushState({ modalOpen: true, timestamp: Date.now() }, '');
        isPushedRef.current = true;
      }

      const handlePopState = () => {
        if (isPushedRef.current) {
          isPushedRef.current = false;
          onCloseRef.current();
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (isPushedRef.current) {
          isPushedRef.current = false;
          window.history.back();
        }
      };
    } else {
      isPushedRef.current = false;
    }
  }, [isOpen]);
}
