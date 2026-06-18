import React, { Suspense } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Song } from './db';
import { Sidebar } from './components/Sidebar';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as alphaTab from '@coderline/alphatab';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useUiStore } from './store/uiStore';
import { usePlayerStore } from './store/playerStore';
const MySwal = withReactContent(Swal);

import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalAmbilight } from './components/GlobalAmbilight';
import { LoginView } from './components/LoginView';
import { useAuthStore } from './store/authStore';

// Lazy loaded views
const TabPlayer = React.lazy(() => import('./components/TabPlayer').then(m => ({ default: m.TabPlayer })));
const LibraryView = React.lazy(() => import('./components/LibraryView').then(m => ({ default: m.LibraryView })));
const PlaylistView = React.lazy(() => import('./components/PlaylistView').then(m => ({ default: m.PlaylistView })));
const ChordDictionaryView = React.lazy(() => import('./components/ChordDictionaryView').then(m => ({ default: m.ChordDictionaryView })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const KaraokeLibraryView = React.lazy(() => import('./components/karaoke/KaraokeLibraryView').then(m => ({ default: m.KaraokeLibraryView })));
const KaraokePlayer = React.lazy(() => import('./components/karaoke/KaraokePlayer').then(m => ({ default: m.KaraokePlayer })));
const PlaylistsIndexView = React.lazy(() => import('./components/playlists/PlaylistsIndexView').then(m => ({ default: m.PlaylistsIndexView })));
const KaraokePlaylistView = React.lazy(() => import('./components/playlists/KaraokePlaylistView').then(m => ({ default: m.KaraokePlaylistView })));

// Wrappers for routes
const PlayerRoute = ({ songs }: { songs: Song[] }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDesktopSidebarOpen, toggleDesktopSidebar } = useUiStore();
  const song = songs.find(s => s.id === parseInt(id || '0'));

  if (!song) return <div className="p-8 text-zinc-400">Cargando canción...</div>;

  return (
    <TabPlayer 
      song={song} 
      onBack={() => navigate('/')} 
      isSidebarOpen={isDesktopSidebarOpen}
      onToggleSidebar={toggleDesktopSidebar}
    />
  );
};

const PlaylistRoute = ({ onPlaySong }: { onPlaySong: (song: Song, autoEdit?: boolean) => void }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDesktopSidebarOpen, toggleDesktopSidebar } = useUiStore();
  
  return (
    <PlaylistView
      playlistId={parseInt(id || '0')}
      activeSongId={null}
      onPlaySong={onPlaySong}
      onBackToLibrary={() => navigate('/playlists/tabs')}
      isSidebarOpen={isDesktopSidebarOpen}
      onToggleSidebar={toggleDesktopSidebar}
    />
  );
};

const KaraokePlaylistRoute = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDesktopSidebarOpen, toggleDesktopSidebar } = useUiStore();
  
  return (
    <KaraokePlaylistView
      playlistId={parseInt(id || '0')}
      activeKaraokeId={null}
      onPlayKaraoke={(k) => navigate(`/karaoke/${k.id}`)}
      onBackToLibrary={() => navigate('/playlists/karaokes')}
      isSidebarOpen={isDesktopSidebarOpen}
      onToggleSidebar={toggleDesktopSidebar}
    />
  );
};

const KaraokePlayerRoute = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDesktopSidebarOpen, toggleDesktopSidebar } = useUiStore();
  const karaoke = useLiveQuery(() => db.karaokes.get(parseInt(id || '0')), [id]);

  if (karaoke === undefined) return <div className="p-8 text-zinc-400">Cargando karaoke...</div>;
  if (karaoke === null) return <div className="p-8 text-zinc-400">Karaoke no encontrado.</div>;

  return (
    <KaraokePlayer 
      karaoke={karaoke} 
      onBack={() => navigate('/karaokes')} 
      isSidebarOpen={isDesktopSidebarOpen}
      onToggleSidebar={toggleDesktopSidebar}
    />
  );
};

function App() {
  const songs = useLiveQuery(() => db.songs.orderBy('dateAdded').reverse().toArray()) || [];
  const karaokes = useLiveQuery(() => db.karaokes.orderBy('dateAdded').reverse().toArray()) || [];
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    isMobileMenuOpen, 
    setMobileMenuOpen, 
    isDesktopSidebarOpen, 
    toggleDesktopSidebar,
    isImmersiveMode
  } = useUiStore();
  const theme = useUiStore(state => state.theme);
  const setTheme = useUiStore(state => state.setTheme);
  const { setMainViewMode } = usePlayerStore();
  const { token, loading } = useAuthStore();

  React.useEffect(() => {
    // Initial theme sync when the app loads
    setTheme(theme);

    const handleLogout = () => navigate('/');
    window.addEventListener('auth-logout', handleLogout);
    return () => window.removeEventListener('auth-logout', handleLogout);
  }, [theme, setTheme, navigate]);

  const handlePlaySong = (song: Song, autoEdit?: boolean) => {
    if (song.type !== 'text' && song.textContent) {
      MySwal.fire({
        title: 'Canción Híbrida',
        text: 'Esta canción tiene Tablatura Pro y Letra/Acordes. ¿Qué vista prefieres usar?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Pro (Tablatura)',
        cancelButtonText: 'Cifra (Letra)',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#a855f7',
        background: '#18181b',
        color: '#f4f4f5',
      }).then((result) => {
        if (result.isConfirmed) {
          setMainViewMode('pro');
          navigate(`/song/${song.id}`, { state: { autoEdit } });
        } else if (result.dismiss === Swal.DismissReason.cancel) {
          setMainViewMode('cifra');
          navigate(`/song/${song.id}`, { state: { autoEdit } });
        }
        // Si cierran el modal haciendo clic fuera (backdrop) o con ESC, no hacemos nada (no navegamos).
      });
    } else {
      navigate(`/song/${song.id}`, { state: { autoEdit } });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    MySwal.fire({
      title: 'Procesando archivo...',
      text: 'Extrayendo letra, acordes y metadatos.',
      allowOutsideClick: false,
      background: '#18181b',
      color: '#f4f4f5',
      didOpen: () => {
        MySwal.showLoading();
      }
    });

    let importedCount = 0;
    let lastId: number | null = null;
    let lastData: Uint8Array | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      let finalName = file.name.replace(/\.[^/.]+$/, "");
      let finalArtist = 'Desconocido';
      let finalAlbum = '';

      try {
        const settings = new alphaTab.Settings();
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(uint8Array, settings);
        if (score.title && score.title.trim()) finalName = score.title.trim();
        if (score.artist && score.artist.trim()) finalArtist = score.artist.trim();
        if (score.album && score.album.trim()) finalAlbum = score.album.trim();
      } catch (error) {
        console.warn("No se pudo extraer metadata del archivo", file.name, error);
      }
      
      const existingSongs = await db.songs.toArray();
      const existingSong = existingSongs.find(s => 
        s.name.toLowerCase() === finalName.toLowerCase() && 
        (s.artist || 'Desconocido').toLowerCase() === finalArtist.toLowerCase()
      );

      if (existingSong && existingSong.id) {
        await db.songs.update(existingSong.id, {
          data: uint8Array,
          album: finalAlbum || existingSong.album,
          type: 'gp' 
        });
        lastId = existingSong.id;
      } else {
        const newId = await db.songs.add({
          name: finalName,
          artist: finalArtist,
          album: finalAlbum,
          data: uint8Array,
          type: 'gp',
          dateAdded: Date.now()
        });
        lastId = newId as number;
      }

      lastData = uint8Array;
      importedCount++;
    }

    if (importedCount > 0 && lastId !== null && lastData !== null) {
      const result = await MySwal.fire({
        title: '¡Subida Completada!',
        text: `Tu canción ya está guardada en la biblioteca. ¿Qué deseas hacer ahora?`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: 'Abrir Tablatura',
        cancelButtonText: 'Quedarme en Biblioteca',
        background: '#18181b',
        color: '#f4f4f5',
      });

      if (result.isConfirmed) {
        navigate(`/song/${lastId}`);
      }
    } else {
      MySwal.close();
    }
    
    e.target.value = '';
  };

  const activeSongId = location.pathname.startsWith('/song/') 
    ? parseInt(location.pathname.split('/')[2]) 
    : null;

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-primary-500">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin w-12 h-12" />
          <p className="font-bold tracking-widest text-sm uppercase">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <LoginView />;
  }

  return (
    <div className={`flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans ${isImmersiveMode ? 'bg-black' : 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[var(--theme-glow)] via-zinc-950 to-zinc-950'}`}>
        <GlobalAmbilight />
        {/* OVERLAY MOBILE */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
            />
          )}
        </AnimatePresence>

        {!isImmersiveMode && <Sidebar />}

        <main className="flex-1 relative overflow-hidden flex flex-col h-full z-10 w-full min-w-0 p-4 sm:p-6 md:p-8 lg:p-10">
          <ErrorBoundary>
            <Suspense fallback={
              <div className="h-full flex items-center justify-center bg-zinc-950 text-primary-500">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin w-12 h-12" />
                  <p className="font-bold tracking-widest text-sm uppercase">Cargando Módulo...</p>
                </div>
              </div>
            }>
              <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0 h-full"
                    >
                      <LibraryView
                        songs={songs}
                        activeSongId={activeSongId}
                        onPlaySong={handlePlaySong}
                        onImport={handleImport}
                        isSidebarOpen={isDesktopSidebarOpen}
                        onToggleSidebar={toggleDesktopSidebar}
                      />
                    </motion.div>
                  } />
                  
                  <Route path="/playlist/:id" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0 h-full"
                    >
                      <PlaylistRoute onPlaySong={handlePlaySong} />
                    </motion.div>
                  } />

                  <Route path="/dictionary" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <ChordDictionaryView 
                        isSidebarOpen={isDesktopSidebarOpen}
                        onToggleSidebar={toggleDesktopSidebar}
                      />
                    </motion.div>
                  } />

                  <Route path="/playlists/tabs" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <PlaylistsIndexView 
                        type="tabs"
                        isSidebarOpen={isDesktopSidebarOpen}
                        onToggleSidebar={toggleDesktopSidebar}
                      />
                    </motion.div>
                  } />

                  <Route path="/playlists/karaokes" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <PlaylistsIndexView 
                        type="karaokes"
                        isSidebarOpen={isDesktopSidebarOpen}
                        onToggleSidebar={toggleDesktopSidebar}
                      />
                    </motion.div>
                  } />

                  <Route path="/karaoke-playlist/:id" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <KaraokePlaylistRoute />
                    </motion.div>
                  } />

                  <Route path="/settings" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <SettingsView 
                        isSidebarOpen={isDesktopSidebarOpen}
                        onToggleSidebar={toggleDesktopSidebar}
                      />
                    </motion.div>
                  } />
                  <Route path="/karaokes" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0 h-full"
                    >
                      <KaraokeLibraryView
                        karaokes={karaokes}
                        activeKaraokeId={null}
                        onPlayKaraoke={(karaoke) => navigate(`/karaoke/${karaoke.id}`)}
                        isSidebarOpen={isDesktopSidebarOpen}
                        onToggleSidebar={toggleDesktopSidebar}
                      />
                    </motion.div>
                  } />

                  <Route path="/karaoke/:id" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0 h-full"
                    >
                      <KaraokePlayerRoute />
                    </motion.div>
                  } />

                  <Route path="/song/:id" element={
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute inset-0 h-full w-full"
                    >
                      <PlayerRoute songs={songs} />
                    </motion.div>
                  } />
                </Routes>
              </AnimatePresence>
            </Suspense>
          </ErrorBoundary>
        </main>
    </div>
  );
}

export default App;
