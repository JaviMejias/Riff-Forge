import { Library, ListMusic, Menu, Mic2, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useUiStore } from '../store/uiStore';

const items = [
  { path: '/', label: 'Tabs', icon: Library, active: (path: string) => path === '/' || path.startsWith('/song/') },
  { path: '/karaokes', label: 'Karaokes', icon: Mic2, active: (path: string) => path === '/karaokes' || path.startsWith('/karaoke/') },
  { path: '/playlists/tabs', label: 'Listas', icon: ListMusic, active: (path: string) => path.includes('playlist') },
  { path: '/community', label: 'Comunidad', icon: Users, active: (path: string) => path === '/community' }
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const setMobileMenuOpen = useUiStore(state => state.setMobileMenuOpen);

  return (
    <nav
      aria-label="Navegación principal"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden"
    >
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
