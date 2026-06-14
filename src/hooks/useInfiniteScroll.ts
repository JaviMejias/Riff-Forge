import { useState, useEffect, useRef, useMemo } from 'react';

interface UseInfiniteScrollProps<T> {
  items: T[] | undefined;
  itemsPerPage?: number;
}

export function useInfiniteScroll<T>({ items, itemsPerPage = 20 }: UseInfiniteScrollProps<T>) {
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Resetear la cuenta visible si cambian los ítems originales (ej. por búsqueda o filtros)
  useEffect(() => {
    setVisibleCount(itemsPerPage);
  }, [items, itemsPerPage]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((prev) => prev + itemsPerPage);
      }
    }, {
      rootMargin: '200px' // Empezar a cargar 200px antes de llegar al final
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [itemsPerPage]);

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
