import { useEffect, useState } from 'react';

/**
 * Keeps the last non-null value for `delay` ms after the source value becomes null.
 *
 * Use this for sliding panels: the width collapses over ~300ms, so the content has to stay
 * mounted for that long or it disappears instantly and the panel looks like it snaps shut.
 *
 * Pass a primitive (id / enum) rather than a freshly built object so the render-time sync below
 * stays a single extra render instead of looping.
 */
export function useDelayedUnmount<T extends string | number | boolean>(
  value: T | null,
  delay = 320
): T | null {
  const [held, setHeld] = useState<T | null>(value);

  // React's documented "adjust state during render" pattern: reopening a panel must mount its
  // content in the same commit as the width change, otherwise the first frame slides out empty.
  if (value !== null && value !== held) {
    setHeld(value);
  }

  useEffect(() => {
    if (value !== null || held === null) return;

    const timer = setTimeout(() => setHeld(null), delay);
    return () => clearTimeout(timer);
  }, [value, held, delay]);

  return held;
}
