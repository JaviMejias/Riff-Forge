import { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { SongCard } from './SongCard';
import { KaraokeCard } from './karaoke/KaraokeCard';
import { Users, Loader2, Download, Music, Mic2, Search, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { db } from '../db';
import type { Karaoke, Song } from '../db';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Toast } from '../utils/toast';
import { API_BASE_URL } from '../config'; // FE-1: use central config, no hardcoded IPs

const MySwal = withReactContent(Swal);
const API_URL = `${API_BASE_URL}/api`;
const getCurrentTimestamp = () => Date.now();

type CommunityItem = Song & Partial<Karaoke> & {
  userId?: string;
  user?: { name?: string };
};

interface CommunityViewProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const CommunityView = ({ isSidebarOpen, onToggleSidebar }: CommunityViewProps) => {
  const [activeTab, setActiveTab] = useState<'songs' | 'karaokes'>('songs');
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const isMultiSelectMode = selectedIds.size > 0;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = normalizedQuery
    ? items.filter((item) =>
        [item.name, item.artist, item.user?.name]
          .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
      )
    : items;

  const token = useAuthStore(state => state.token);
  const currentUser = useAuthStore(state => state.user);

  // FE-5: AbortController prevents race conditions when switching tabs quickly
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/community/${activeTab}?t=${Date.now()}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          cache: 'no-store',
          signal: controller.signal
        });
        if (!res.ok) throw new Error('Error fetching community items');
        const data = await res.json();
        if (isMounted) setItems(data);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return; // tab switched — ignore stale response
        console.error(error);
        if (isMounted) Toast.fire({ icon: 'error', title: 'Error al cargar la comunidad' });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    run();
    return () => { isMounted = false; controller.abort(); };
  }, [activeTab, token]);

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === visibleItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleItems.map(i => i.id!)));
    }
  };

  const executeCloneItem = async (item: CommunityItem) => {
    if (currentUser && item.userId === currentUser.id) return;
    try {
      if (activeTab === 'songs') {
        let fileData = undefined;
        if (item.cloudUrl) {
          const res = await fetch(`${API_BASE_URL}${item.cloudUrl}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          });
          if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
          const blob = await res.blob();
          const arrayBuffer = await blob.arrayBuffer();
          fileData = new Uint8Array(arrayBuffer);
        }
        const titleNorm = item.name.toLowerCase();
        const artistNorm = (item.artist || '').toLowerCase();

        const existingSongs = await db.songs.toArray();
        const existing = existingSongs.find(s => 
          s.name.toLowerCase() === titleNorm && 
          (s.artist || '').toLowerCase() === artistNorm
        );

        if (existing) {
          // Merge existing
          const newType = fileData ? 'gp' : existing.type;
          await db.songs.update(existing.id!, {
            type: newType,
            textContent: item.textContent || existing.textContent,
            originalKey: item.originalKey || existing.originalKey,
            tuning: item.tuning || existing.tuning,
            strummingPattern: item.strummingPattern || existing.strummingPattern,
            capo: item.capo || existing.capo,
            data: fileData || existing.data,
            updatedAt: getCurrentTimestamp()
          });
        } else {
          await db.songs.add({
            name: item.name,
            artist: item.artist,
            album: item.album,
            type: item.type,
            textContent: item.textContent,
            originalKey: item.originalKey,
            tuning: item.tuning,
            strummingPattern: item.strummingPattern,
            capo: item.capo,
            data: fileData,
            dateAdded: getCurrentTimestamp(),
            isPublic: false
          });
        }
      } else {
        const authorName = item.user?.name || 'Usuario';
        const finalName = `${item.name} (por ${authorName})`;
        
        const existingKaraokes = await db.karaokes.toArray();
        const existing = existingKaraokes.find(k => 
          k.name.toLowerCase() === finalName.toLowerCase() && 
          (k.artist || '').toLowerCase() === (item.artist || '').toLowerCase()
        );

        if (existing) {
          const Swal = (await import('sweetalert2')).default;
          Swal.fire({
            icon: 'info',
            title: 'Versión ya clonada',
            text: 'Ya tienes esta versión exacta en tu biblioteca.',
            background: '#18181b',
            color: '#f4f4f5'
          });
          return;
        }

        const targetId = await db.karaokes.add({
          name: finalName,
          artist: item.artist,
          youtubeUrl: item.youtubeUrl,
          cloudUrl: item.cloudUrl,
          hasLocalAudio: item.hasLocalAudio,
          pitchShift: item.pitchShift,
          textContent: item.textContent,
          dateAdded: getCurrentTimestamp(),
          isPublic: false
        }) as number;

        if (item.cloudUrl) {
          const res = await fetch(`${API_BASE_URL}${item.cloudUrl}`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          });
          if (res.ok) {
              const blob = await res.blob();
              const arrayBuffer = await blob.arrayBuffer();
              await db.karaokeFiles.put({
                  karaokeId: targetId,
                  data: new Uint8Array(arrayBuffer)
              });
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const cloneMultiple = async () => {
    const confirm = await MySwal.fire({
      title: `¿Clonar ${selectedIds.size} elementos?`,
      text: `Se añadirán a tu biblioteca personal.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary-500)',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, clonar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5'
    });

    if (confirm.isConfirmed) {
      Toast.fire({ icon: 'info', title: 'Clonando...' });
      for (const id of selectedIds) {
        const item = items.find(i => i.id === id);
        if (item) {
          await executeCloneItem(item);
        }
      }
      Toast.fire({ icon: 'success', title: 'Elementos clonados a tu biblioteca' });
      setSelectedIds(new Set());
    }
  };

  const cloneSong = async (item: CommunityItem) => {
    if (currentUser && item.userId === currentUser.id) {
      Toast.fire({ icon: 'info', title: 'Este aporte es tuyo', text: 'Ya tienes este elemento en tu biblioteca.' });
      return;
    }

    const confirm = await MySwal.fire({
      title: `¿Clonar "${item.name}"?`,
      text: `Se añadirá a tu biblioteca personal.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary-500)',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, clonar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5'
    });

    if (confirm.isConfirmed) {
      Toast.fire({ icon: 'info', title: 'Clonando...' });
      await executeCloneItem(item);
      Toast.fire({ icon: 'success', title: 'Añadido a tu biblioteca' });
    }
  };

  return (
    <div className="flex h-full w-full flex-col px-3 py-2 sm:p-4 lg:p-6">
      <Navbar
        title={isMultiSelectMode ? `${selectedIds.size} seleccionados` : "Comunidad"}
        subtitle={isMultiSelectMode ? "Acciones en lote" : "Explora y clona contenido de otros usuarios"}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      >
        <div className="flex gap-2 flex-wrap justify-end items-center">
          {isMultiSelectMode ? (
            <>
              <button
                onClick={cloneMultiple}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all font-bold text-sm shadow-[0_0_20px_var(--theme-glow)]"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Clonar a Biblioteca</span>
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all text-sm"
              >
                <span>Cancelar</span>
              </button>
            </>
          ) : (
            <div className="hidden sm:flex bg-zinc-900/80 p-1 rounded-xl border border-white/5 shadow-inner">
              <button
                onClick={() => { setActiveTab('songs'); setSelectedIds(new Set()); setQuery(''); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${
                  activeTab === 'songs' 
                    ? 'bg-primary-500 text-zinc-950 shadow-lg' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Music size={16} /> Canciones
              </button>
              <button
                onClick={() => { setActiveTab('karaokes'); setSelectedIds(new Set()); setQuery(''); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${
                  activeTab === 'karaokes' 
                    ? 'bg-primary-500 text-zinc-950 shadow-lg' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Mic2 size={16} /> Karaokes
              </button>
            </div>
          )}
        </div>
      </Navbar>

      {!isMultiSelectMode && (
        <div className="mt-2 sm:hidden grid grid-cols-2 gap-1 p-1 bg-zinc-900/80 rounded-xl border border-white/5">
          <button
            onClick={() => { setActiveTab('songs'); setSelectedIds(new Set()); setQuery(''); }}
            className={`min-h-10 flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'songs' ? 'bg-primary-500 text-zinc-950' : 'text-zinc-400'}`}
          >
            <Music size={16} /> Canciones
          </button>
          <button
            onClick={() => { setActiveTab('karaokes'); setSelectedIds(new Set()); setQuery(''); }}
            className={`min-h-10 flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'karaokes' ? 'bg-primary-500 text-zinc-950' : 'text-zinc-400'}`}
          >
            <Mic2 size={16} /> Karaokes
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto hide-scrollbar pb-6 mt-3 sm:mt-5">
        <div className="min-h-full rounded-2xl border border-white/5 bg-zinc-900/30 p-3 sm:rounded-3xl sm:p-6">
          {!loading && items.length > 0 && (
            <div className="relative mb-4 sm:mb-6">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="search"
                aria-label={`Buscar ${activeTab === 'songs' ? 'canciones' : 'karaokes'} en la comunidad`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Buscar ${activeTab === 'songs' ? 'canciones' : 'karaokes'}, artistas o usuarios`}
                className="w-full min-h-11 bg-zinc-950/60 border border-white/10 rounded-xl pl-11 pr-11 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={17} />
                </button>
              )}
            </div>
          )}
          
          {/* HEADER DEL CONTENEDOR */}
          {visibleItems.length > 0 && !loading && (
            <div className="flex mb-4 sm:mb-6">
              <button
                onClick={selectAll}
                className={`min-w-11 min-h-11 p-2.5 rounded-xl border transition-all shrink-0 ${isMultiSelectMode && selectedIds.size === visibleItems.length ? 'bg-primary-500 border-primary-500 text-zinc-950' : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white hover:border-white/20'}`}
                title={isMultiSelectMode && selectedIds.size === visibleItems.length ? "Deseleccionar todo" : "Seleccionar todo"}
              >
                <div className="w-4 h-4 rounded-sm border border-current flex items-center justify-center">
                  {isMultiSelectMode && selectedIds.size === visibleItems.length && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
              </button>
            </div>
          )}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-zinc-500">
              <Loader2 className="animate-spin w-10 h-10 mb-4 text-primary-500" />
              <p>Cargando comunidad...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-72 sm:h-[400px] px-5 text-center text-zinc-500 border-2 border-dashed border-white/5 rounded-2xl bg-zinc-900/20">
              <Users size={40} className="mb-4 text-zinc-600" />
              <p className="text-xl font-bold text-zinc-400">No hay contenido público</p>
              <p className="text-sm">Sé el primero en compartir algo.</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-64 px-5 text-center border-2 border-dashed border-white/5 rounded-2xl">
              <Search size={36} className="text-zinc-700 mb-3" />
              <p className="font-bold text-zinc-300">No encontramos coincidencias</p>
              <p className="text-sm text-zinc-500 mt-1">Prueba con otro título, artista o usuario.</p>
              <button onClick={() => setQuery('')} className="mt-4 min-h-11 px-4 rounded-xl bg-zinc-800 text-white font-bold text-sm">Limpiar búsqueda</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              <AnimatePresence mode="popLayout">
                {visibleItems.map((item, index) => (
                  <div key={item.id} className="relative group">
                    {activeTab === 'songs' ? (
                      <SongCard
                        song={item}
                        isActive={false}
                        isSelected={selectedIds.has(item.id!)}
                        onToggleSelect={(e) => toggleSelect(item.id!, e)}
                        index={index}
                        onPlay={() => cloneSong(item)}
                      />
                    ) : (
                      <KaraokeCard
                        karaoke={item}
                        isActive={false}
                        isSelected={selectedIds.has(item.id!)}
                        onToggleSelect={(e) => toggleSelect(item.id!, e)}
                        index={index}
                        onPlay={() => cloneSong(item)}
                        onDelete={() => {}}
                      />
                    )}
                    {/* Contribuidor */}
                    <div className="hidden sm:block absolute -top-3 -left-3 z-30 bg-zinc-800 border border-primary-500/30 text-primary-400 text-xs px-2 py-1 rounded-lg shadow-xl shadow-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      Subido por {item.user?.name || 'Usuario'}
                    </div>
                    {/* Icono Descargar overlay */}
                    <div className="hidden sm:flex absolute inset-0 z-20 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black/50 absolute inset-0 rounded-2xl"></div>
                      <div className="flex flex-col items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-all">
                        {currentUser?.id === item.userId ? (
                          <div key="own" className="flex flex-col items-center">
                            <div className="text-primary-400 mb-2 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]">🌐</div>
                            <span className="text-white font-bold tracking-widest uppercase text-xs text-center px-2">Tu Aporte<br/>Público</span>
                          </div>
                        ) : (
                          <div key="other" className="flex flex-col items-center">
                            <Download size={32} className="text-primary-400 mb-2 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                            <span className="text-white font-bold tracking-widest uppercase text-xs text-center px-2">Clonar a<br/>Biblioteca</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="sm:hidden mt-1.5 min-h-11 flex items-center justify-between gap-2 px-3 rounded-xl bg-zinc-900/70 border border-white/5">
                      <span className="text-xs text-zinc-500 truncate">Por {item.user?.name || 'Usuario'}</span>
                      {currentUser?.id === item.userId ? (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-primary-400 shrink-0">Tu aporte</span>
                      ) : (
                        <button onClick={() => cloneSong(item)} className="min-h-9 flex items-center gap-1.5 text-xs font-bold text-primary-400 shrink-0">
                          <Download size={15} /> Clonar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
