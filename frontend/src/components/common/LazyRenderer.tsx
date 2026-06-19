
import { useState, useEffect, ReactNode, useCallback, useMemo } from 'react';

interface LazyRendererProps {
  items: any[];
  initialCount?: number;
  batchSize?: number;
  renderItem: (item: any, index: number) => ReactNode;
  className?: string;
}

const LazyRenderer = ({ 
  items, 
  initialCount = 3, 
  batchSize = 5, 
  renderItem, 
  className = "" 
}: LazyRendererProps) => {
  const [visibleCount, setVisibleCount] = useState(Math.min(initialCount, items.length));

  useEffect(() => {
    // Reset visible count when items change
    setVisibleCount(Math.min(initialCount, items.length));
  }, [items.length, initialCount]);

  const loadMore = useCallback(() => {
    const nextCount = Math.min(visibleCount + batchSize, items.length);
    setVisibleCount(nextCount);
  }, [visibleCount, batchSize, items.length]);

  // Memoize visible items and hasMore for performance
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = useMemo(() => visibleCount < items.length, [visibleCount, items.length]);
  const remainingCount = useMemo(() => items.length - visibleCount, [items.length, visibleCount]);

  return (
    <div className={className}>
      {visibleItems.map((item, index) => renderItem(item, index))}
      
      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={loadMore}
            className="px-6 py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md"
          >
            Load More ({remainingCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};

export default LazyRenderer;
