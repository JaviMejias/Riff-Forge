import { Search, Library, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SongCard } from './SongCard';
import { SongSkeleton } from './SongSkeleton';
import { CreatePlaylistModal } from './CreatePlaylistModal';
import { PasteChordsModal } from './PasteChordsModal';
import { ManagePlaylistsModal } from './ManagePlaylistsModal';
import { CreateSongModal } from './CreateSongModal';
import { AddSongOptionsModal } from './AddSongOptionsModal';
import { EditMetadataModal } from './EditMetadataModal';
import { Navbar } from './Navbar';
import { db } from '../db';
import type { Song } from '../db';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Toast } from '../utils/toast';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullIndicator } from './PullIndicator';

const MySwal = withReactContent(Swal);

interface LibraryViewProps {
  songs: Song[] | undefined;
  activeSongId: number | null;
  onPlaySong: (song: Song, autoEdit?: boolean) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const LibraryView = ({ songs, activeSongId, onPlaySong, onImport, isSidebarOpen, onToggleSidebar }: LibraryViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'text' | 'gp'>('all');
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<number | null>(null);
  const [songForNewPlaylist, setSongForNewPlaylist] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isCreateSongModalOpen, setIsCreateSongModalOpen] = useState(false);
  const [isAddOptionsModalOpen, setIsAddOptionsModalOpen] = useState(false);
  const [songForManagePlaylists, setSongForManagePlaylists] = useState<number | null>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const playlists = useLiveQuery(() => db.playlists.toArray()) || [];

  // Batch Selection State
  const [selectedSongIds, setSelectedSongIds] = useState<Set<number>>(new Set());
  const isMultiSelectMode = selectedSongIds.size > 0;

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedSongIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedSongIds(newSet);
  };

  const selectAll = () => {
    if (!filteredSongs) return;
    if (selectedSongIds.size === filteredSongs.length) {
      setSelectedSongIds(new Set());
    } else {
      setSelectedSongIds(new Set(filteredSongs.map(s => s.id!)));
    }
  };

  const deleteFullSong = async (id: number) => {
    await db.songs.delete(id);
    const allPlaylists = await db.playlists.toArray();
    for (const p of allPlaylists) {
      if (p.songIds.includes(id)) {
        await db.playlists.update(p.id!, {
          songIds: p.songIds.filter(sid => sid !== id)
        });
      }
    }
  };

  const handleCreateNewSong = () => {
    setIsCreateSongModalOpen(true);
  };

  const onSongCreated = async (newSongId: number) => {
    const newSong = await db.songs.get(newSongId);
    if (newSong) {
      onPlaySong(newSong, true); // true for autoEdit
    }
  };

  const deleteSong = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();

    const song = await db.songs.get(id);
    if (!song) return;

    const isHybrid = !!song.textContent && !!song.data;

    if (isHybrid) {
      await MySwal.fire({
        title: 'Opciones de Borrado',
        text: 'Esta canción contiene Tablatura y Letra. ¿Qué deseas hacer?',
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        background: '#18181b',
        color: '#f4f4f5',
        html: `
          <div class="flex flex-col gap-3 mt-4">
            <button id="btn-del-tab" class="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white font-bold transition-colors">Eliminar solo Tablatura</button>
            <button id="btn-del-txt" class="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white font-bold transition-colors">Eliminar solo Letra/Acordes</button>
            <button id="btn-del-all" class="px-4 py-3 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-colors border border-red-500/30">Eliminar Todo</button>
          </div>
        `,
        didOpen: () => {
          document.getElementById('btn-del-tab')?.addEventListener('click', () => {
            MySwal.close();
            db.songs.update(id, { type: 'text', data: undefined });
          });
          document.getElementById('btn-del-txt')?.addEventListener('click', () => {
            MySwal.close();
            db.songs.update(id, { type: 'gp', textContent: undefined });
          });
          document.getElementById('btn-del-all')?.addEventListener('click', async () => {
            MySwal.close();
            try {
              await deleteFullSong(id);
            } catch (e) {
              console.error(e);
              MySwal.fire({ icon: 'error', title: 'Error al borrar' });
            }
          });
        }
      });
      return;
    }

    const result = await MySwal.fire({
      title: '¿Borrar canción?',
      text: '¿Seguro que quieres borrar esta canción de tu biblioteca? (Se borrará también de tus listas)',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary-500)',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5'
    });

    if (result.isConfirmed) {
      await deleteFullSong(id);
    }
  };

  const handleTogglePublic = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const song = await db.songs.get(id);
    if (!song) return;
    
    await db.songs.update(id, { 
      isPublic: !song.isPublic,
      updatedAt: Date.now()
    });
    
    const { SyncService } = await import('../services/syncService');
    SyncService.scheduleAutoSync();
    
    Toast.fire({
      icon: 'success',
      title: !song.isPublic ? 'Canción hecha pública 🌐' : 'Canción ahora es privada 🔒',
    });
  };

  const deleteMultiple = () => {
    MySwal.fire({
      title: `¿Eliminar ${selectedSongIds.size} canciones?`,
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      background: '#18181b',
      color: '#f4f4f5',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        for (const id of selectedSongIds) {
          await deleteFullSong(id);
        }
        setSelectedSongIds(new Set());
        Toast.fire({
          icon: 'success',
          title: 'Canciones eliminadas'
        });
      }
    });
  };

  const toggleMultiplePublic = async () => {
    for (const id of selectedSongIds) {
      const s = await db.songs.get(id);
      if (s) {
        await db.songs.update(id, { isPublic: !s.isPublic, updatedAt: Date.now() });
      }
    }
    const { SyncService } = await import('../services/syncService');
    SyncService.scheduleAutoSync();
    
    Toast.fire({ icon: 'success', title: 'Privacidad actualizada en lote' });
    setSelectedSongIds(new Set());
  };

  const handleEditMetadata = async (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSong(song);
  };

  const handleSaveMetadata = async (newTitle: string, newArtist: string) => {
    if (!editingSong) return;

      if (!newTitle) {
        Toast.fire({ icon: 'error', title: 'El título es obligatorio' });
        return;
      }

      await db.songs.update(editingSong.id!, {
        name: newTitle,
        artist: newArtist,
        updatedAt: Date.now()
      });

      const { SyncService } = await import('../services/syncService');
      SyncService.scheduleAutoSync();

      Toast.fire({
        icon: 'success',
        title: 'Metadatos guardados'
      });
    setEditingSong(null);
  };

  const handleAddToPlaylistClick = (songId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playlists.length === 0) {
      MySwal.fire({
        title: 'Sin listas',
        text: 'No tienes listas de reproducción. Crea una primero en el menú lateral o desde aquí.',
        icon: 'info',
        background: '#18181b',
        color: '#f4f4f5',
        confirmButtonColor: '#f59e0b',
        showCancelButton: true,
        confirmButtonText: 'Crear nueva',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          handleCreateNewPlaylist(songId);
        }
      });
      return;
    }
    setSongForManagePlaylists(songId);
  };

  const handleCreateNewPlaylist = (songIdToForce?: number) => {
    const currentSongId = songIdToForce || songToAddToPlaylist;
    setSongToAddToPlaylist(null);
    if (!currentSongId) return;
    setSongForNewPlaylist(currentSongId);
    setIsCreateModalOpen(true);
  };

  const executeCreatePlaylist = async (name: string) => {
    if (!songForNewPlaylist) return;
    await db.playlists.add({
      name,
      songIds: [songForNewPlaylist],
      createdAt: Date.now()
    });
    setSongForNewPlaylist(null);

    Toast.fire({
      icon: 'success',
      title: '¡Lista creada y canción añadida!'
    });
  };

  const filteredSongs = songs?.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.artist && s.artist.toLowerCase().includes(searchQuery.toLowerCase()));

    // Si la canción tiene textContent, cuenta como 'text'. Si tiene data, cuenta como 'gp'.
    const hasText = !!s.textContent;
    const hasGp = !!s.data || s.type !== 'text'; // Fallback for old ones without explicit text

    let matchesFilter = false;
    if (filterType === 'all') matchesFilter = true;
    else if (filterType === 'text' && hasText) matchesFilter = true;
    else if (filterType === 'gp' && hasGp) matchesFilter = true;

    return matchesSearch && matchesFilter;
  });

  const { visibleItems: displayedSongs, loadMoreRef, hasMore } = useInfiniteScroll({ items: filteredSongs, itemsPerPage: 20 });

  const { containerRef: pullRef, pullProgress, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      try {
        const { SyncService } = await import('../services/syncService');
        await SyncService.performAutoSync();
        Toast.fire({ icon: 'success', title: 'Biblioteca actualizada' });
      } catch (e) {
        Toast.fire({ icon: 'error', title: 'Error al sincronizar' });
      }
    }
  });

  return (
    <div className="flex flex-col h-full w-full p-8">
      <Navbar
        title={isMultiSelectMode ? `${selectedSongIds.size} seleccionadas` : "Todas las Tabs"}
        subtitle={isMultiSelectMode ? "Acciones en lote" : "Colección Principal"}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      >
        <div className="flex gap-2 flex-wrap justify-end">
          {isMultiSelectMode ? (
            <>
              <button
                onClick={toggleMultiplePublic}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all font-bold text-sm"
              >
                <span>Privacidad</span>
              </button>
              <button
                onClick={deleteMultiple}
                className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all font-bold text-sm border border-rose-500/20"
              >
                <span>Eliminar</span>
              </button>
              <button
                onClick={() => setSelectedSongIds(new Set())}
                className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all text-sm"
              >
                <span>Cancelar</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsAddOptionsModalOpen(true)}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl transition-all font-bold text-sm shadow-[0_0_20px_var(--theme-glow)]"
              title="Añadir nueva canción"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Añadir Canción</span>
            </button>
          )}
        </div>
      </Navbar>

      <div ref={pullRef} className="flex-1 overflow-y-auto hide-scrollbar pb-10 mt-6">
        <PullIndicator pullProgress={pullProgress} isRefreshing={isRefreshing} />

        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-4 sm:p-6 min-h-[500px]">

          {/* HEADER DEL CONTENEDOR: Filtros y Buscador */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={selectAll}
                className={`p-2.5 rounded-xl border transition-all shrink-0 ${isMultiSelectMode && selectedSongIds.size === filteredSongs?.length ? 'bg-primary-500 border-primary-500 text-zinc-950' : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white hover:border-white/20'}`}
                title={isMultiSelectMode && selectedSongIds.size === filteredSongs?.length ? "Deseleccionar todo" : "Seleccionar todo"}
              >
                <div className="w-4 h-4 rounded-sm border border-current flex items-center justify-center">
                  {isMultiSelectMode && selectedSongIds.size === filteredSongs?.length && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
              </button>

              <div className="flex bg-zinc-900/50 border border-white/5 rounded-xl p-1 shadow-inner flex-1 sm:flex-none">
                <button
                  onClick={() => setFilterType('all')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'all' ? 'bg-primary-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterType('text')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'text' ? 'bg-primary-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                >
                  Acordes
                </button>
                <button
                  onClick={() => setFilterType('gp')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'gp' ? 'bg-primary-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                >
                  Tabs
                </button>
              </div>
            </div>

            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                placeholder="Buscar canción o artista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
              />
            </div>
          </div>

          {songs?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-[450px] text-zinc-500 border-2 border-dashed border-white/5 rounded-2xl bg-zinc-900/20"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="bg-primary-500/10 w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_var(--theme-glow)] border border-primary-500/30"
              >
                <Library size={40} className="text-primary-500" />
              </motion.div>
              <p className="text-xl font-bold text-zinc-300 mb-2">Tu colección está vacía</p>
              <p className="text-sm">Importa archivos GuitarPro para empezar.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {songs === undefined ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <SongSkeleton key={`skel-${i}`} />
                  ))
                ) : (
                  displayedSongs?.map((song, index) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      index={index}
                      isActive={activeSongId === song.id}
                      isSelected={selectedSongIds.has(song.id!)}
                      onToggleSelect={(e) => toggleSelect(song.id!, e)}
                      onPlay={() => onPlaySong(song)}
                      onAdd={(e) => handleAddToPlaylistClick(song.id!, e)}
                      onDelete={(e) => deleteSong(song.id!, e)}
                      onTogglePublic={(e) => handleTogglePublic(song.id!, e)}
                      onEditMetadata={(e) => handleEditMetadata(song, e)}
                    />
                  ))
                )}
              </AnimatePresence>

              {hasMore && (
                <div ref={loadMoreRef} className="col-span-full h-20 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin opacity-50"></div>
                </div>
              )}

              {filteredSongs?.length === 0 && searchQuery && (
                <div className="col-span-full py-12 text-center text-zinc-500">
                  No se encontraron resultados para "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {songForManagePlaylists !== null && (
        <ManagePlaylistsModal
          isOpen={true}
          onClose={() => setSongForManagePlaylists(null)}
          songId={songForManagePlaylists}
        />
      )}

      <CreateSongModal
        isOpen={isCreateSongModalOpen}
        onClose={() => setIsCreateSongModalOpen(false)}
        onSuccess={onSongCreated}
      />

      <AddSongOptionsModal
        isOpen={isAddOptionsModalOpen}
        onClose={() => setIsAddOptionsModalOpen(false)}
        onCreateNew={handleCreateNewSong}
        onPaste={() => setIsPasteModalOpen(true)}
        onImport={onImport}
      />

      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={executeCreatePlaylist}
      />
      <PasteChordsModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onSuccess={() => {
          // Play the newly pasted song immediately if desired, or just show alert
          MySwal.fire({
            title: '¡Canción Guardada!',
            icon: 'success',
            background: '#18181b',
            color: '#f4f4f5',
            timer: 1500,
            showConfirmButton: false
          });
        }}
      />
      <EditMetadataModal
        isOpen={!!editingSong}
        onClose={() => setEditingSong(null)}
        initialTitle={editingSong?.name || ''}
        initialArtist={editingSong?.artist || ''}
        onSave={handleSaveMetadata}
      />
    </div>
  );
};
