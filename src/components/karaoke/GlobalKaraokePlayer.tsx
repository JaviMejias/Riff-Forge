import { Suspense, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'react-router-dom';
import { db } from '../../db';
import { usePlayerStore } from '../../store/playerStore';
import { useUiStore } from '../../store/uiStore';
import { Loader2 } from 'lucide-react';
import { KaraokePlayer } from './KaraokePlayer';

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
  }, [location.pathname]);
  
  const karaoke = useLiveQuery(
    () => activeKaraokeId ? db.karaokes.get(activeKaraokeId) : undefined,
    [activeKaraokeId]
  );

  if (!activeKaraokeId) return null;

  if (karaoke === undefined) return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-950/90 backdrop-blur-lg flex items-center justify-center z-50 border-t border-white/10">
      <Loader2 className="animate-spin text-primary-500 w-6 h-6" />
    </div>
  );

  if (karaoke === null) return null;

  return (
    <Suspense fallback={
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-950/90 backdrop-blur-lg flex items-center justify-center z-50 border-t border-white/10">
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
