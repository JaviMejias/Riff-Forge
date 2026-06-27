import { useRef, useState, useEffect, useCallback, type RefObject } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // px to pull before triggering
}

interface UsePullToRefreshResult {
  containerRef: RefObject<HTMLDivElement | null>; // allow null for initial useRef value
  pullProgress: number; // 0 to 1
  isRefreshing: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullProgress, setPullProgress] = useState(0); // 0..1
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const currentPullRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (!el) return;
    // Only activate pull-to-refresh when scrolled to top
    if (el.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startYRef.current === null || isRefreshingRef.current) return;
      const el = containerRef.current;
      if (!el || el.scrollTop > 0) {
        startYRef.current = null;
        return;
      }
      const deltaY = e.touches[0].clientY - startYRef.current;
      if (deltaY < 0) {
        startYRef.current = null;
        return;
      }
      // Dampen the pull so it feels springy
      const dampened = Math.min(deltaY * 0.5, threshold * 1.5);
      currentPullRef.current = dampened;
      setPullProgress(Math.min(dampened / threshold, 1));
    },
    [threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;

    if (currentPullRef.current >= threshold && !isRefreshingRef.current) {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      setPullProgress(1);

      try {
        await onRefresh();
      } finally {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
        setPullProgress(0);
        currentPullRef.current = 0;
      }
    } else {
      // Snap back without refresh
      setPullProgress(0);
      currentPullRef.current = 0;
    }
  }, [threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, pullProgress, isRefreshing };
}
