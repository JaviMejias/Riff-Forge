import { useState, useEffect, useRef, useMemo } from 'react';

interface UseInfiniteScrollProps<T> {
  items: T[] | undefined;
  itemsPerPage?: number;
}

export function useInfiniteScroll<T>({ items, itemsPerPage = 20 }: UseInfiniteScrollProps<T>) {
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((previous) => Math.min(
          previous + itemsPerPage,
          items?.length ?? previous
        ));
      }
    }, {
      rootMargin: '200px' // Empezar a cargar 200px antes de llegar al final
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [items?.length, itemsPerPage]);

  const visibleItems = useMemo(() => {
    if (!items) return undefined;
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

  const hasMore = items ? visibleCount < items.length : false;

  return {
    visibleItems,
    loadMoreRef,
    hasMore,
    visibleCount
  };
}
