import { lazy, Suspense, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'react-router-dom';
import { db } from '../../db';
import { usePlayerStore } from '../../store/playerStore';
import { useUiStore } from '../../store/uiStore';
import { Loader2 } from 'lucide-react';

const KaraokePlayer = lazy(() =>
  import('./KaraokePlayer').then((module) => ({ default: module.KaraokePlayer }))
);

export const GlobalKaraokePlayer = () => {
  const { activeKaraokeId, setIsKaraokeMiniPlayer, isKaraokeMiniPlayer } = usePlayerStore();
  const { isDesktopSidebarOpen, toggleDesktopSidebar } = useUiStore();
  const location = useLocation();

  useEffect(() => {
    // Si cambiamos de ruta (usando la barra lateral u otro medio),
    // minimizamos el reproductor automáticamente para no bloquear la vista.
    if (!isKaraokeMiniPlayer && activeKaraokeId) {
      setIsKaraokeMiniPlayer(true);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- only route changes should minimize an already-open player
  
  const karaokeResult = useLiveQuery(
    async () => ({
      requestedId: activeKaraokeId,
      karaoke: activeKaraokeId === null
        ? null
        : (await db.karaokes.get(activeKaraokeId) ?? null),
    }),
    [activeKaraokeId]
  );

  useEffect(() => {
    if (
      activeKaraokeId === null ||
      karaokeResult?.requestedId !== activeKaraokeId ||
      karaokeResult.karaoke !== null
    ) return;
    usePlayerStore.getState().setActiveKaraokeId(null);
    usePlayerStore.getState().setIsKaraokeMiniPlayer(false);
  }, [activeKaraokeId, karaokeResult]);

  if (activeKaraokeId === null) return null;

  if (karaokeResult === undefined || karaokeResult.requestedId !== activeKaraokeId) return (
    <div className="global-karaoke-placeholder fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 h-20 bg-zinc-950/90 backdrop-blur-lg flex items-center justify-center z-50 border-t border-white/10">
      <Loader2 className="animate-spin text-primary-500 w-6 h-6" />
    </div>
  );

  const karaoke = karaokeResult.karaoke;
  if (karaoke === null) return null;

  return (
    <Suspense fallback={
      <div className="global-karaoke-placeholder fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 h-20 bg-zinc-950/90 backdrop-blur-lg flex items-center justify-center z-50 border-t border-white/10">
        <Loader2 className="animate-spin text-primary-500 w-6 h-6" />
      </div>
    }>
      <KaraokePlayer
        key={karaoke.id}
        karaoke={karaoke}
        onBack={() => {
          // If we are minimizing from the full view, we just set isKaraokeMiniPlayer to true
          usePlayerStore.getState().setIsKaraokeMiniPlayer(true);
        }}
        isSidebarOpen={isDesktopSidebarOpen}
        onToggleSidebar={toggleDesktopSidebar}
      />
    </Suspense>
  );
};
