interface PullIndicatorProps {
  pullProgress: number;
  isRefreshing: boolean;
}

export function PullIndicator({ pullProgress, isRefreshing }: PullIndicatorProps) {
  if (pullProgress === 0 && !isRefreshing) return null;
  return (
    <div
      className="flex items-center justify-center py-3 transition-all"
      style={{ opacity: Math.max(pullProgress, isRefreshing ? 1 : 0) }}
    >
      <div
        className={`w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full ${isRefreshing ? 'animate-spin' : ''}`}
        style={{ transform: isRefreshing ? undefined : `rotate(${pullProgress * 180}deg)` }}
      />
      <span className="ml-2 text-xs text-zinc-400 font-medium">
        {isRefreshing ? 'Sincronizando...' : 'Suelta para actualizar'}
      </span>
    </div>
  );
}
