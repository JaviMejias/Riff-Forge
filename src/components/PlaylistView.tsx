import { Edit3, Trash, Search, Library, Plus, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SongCard } from './SongCard';
import { SongSkeleton } from './SongSkeleton';
import { Navbar } from './Navbar';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { AddSongsModal } from './AddSongsModal';
import { EditPlaylistModal } from './EditPlaylistModal';
import { db } from '../db';
import type { Song } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const playlist = useLiveQuery(() => db.playlists.get(playlistId));
  const songs = useLiveQuery(async () => {
    if (!playlist) return [];
    const fetchedSongs = await db.songs.where('id').anyOf(playlist.songIds).toArray();
    // Ordenar de acuerdo al array songIds original
    return fetchedSongs.sort((a, b) => playlist.songIds.indexOf(a.id!) - playlist.songIds.indexOf(b.id!));
  }, [playlist]);

  const allSongs = useLiveQuery(() => db.songs.toArray());
  const availableSongs = allSongs?.filter(s => s.id && !playlist?.songIds.includes(s.id)) || [];

  const removeSongFromPlaylist = async (songId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playlist || !playlist.id) return;

    const songToRemove = songs?.find(s => s.id === songId);

    const result = await MySwal.fire({
      title: '¿Quitar de la lista?',
      text: `¿Seguro que quieres quitar "${songToRemove?.name || 'esta canción'}" de esta lista? Seguirá estando en tu biblioteca principal.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b', // primary-500
      cancelButtonColor: '#3f3f46', // zinc-700
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5',
      customClass: {
        popup: 'rounded-2xl border border-white/10 shadow-2xl',
        confirmButton: 'rounded-xl font-bold px-6 text-zinc-950',
        cancelButton: 'rounded-xl font-bold px-6 text-white'
      }
    });

    if (result.isConfirmed) {
      await db.playlists.update(playlist.id, {
        songIds: playlist.songIds.filter(id => id !== songId)
      });
      
      MySwal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'success',
        title: 'Canción quitada de la lista',
        showConfirmButton: false,
        timer: 2000,
        background: '#18181b',
        color: '#f4f4f5',
      });
    }
  };

  const handleEditPlaylist = async (newName: string) => {
    if (!playlist || !playlist.id) return;
    
    await db.playlists.update(playlist.id, {
      name: newName
    });
    
    setIsEditModalOpen(false);
    
    MySwal.fire({
      title: '¡Actualizada!',
      text: 'El nombre de la lista ha sido cambiado.',
      icon: 'success',
      background: '#18181b',
      color: '#f4f4f5',
      timer: 1500,
      showConfirmButton: false
    });
  };

  const deletePlaylist = async () => {
    const result = await MySwal.fire({
      title: '¿Borrar esta lista?',
      text: `¿Seguro que quieres borrar la lista "${playlist?.name}"? Las canciones no se borrarán de tu biblioteca.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary-500)', // color dinámico del tema
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

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !playlist || !playlist.id) return;
    
    // Solo permitir drag and drop si no hay búsqueda activa (ya que altera el array)
    if (searchQuery) {
      MySwal.fire({
        title: 'Búsqueda Activa',
        text: 'No puedes reordenar canciones mientras hay una búsqueda activa.',
        icon: 'warning',
        background: '#18181b',
        color: '#f4f4f5'
      });
      return;
    }

    const newSongIds = Array.from(playlist.songIds);
    const [reorderedItem] = newSongIds.splice(result.source.index, 1);
    newSongIds.splice(result.destination.index, 0, reorderedItem);

    await db.playlists.update(playlist.id, { songIds: newSongIds });
  };

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
        <div className="flex gap-2 relative z-[100]" ref={mobileMenuRef}>
          {/* Botón menú hamburguesa (solo móvil) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden flex items-center justify-center p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all"
          >
            <MoreVertical size={20} />
          </button>

          {/* Contenedor de botones (visible en PC, menú desplegable en móvil) */}
          <div className={`
            absolute top-full right-0 mt-2 p-2 bg-zinc-900 border border-white/10 rounded-2xl shadow-xl flex-col gap-2 min-w-[160px]
            sm:static sm:mt-0 sm:p-0 sm:bg-transparent sm:border-none sm:shadow-none sm:flex sm:flex-row sm:w-auto
            ${isMobileMenuOpen ? 'flex' : 'hidden sm:flex'}
          `}>
            <button
              onClick={() => { setIsAddModalOpen(true); setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 sm:gap-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 px-4 sm:px-3 py-3 sm:py-2 rounded-xl transition-all font-bold text-sm sm:shadow-[0_0_15px_var(--theme-glow)] w-full sm:w-auto"
              title="Añadir Canciones"
            >
              <Plus size={18} className="sm:w-4 sm:h-4" /> <span>Añadir<span className="sm:hidden"> Canciones</span></span>
            </button>
            <button
              onClick={() => { setIsEditModalOpen(true); setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 sm:gap-2 bg-zinc-800/50 sm:bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 sm:px-3 py-3 sm:py-2 rounded-xl transition-all font-bold text-sm w-full sm:w-auto"
              title="Editar Nombre"
            >
              <Edit3 size={18} className="sm:w-4 sm:h-4" /> <span>Editar<span className="sm:hidden"> Nombre</span></span>
            </button>
            <button
              onClick={() => { deletePlaylist(); setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 sm:gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 px-4 sm:px-3 py-3 sm:py-2 rounded-xl transition-all font-bold text-sm border border-rose-500/20 hover:border-rose-500/50 w-full sm:w-auto"
              title="Borrar Lista"
            >
              <Trash size={18} className="sm:w-4 sm:h-4" /> <span>Borrar<span className="sm:hidden"> Lista</span></span>
            </button>
          </div>
        </div>
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
            <>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="playlist-songs" direction="horizontal">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps} 
                      ref={provided.innerRef}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    >
                      <AnimatePresence>
                        {songs === undefined ? (
                          Array.from({ length: 8 }).map((_, i) => (
                            <SongSkeleton key={`skel-${i}`} />
                          ))
                        ) : (
                          displayedSongs?.map((song, index) => (
                            <Draggable key={song.id!.toString()} draggableId={song.id!.toString()} index={index} isDragDisabled={!!searchQuery}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`${snapshot.isDragging ? 'z-50 scale-105 opacity-90 shadow-2xl' : ''}`}
                                  style={provided.draggableProps.style}
                                >
                                  <SongCard
                                    song={song}
                                    index={index}
                                    isActive={activeSongId === song.id}
                                    onPlay={() => onPlaySong(song)}
                                    onRemove={(e) => removeSongFromPlaylist(song.id!, e)}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                      </AnimatePresence>
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

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
            </>
          )}
        </div>
      </div>

      <AddSongsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSongs}
        availableItems={availableSongs}
      />

      <EditPlaylistModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentName={playlist.name}
        onSave={handleEditPlaylist}
      />
    </div>
  );
};
