import { useState } from 'react';
import { ChevronDown, ChevronUp, Library, ListMusic, Menu, Mic2, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useUiStore } from '../store/uiStore';
import { usePlayerStore } from '../store/playerStore';

const items = [
  { path: '/', label: 'Tabs', icon: Library, active: (path: string) => path === '/' || path.startsWith('/song/') },
  { path: '/karaokes', label: 'Karaokes', icon: Mic2, active: (path: string) => path === '/karaokes' || path.startsWith('/karaoke/') },
  { path: '/playlists/tabs', label: 'Listas', icon: ListMusic, active: (path: string) => path.includes('playlist') },
  { path: '/community', label: 'Comunidad', icon: Users, active: (path: string) => path === '/community' }
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const setMobileMenuOpen = useUiStore(state => state.setMobileMenuOpen);
  const activeKaraokeId = usePlayerStore(state => state.activeKaraokeId);
  const isKaraokeMiniPlayer = usePlayerStore(state => state.isKaraokeMiniPlayer);
  const isPlaybackView = location.pathname.startsWith('/song/') || Boolean(activeKaraokeId && !isKaraokeMiniPlayer);
  const collapseContext = `${location.pathname}:${isPlaybackView}`;
  const [collapseOverride, setCollapseOverride] = useState<{ context: string; value: boolean } | null>(null);
  const isCollapsed = collapseOverride?.context === collapseContext ? collapseOverride.value : isPlaybackView;

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapseOverride({ context: collapseContext, value: false })}
        aria-label="Mostrar navegación principal"
        className="fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] right-2 z-40 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-zinc-950/90 text-zinc-300 shadow-2xl backdrop-blur-xl md:hidden"
      >
        <ChevronUp size={20} />
      </button>
    );
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
    >
      <button
        type="button"
        onClick={() => setCollapseOverride({ context: collapseContext, value: true })}
        aria-label="Ocultar navegación principal"
        className="absolute -top-5 right-2 flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-950 text-zinc-400 shadow-xl"
      >
        <ChevronDown size={18} />
      </button>
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = item.active(location.pathname);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-bold transition-colors ${
                isActive ? 'bg-primary-500/10 text-primary-400' : 'text-zinc-500 active:bg-zinc-800 active:text-zinc-200'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir más opciones"
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-bold text-zinc-500 transition-colors active:bg-zinc-800 active:text-zinc-200"
        >
          <Menu size={20} />
          <span>Más</span>
        </button>
      </div>
    </nav>
  );
};
