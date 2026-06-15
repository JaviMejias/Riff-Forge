import { Edit3, Trash, Search, Library, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SongCard } from './SongCard';
import { SongSkeleton } from './SongSkeleton';
import { Navbar } from './Navbar';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { AddSongsModal } from './AddSongsModal';
import { db } from '../db';
import type { Song } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

interface PlaylistViewProps {
  playlistId: number;
  activeSongId: number | null;
  onPlaySong: (song: Song, autoEdit?: boolean) => void;
  onBackToLibrary: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const PlaylistView = ({ playlistId, activeSongId, onPlaySong, onBackToLibrary, isSidebarOpen, onToggleSidebar }: PlaylistViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const playlist = useLiveQuery(() => db.playlists.get(playlistId));
  const songs = useLiveQuery(async () => {
    if (!playlist) return [];
    return await db.songs.where('id').anyOf(playlist.songIds).toArray();
  }, [playlist]);

  const allSongs = useLiveQuery(() => db.songs.toArray());
  const availableSongs = allSongs?.filter(s => s.id && !playlist?.songIds.includes(s.id)) || [];

  const removeSongFromPlaylist = async (songId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playlist || !playlist.id) return;

    await db.playlists.update(playlist.id, {
      songIds: playlist.songIds.filter(id => id !== songId)
    });
  };

  const editPlaylist = async () => {
    if (!playlist || !playlist.id) return;

    const { value: newName } = await MySwal.fire({
      title: 'Editar Lista',
      input: 'text',
      inputLabel: 'Nuevo nombre de la lista',
      inputValue: playlist.name,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b',
      background: '#18181b',
      color: '#f4f4f5',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return '¡Debes escribir un nombre!';
        }
      }
    });

    if (newName && newName.trim() && newName.trim() !== playlist.name) {
      await db.playlists.update(playlist.id, {
        name: newName.trim()
      });
      MySwal.fire({
        title: '¡Actualizada!',
        text: 'El nombre de la lista ha sido cambiado.',
        icon: 'success',
        background: '#18181b',
        color: '#f4f4f5',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  const deletePlaylist = async () => {
    const result = await MySwal.fire({
      title: '¿Borrar esta lista?',
      text: `¿Seguro que quieres borrar la lista "${playlist?.name}"? Las canciones no se borrarán de tu biblioteca.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444', // rose-500
      cancelButtonColor: '#3f3f46', // zinc-700
      confirmButtonText: 'Sí, borrar lista',
      cancelButtonText: 'Cancelar',
      background: '#18181b', // zinc-900
      color: '#f4f4f5'
    });

    if (result.isConfirmed) {
      await db.playlists.delete(playlistId);
      onBackToLibrary();
      MySwal.fire({
        title: '¡Borrada!',
        text: 'La lista ha sido eliminada.',
        icon: 'success',
        background: '#18181b',
        color: '#f4f4f5',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  const handleAddSongs = async (songIds: number[]) => {
    if (!playlist || !playlist.id) return;
    await db.playlists.update(playlist.id, {
      songIds: [...playlist.songIds, ...songIds]
    });
    MySwal.fire({
      title: '¡Añadidas!',
      text: `Se añadieron ${songIds.length} canciones a la lista.`,
      icon: 'success',
      background: '#18181b',
      color: '#f4f4f5',
      timer: 1500,
      showConfirmButton: false
    });
  };

  const filteredSongs = songs?.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.artist && s.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const { visibleItems: displayedSongs, loadMoreRef, hasMore } = useInfiniteScroll({ items: filteredSongs, itemsPerPage: 20 });

  if (!playlist) return null;

  return (
    <div className="flex flex-col h-full w-full p-8">
      <Navbar
        title={playlist.name}
        subtitle={`Lista de Reproducción • ${songs?.length || 0} canciones`}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onBack={onBackToLibrary}
      >
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 px-3 py-2 rounded-xl transition-all font-bold text-sm shadow-[0_0_15px_var(--theme-glow)]"
          title="Añadir Canciones"
        >
          <Plus size={16} /> <span className="hidden sm:inline">Añadir</span>
        </button>
        <button
          onClick={editPlaylist}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-xl transition-all font-bold text-sm"
          title="Editar Nombre"
        >
          <Edit3 size={16} /> <span className="hidden sm:inline">Editar</span>
        </button>
        <button
          onClick={deletePlaylist}
          className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 px-3 py-2 rounded-xl transition-all font-bold text-sm border border-rose-500/20 hover:border-rose-500/50"
          title="Borrar Lista"
        >
          <Trash size={16} /> <span className="hidden sm:inline">Borrar</span>
        </button>
      </Navbar>

      {/* LISTA DE CANCIONES */}
      <div className="flex-1 overflow-y-auto hide-scrollbar pb-10 mt-6">
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-4 sm:p-6 min-h-[500px]">

          {/* HEADER DEL CONTENEDOR: Buscador */}
          <div className="flex justify-end mb-6">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                placeholder="Buscar en la lista..."
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
              <p className="text-xl font-bold text-zinc-300 mb-2">Esta lista está vacía</p>
              <p className="text-sm">Ve a tu biblioteca y añade algunas canciones.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
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
                      onPlay={() => onPlaySong(song)}
                      onRemove={(e) => removeSongFromPlaylist(song.id!, e)}
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

      <AddSongsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSongs}
        availableItems={availableSongs}
      />
    </div>
  );
};
