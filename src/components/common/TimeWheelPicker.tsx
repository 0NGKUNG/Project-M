import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useFinance } from '../../context/FinanceContext';

export interface WheelColumnProps {
  items: (number | string)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatItem?: (item: number | string) => string;
  isPeriod?: boolean;
  paddingClass?: string;
  active?: boolean;
}

export const WheelColumn: React.FC<WheelColumnProps> = ({
  items,
  selectedIndex,
  onSelect,
  formatItem = (item) => String(item),
  isPeriod = false,
  paddingClass: _unusedPaddingClass = 'py-[72px]',
  active = true,
}) => {
  const { triggerHaptic } = useFinance();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const lastActiveIndexRef = useRef(selectedIndex);
  const pointerHistoryRef = useRef<Array<{ y: number; time: number }>>([]);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const wheelAccumulatorRef = useRef(0);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstActiveRef = useRef(true);
  const rafIdRef = useRef<number | null>(null);

  // Measure container height dynamically so the selected item is mathematically centered
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setContainerHeight(el.clientHeight);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Smooth ease-out cubic animation engine to guarantee single deterministic landing
  const animateTo = (targetScroll: number, onComplete?: () => void) => {
    const el = containerRef.current;
    if (!el) return;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    isProgrammaticScrollRef.current = true;
    const startScroll = el.scrollTop;
    const distance = targetScroll - startScroll;

    if (Math.abs(distance) < 0.5) {
      el.scrollTop = targetScroll;
      isProgrammaticScrollRef.current = false;
      onComplete?.();
      return;
    }

    const duration = Math.min(280, Math.max(160, Math.abs(distance) * 1.5));
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic: 1 - (1 - progress)^3
      const easeOut = 1 - Math.pow(1 - progress, 3);
      el.scrollTop = startScroll + distance * easeOut;

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(step);
      } else {
        el.scrollTop = targetScroll;
        rafIdRef.current = null;
        isProgrammaticScrollRef.current = false;
        onComplete?.();
      }
    };

    rafIdRef.current = requestAnimationFrame(step);
  };

  // Cleanup active RAF and wheel timer on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, []);

  // Reset first-active flag when inactive so next open is instant
  useEffect(() => {
    if (!active) {
      isFirstActiveRef.current = true;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
  }, [active]);

  // Instant positioning on initial open (before paint) or smooth scroll for external updates (e.g. Set to Now)
  useLayoutEffect(() => {
    if (active && containerRef.current && !isDraggingRef.current) {
      if (isFirstActiveRef.current) {
        // Initial open: instantaneous positioning with zero delay or visible change
        isProgrammaticScrollRef.current = true;
        containerRef.current.scrollTop = selectedIndex * 32;
        lastActiveIndexRef.current = selectedIndex;
        isFirstActiveRef.current = false;
        const frame = requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
        return () => cancelAnimationFrame(frame);
      } else if (selectedIndex !== lastActiveIndexRef.current) {
        // External update while already open (e.g. "Set to Now"): smooth animate
        lastActiveIndexRef.current = selectedIndex;
        animateTo(selectedIndex * 32);
      }
    }
  }, [active, selectedIndex, containerHeight]);

  // Scroll listener: only for passive native scroll events when not animating or dragging
  const handleScroll = () => {
    if (isProgrammaticScrollRef.current || isDraggingRef.current || !containerRef.current) return;
    const currentScroll = containerRef.current.scrollTop;
    const rawIndex = Math.round(currentScroll / 32);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, rawIndex));

    if (clampedIndex !== lastActiveIndexRef.current) {
      lastActiveIndexRef.current = clampedIndex;
      triggerHaptic();
      onSelect(clampedIndex);
    }
  };

  // Wheel listener: accumulates delta and smoothly steps by 1 item (32px)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    wheelAccumulatorRef.current += e.deltaY;
    if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    wheelTimeoutRef.current = setTimeout(() => {
      wheelAccumulatorRef.current = 0;
    }, 200);

    if (Math.abs(wheelAccumulatorRef.current) >= 24) {
      const step = wheelAccumulatorRef.current > 0 ? 1 : -1;
      wheelAccumulatorRef.current = 0;
      const currentIndex = Math.round(containerRef.current.scrollTop / 32);
      const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + step));
      if (nextIndex !== lastActiveIndexRef.current) {
        lastActiveIndexRef.current = nextIndex;
        triggerHaptic();
        onSelect(nextIndex);
        animateTo(nextIndex * 32);
      }
    }
  };

  // Direct pointer drag (Mouse + Touch unified) with momentum flick physics
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isProgrammaticScrollRef.current = false;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startYRef.current = e.clientY;
    startScrollTopRef.current = el.scrollTop;
    pointerHistoryRef.current = [{ y: e.clientY, time: performance.now() }];

    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture is unsupported or fails
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const el = containerRef.current;
    const deltaY = e.clientY - startYRef.current;

    if (Math.abs(deltaY) > 3) {
      hasMovedRef.current = true;
    }

    el.scrollTop = startScrollTopRef.current - deltaY;

    const now = performance.now();
    pointerHistoryRef.current.push({ y: e.clientY, time: now });
    pointerHistoryRef.current = pointerHistoryRef.current.filter((p) => now - p.time <= 100);

    const rawIndex = Math.round(el.scrollTop / 32);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, rawIndex));
    if (clampedIndex !== lastActiveIndexRef.current) {
      lastActiveIndexRef.current = clampedIndex;
      triggerHaptic();
      onSelect(clampedIndex);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    isDraggingRef.current = false;
    const el = containerRef.current;

    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const now = performance.now();
    const history = pointerHistoryRef.current.filter((p) => now - p.time <= 100);
    let velocity = 0;
    if (history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];
      const dt = newest.time - oldest.time;
      const dy = newest.y - oldest.y;
      if (dt > 10) {
        velocity = dy / dt; // px/ms
      }
    }

    // Momentum projection if flicked, otherwise settle cleanly to closest item
    const momentumDistance = -velocity * 180;
    const projectedScroll = el.scrollTop + momentumDistance;
    const targetIndex = Math.max(0, Math.min(items.length - 1, Math.round(projectedScroll / 32)));

    lastActiveIndexRef.current = targetIndex;
    triggerHaptic();
    onSelect(targetIndex);

    // Single deterministic ease-out glide to target without any CSS snap oscillation
    animateTo(targetIndex * 32);
  };

  const handleItemClick = (idx: number) => {
    if (hasMovedRef.current) return;
    if (!containerRef.current) return;

    lastActiveIndexRef.current = idx;
    triggerHaptic();
    onSelect(idx);
    animateTo(idx * 32);
  };

  const paddingY = containerHeight > 0 ? Math.max(0, (containerHeight - 32) / 2) : 80;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        touchAction: 'none',
        paddingTop: `${paddingY}px`,
        paddingBottom: `${paddingY}px`,
      }}
      className="col-span-2 h-full overflow-y-auto no-scrollbar cursor-grab active:cursor-grabbing select-none"
    >
      {items.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        const label = formatItem(item);
        return (
          <div
            key={idx}
            onClick={() => handleItemClick(idx)}
            className={`h-8 flex items-center justify-center cursor-pointer transition-all duration-150 select-none ${
              isSelected
                ? isPeriod
                  ? 'text-white text-lg font-black scale-105'
                  : 'text-white text-2xl font-black scale-105'
                : isPeriod
                ? 'text-zinc-500 text-sm font-bold hover:text-zinc-300'
                : 'text-zinc-500 text-base font-bold hover:text-zinc-300'
            }`}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
};

export interface TimeWheelPickerProps {
  time: string;
  setTime: (newTime: string) => void;
  active?: boolean;
  heightClass?: string;
  paddingClass?: string;
  gradientBg?: string;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS: ('AM' | 'PM')[] = ['AM', 'PM'];

export const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({
  time,
  setTime,
  active = true,
  heightClass = 'h-44',
  paddingClass = 'py-[72px]',
  gradientBg = 'from-[#0c0c10]',
}) => {
  const [rawH = '12', rawM = '00'] = (time || '12:00').split(':');
  const currentH24 = parseInt(rawH, 10) || 0;
  const hour12Num = currentH24 % 12 || 12;
  const hourIndex = hour12Num - 1; // 0..11
  const minIndex = Math.max(0, Math.min(59, parseInt(rawM, 10) || 0)); // 0..59
  const isPM = currentH24 >= 12;
  const periodIndex = isPM ? 1 : 0; // 0 = AM, 1 = PM

  const handleHourSelect = (idx: number) => {
    const selectedH12 = idx + 1; // 1..12
    let new24H = selectedH12 % 12;
    if (isPM) new24H += 12;
    const newTime = `${String(new24H).padStart(2, '0')}:${rawM.padStart(2, '0')}`;
    if (newTime !== time) {
      setTime(newTime);
    }
  };

  const handleMinSelect = (idx: number) => {
    const newTime = `${rawH.padStart(2, '0')}:${String(idx).padStart(2, '0')}`;
    if (newTime !== time) {
      setTime(newTime);
    }
  };

  const handlePeriodSelect = (idx: number) => {
    let new24H = hour12Num % 12;
    if (idx === 1) new24H += 12; // idx 1 = PM
    const newTime = `${String(new24H).padStart(2, '0')}:${rawM.padStart(2, '0')}`;
    if (newTime !== time) {
      setTime(newTime);
    }
  };

  const gradientVia = gradientBg.includes('14141a') ? 'via-[#14141a]/80' : 'via-[#0c0c10]/80';
  const gradientH = 'h-9';

  return (
    <div className={`relative overflow-hidden ${heightClass} w-full flex items-center justify-center pt-1`}>
      {/* Top & Bottom Gradient Fading Overlay Mask */}
      <div className={`absolute inset-x-0 top-0 ${gradientH} bg-gradient-to-b ${gradientBg} ${gradientVia} to-transparent z-20 pointer-events-none`} />
      <div className={`absolute inset-x-0 bottom-0 ${gradientH} bg-gradient-to-t ${gradientBg} ${gradientVia} to-transparent z-20 pointer-events-none`} />

      {/* Columns layout: [Hour] : [Minute] [AM/PM] */}
      <div className="grid grid-cols-7 w-full text-center z-0 h-full items-center font-mono">
        {/* Hours Column (span 2) */}
        <WheelColumn
          items={HOURS}
          selectedIndex={hourIndex}
          onSelect={handleHourSelect}
          formatItem={(h) => String(h).padStart(2, '0')}
          paddingClass={paddingClass}
          active={active}
        />

        {/* Colon Separator Column (span 1) */}
        <div className="col-span-1 z-20 text-white text-xl font-black flex items-center justify-center pointer-events-none select-none">
          :
        </div>

        {/* Minutes Column (span 2) */}
        <WheelColumn
          items={MINUTES}
          selectedIndex={minIndex}
          onSelect={handleMinSelect}
          formatItem={(m) => String(m).padStart(2, '0')}
          paddingClass={paddingClass}
          active={active}
        />

        {/* AM / PM Column (span 2) */}
        <WheelColumn
          items={PERIODS}
          selectedIndex={periodIndex}
          onSelect={handlePeriodSelect}
          formatItem={(p) => String(p)}
          isPeriod={true}
          paddingClass={paddingClass}
          active={active}
        />
      </div>
    </div>
  );
};
