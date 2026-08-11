import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RefreshCw } from 'lucide-react';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'attention' | 'error';

export const SyncStatusIndicator = () => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleSyncStatus = (event: Event) => {
      const nextStatus = (event as CustomEvent<{ status: SyncStatus }>).detail.status;
      clearTimers();

      if (nextStatus === 'syncing') {
        showTimerRef.current = window.setTimeout(() => setStatus('syncing'), 700);
      } else if (nextStatus === 'error' || nextStatus === 'attention' || nextStatus === 'success') {
        setStatus(nextStatus);
        hideTimerRef.current = window.setTimeout(() => setStatus('idle'), nextStatus === 'success' ? 2500 : 6000);
      } else {
        setStatus('idle');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-status-change', handleSyncStatus);
    return () => {
      clearTimers();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-status-change', handleSyncStatus);
    };
  }, []);

  if (isOnline && status === 'idle') return null;

  const isOffline = !isOnline;
  const isError = isOnline && status === 'error';
  const needsAttention = isOnline && status === 'attention';
  const isSuccess = isOnline && status === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sync-status-indicator fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[90] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold shadow-2xl backdrop-blur-xl md:bottom-5 ${
        isOffline
          ? 'border-amber-500/30 bg-zinc-900/95 text-amber-300'
          : isError
            ? 'border-red-500/30 bg-zinc-900/95 text-red-300'
            : needsAttention
              ? 'border-amber-500/30 bg-zinc-900/95 text-amber-300'
              : isSuccess
                ? 'border-emerald-500/30 bg-zinc-900/95 text-emerald-300'
            : 'border-primary-500/30 bg-zinc-900/95 text-primary-300'
      }`}
    >
      {isOffline ? <CloudOff size={15} /> : isError ? <RefreshCw size={15} /> : needsAttention ? <AlertTriangle size={15} /> : isSuccess ? <CheckCircle2 size={15} /> : <Loader2 size={15} className="animate-spin" />}
      <span className="truncate">
        {isOffline
          ? 'Sin conexión · los cambios quedan pendientes'
          : isError
            ? 'No se pudo sincronizar · reintentaremos automáticamente'
            : needsAttention
              ? 'Algunos cambios fueron reemplazados por una versión más reciente'
              : isSuccess
                ? 'Cambios guardados en la nube'
            : 'Sincronizando cambios…'}
      </span>
    </div>
  );
};
