import { useEffect, useRef, useCallback } from "react";

/**
 * useInfiniteScroll
 *
 * Attaches an IntersectionObserver to a sentinel element. When the sentinel
 * enters the viewport, `onLoadMore` is called — but only when `hasMore` is
 * true and `isLoading` is false (prevents duplicate fetches).
 *
 * Usage:
 *   const sentinelRef = useInfiniteScroll({ hasMore, isLoading, onLoadMore });
 *   ...
 *   <div ref={sentinelRef} />   ← place at the bottom of the list
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = "200px",
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  /** How far before the sentinel hits the viewport edge to trigger. Default 200px */
  rootMargin?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const stableOnLoadMore = useCallback(onLoadMore, [onLoadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          stableOnLoadMore();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, stableOnLoadMore, rootMargin]);

  return sentinelRef;
}
