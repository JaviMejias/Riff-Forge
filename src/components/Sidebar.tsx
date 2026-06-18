import { Music2, Library, BookOpen, Settings, Mic2, Guitar, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useUiStore } from '../store/uiStore';
import { useAudioStore } from '../store/audioStore';
import { useAuthStore } from '../store/authStore';

export const Sidebar = () => {
  const { isMobileMenuOpen, setMobileMenuOpen, isDesktopSidebarOpen } = useUiStore();
  const { globalIsPlaying } = useAudioStore();
  const { user, logOut } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Todas las Tabs', icon: Library },
    { path: '/karaokes', label: 'Karaokes', icon: Mic2 },
    { path: '/dictionary', label: 'Diccionario', icon: BookOpen },
    { path: '/settings', label: 'Ajustes', icon: Settings },
  ];

  return (
    <motion.aside 
      initial={false}
      animate={{ 
        marginLeft: isDesktopSidebarOpen ? '0rem' : '-16rem',
        x: isMobileMenuOpen ? 0 : (window.innerWidth < 768 ? '-100%' : 0)
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`fixed md:relative flex-col bg-zinc-950/30 backdrop-blur-xl border-r border-white/5 h-full z-30 shadow-2xl shrink-0 w-64 ${
        isMobileMenuOpen ? 'flex' : 'hidden md:flex'
      }`}
    >
      {/* HEADER SIDEBAR */}
      <div className="p-6 shrink-0 flex items-center justify-between">
        <Link 
          to="/"
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setMobileMenuOpen(false)}
        >
          <motion.div 
            whileHover={{ rotate: 10, scale: 1.05 }}
            animate={globalIsPlaying ? { 
              rotate: [0, 15, -5, 0], 
              y: [0, -4, 0] 
            } : { rotate: 0, y: 0 }}
            transition={globalIsPlaying ? { 
              duration: 2.5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            } : { duration: 0.3 }}
            className="bg-primary-500 p-2.5 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] border border-primary-400/50"
          >
            <Music2 size={24} className="text-zinc-950" />
          </motion.div>
          <motion.h1 
            animate={globalIsPlaying ? { y: [0, -3, 0] } : { y: 0 }}
            transition={globalIsPlaying ? { duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 } : { duration: 0.3 }}
            className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-primary-200 to-primary-500 bg-clip-text text-transparent truncate"
          >
            Riff Forge
          </motion.h1>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 hide-scrollbar flex flex-col gap-8">
        {/* NAVEGACIÓN PRINCIPAL */}
        <div>
          <div className="flex items-center gap-2 text-zinc-500 font-bold uppercase text-xs tracking-widest mb-3 px-2">
            Navegación
          </div>
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              // Path '/' is active if location is '/' or if we are viewing a song (conceptually part of library)
              const isActive = location.pathname === item.path || 
                               (item.path === '/' && location.pathname.startsWith('/song/')) ||
                               (item.path === '/karaokes' && location.pathname.startsWith('/karaoke/'));
              
              return (
                <Link
                  to={item.path}
                  key={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors font-medium text-sm ${
                    isActive 
                      ? 'text-primary-400 font-bold' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActiveIndicator"
                      className="absolute inset-0 bg-primary-500/10 shadow-[inset_2px_0_0_var(--primary-500)] rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-3">
                    <Icon size={18} className={isActive ? 'text-primary-500' : 'opacity-70'} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* LISTAS DE REPRODUCCIÓN */}
        <div className="flex flex-col h-full min-h-0">
          <div className="flex items-center justify-between text-zinc-500 font-bold uppercase text-xs tracking-widest mb-3 px-2 shrink-0">
            <span className="flex items-center gap-2">Tus Listas</span>
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto min-h-0 pb-4 flex-1">
            <Link
              to="/playlists/tabs"
              onClick={() => setMobileMenuOpen(false)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors font-medium text-sm w-full text-left ${
                location.pathname.startsWith('/playlists/tabs') || location.pathname.startsWith('/playlist/')
                  ? 'text-primary-400 font-bold' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {(location.pathname.startsWith('/playlists/tabs') || location.pathname.startsWith('/playlist/')) && (
                <motion.div
                  layoutId="sidebarActiveIndicator"
                  className="absolute inset-0 bg-primary-500/10 shadow-[inset_2px_0_0_var(--primary-500)] rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <div className="relative z-10 flex items-center gap-3 w-full">
                <Guitar size={18} className={`shrink-0 ${location.pathname.startsWith('/playlists/tabs') || location.pathname.startsWith('/playlist/') ? 'text-primary-500' : 'opacity-70'}`} />
                <span className="truncate flex-1">Listas de Tabs</span>
              </div>
            </Link>
            
            <Link
              to="/playlists/karaokes"
              onClick={() => setMobileMenuOpen(false)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors font-medium text-sm w-full text-left ${
                location.pathname.startsWith('/playlists/karaokes') || location.pathname.startsWith('/karaoke-playlist/')
                  ? 'text-primary-400 font-bold' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {(location.pathname.startsWith('/playlists/karaokes') || location.pathname.startsWith('/karaoke-playlist/')) && (
                <motion.div
                  layoutId="sidebarActiveIndicator"
                  className="absolute inset-0 bg-primary-500/10 shadow-[inset_2px_0_0_var(--primary-500)] rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <div className="relative z-10 flex items-center gap-3 w-full">
                <Mic2 size={18} className={`shrink-0 ${location.pathname.startsWith('/playlists/karaokes') || location.pathname.startsWith('/karaoke-playlist/') ? 'text-primary-500' : 'opacity-70'}`} />
                <span className="truncate flex-1">Listas de Karaokes</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
      
      {/* USER PROFILE */}
      <div className="p-4 shrink-0 mt-auto border-t border-white/5 bg-zinc-950/40">
        <div className="flex items-center gap-3 w-full">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-primary-500/30">
            <img src={'https://ui-avatars.com/api/?name=' + (user?.name || 'Usuario') + '&background=random'} alt={user?.name || "Usuario"} className="w-full h-full object-cover" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary-500 rounded-full border-2 border-zinc-950"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-100 font-medium truncate leading-tight">{user?.name || 'Usuario'}</p>
            <p className="text-xs text-primary-400 font-medium truncate cursor-pointer hover:underline" onClick={logOut}>Cerrar Sesión</p>
          </div>
          <button onClick={logOut} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
};
