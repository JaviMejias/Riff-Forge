import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Search, PlusCircle, Trash2, Guitar, Mic2, Edit3, MoreVertical } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import type { Playlist, KaraokePlaylist } from '../../db';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Link } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { CreatePlaylistModal } from '../CreatePlaylistModal';
import { Toast } from '../../utils/toast';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

const MySwal = withReactContent(Swal);

interface PlaylistsIndexViewProps {
  type: 'tabs' | 'karaokes';
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const PlaylistsIndexView = ({ type, isSidebarOpen, onToggleSidebar }: PlaylistsIndexViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // Query either tabs playlists or karaoke playlists
  const playlists = useLiveQuery<Array<Playlist | KaraokePlaylist>>(
    () => type === 'tabs' 
      ? db.playlists.orderBy('createdAt').reverse().toArray() 
      : db.karaokePlaylists.orderBy('createdAt').reverse().toArray(),
    [type]
  );

  const title = type === 'tabs' ? 'Listas de Partituras' : 'Listas de Karaokes';
  const subtitle = type === 'tabs' ? 'Organiza tus partituras y acordes' : 'Organiza tus pistas de karaoke';
  const Icon = type === 'tabs' ? Guitar : Mic2;

  const filteredPlaylists = playlists?.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { visibleItems: displayedPlaylists, loadMoreRef, hasMore } = useInfiniteScroll({ items: filteredPlaylists, itemsPerPage: 20 });

  const executeCreatePlaylist = async (name: string) => {
    const trimmedName = name.trim();
    if (type === 'tabs') {
      await db.playlists.add({ name: trimmedName, songIds: [], createdAt: Date.now() });
    } else {
      await db.karaokePlaylists.add({ name: trimmedName, karaokeIds: [], createdAt: Date.now() });
    }
    
    Toast.fire({
      icon: 'success',
      title: 'Lista creada'
    });
  };

  const handleDeletePlaylist = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const result = await MySwal.fire({
      title: '¿Eliminar lista?',
      text: "Se borrará la lista, pero las canciones/karaokes seguirán en tu biblioteca.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary-500)',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5',
    });

    if (result.isConfirmed) {
      if (type === 'tabs') {
        await db.playlists.delete(id);
      } else {
        await db.karaokePlaylists.delete(id);
      }
      MySwal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        icon: 'success',
        title: 'Lista eliminada',
        background: '#18181b',
        color: '#f4f4f5',
      });
    }
  };

  const handleRenamePlaylist = async (id: number, currentName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { value: newName } = await MySwal.fire({
      title: 'Renombrar Lista',
      input: 'text',
      inputValue: currentName,
      inputPlaceholder: 'Nuevo nombre de la lista',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--primary-500)',
      cancelButtonColor: '#3f3f46',
      background: '#18181b',
      color: '#f4f4f5',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return '¡El nombre no puede estar vacío!';
        }
        return null;
      }
    });

    if (newName && newName.trim() !== currentName) {
      if (type === 'tabs') {
        await db.playlists.update(id, { name: newName.trim() });
      } else {
        await db.karaokePlaylists.update(id, { name: newName.trim() });
      }
      MySwal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        icon: 'success',
        title: 'Lista renombrada',
        background: '#18181b',
        color: '#f4f4f5',
      });
    }
  };

  return (
    <div className="flex h-full w-full flex-col px-3 py-2 sm:p-4 lg:p-6">
      <Navbar
        title={title}
        subtitle={subtitle}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      >
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 px-4 py-2.5 rounded-xl transition-all cursor-pointer font-bold text-sm shadow-[0_0_20px_var(--theme-glow)]"
        >
          <PlusCircle size={16} /> <span className="hidden sm:inline">Crear Lista</span>
        </button>
      </Navbar>

      <div className="flex-1 overflow-y-auto hide-scrollbar pb-6 mt-3 sm:mt-5">
        <div className="min-h-full rounded-2xl border border-white/5 bg-zinc-900/30 p-3 sm:rounded-3xl sm:p-6">
          
          {/* HEADER DEL CONTENEDOR: Buscador */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-6">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                aria-label="Buscar listas de reproducción"
                placeholder="Buscar en tus listas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
              />
            </div>
          </div>
        {filteredPlaylists?.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex min-h-80 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/5 bg-zinc-900/20 px-5 text-center text-zinc-500 sm:min-h-[450px]"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="bg-primary-500/10 w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_var(--theme-glow)] border border-primary-500/30"
            >
              <Folder size={40} className="text-primary-500" />
            </motion.div>
            <p className="text-xl font-bold text-zinc-300 mb-2">No hay listas</p>
            <p className="text-sm max-w-sm text-center">
              {searchQuery 
                ? 'No encontramos ninguna lista que coincida con tu búsqueda.' 
                : 'Crea tu primera lista para organizar tu música.'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-5">
            <AnimatePresence>
              {displayedPlaylists?.map((playlist) => {
                const count = 'songIds' in playlist ? playlist.songIds.length : playlist.karaokeIds.length;
                const linkPath = type === 'tabs' ? `/playlist/${playlist.id}` : `/karaoke-playlist/${playlist.id}`;
                
                return (
                  <motion.div
                    key={playlist.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -5 }}
                    className="group relative has-[details[open]]:z-50"
                  >
                    <Link
                      to={linkPath}
                      className="relative flex min-h-24 h-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 p-3 pr-14 text-left shadow-lg transition-all hover:border-primary-500/50 hover:bg-zinc-800/80 sm:flex-col sm:gap-4 sm:p-6 sm:text-center"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 shadow-inner transition-transform group-hover:scale-105 sm:h-20 sm:w-20">
                        <Icon size={28} className="text-primary-500 opacity-80 sm:h-8 sm:w-8" />
                        <div className="absolute -bottom-1 -right-1 rounded-lg border border-white/10 bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-300 shadow-lg sm:-bottom-2 sm:-right-2">
                          {count}
                        </div>
                      </div>
                      
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 text-base font-bold text-white transition-colors group-hover:text-primary-400 sm:text-lg">
                          {playlist.name}
                        </h3>
                        <p className="text-zinc-500 text-sm mt-1">
                          {count} {count === 1 ? (type === 'tabs' ? 'Partitura' : 'Karaoke') : (type === 'tabs' ? 'Partituras' : 'Karaokes')}
                        </p>
                      </div>
                    </Link>
                    <div className="absolute right-3 top-3 z-20 hidden gap-2 opacity-0 transition-opacity sm:flex sm:group-hover:opacity-100">
                      <button onClick={(event) => handleRenamePlaylist(playlist.id!, playlist.name, event)} className="rounded-lg bg-zinc-800/90 p-2 text-zinc-300 shadow-lg backdrop-blur-md transition-all hover:bg-primary-500 hover:text-zinc-950" title="Renombrar lista"><Edit3 size={16} /></button>
                      <button onClick={(event) => handleDeletePlaylist(playlist.id!, event)} className="rounded-lg bg-red-500/90 p-2 text-white shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-red-500" title="Eliminar lista"><Trash2 size={16} /></button>
                    </div>
                    <details className="absolute right-2 top-2 z-40 sm:hidden" onClick={event => event.stopPropagation()}>
                      <summary title="Acciones" aria-label={`Acciones de ${playlist.name}`} className="flex min-h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-zinc-950/90 text-zinc-300 shadow-lg [&::-webkit-details-marker]:hidden">
                        <MoreVertical size={20} />
                      </summary>
                      <div className="absolute right-0 top-12 flex min-w-44 flex-col gap-1 rounded-2xl border border-white/10 bg-zinc-950 p-2 text-sm font-semibold shadow-2xl">
                        <button onClick={(event) => handleRenamePlaylist(playlist.id!, playlist.name, event)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-zinc-200 active:bg-zinc-800"><Edit3 size={17} />Renombrar</button>
                        <button onClick={(event) => handleDeletePlaylist(playlist.id!, event)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-rose-400 active:bg-rose-500/10"><Trash2 size={17} />Eliminar</button>
                      </div>
                    </details>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {hasMore && (
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-6">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin opacity-50"></div>
          </div>
        )}
        </div>
      </div>

      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={executeCreatePlaylist}
      />
    </div>
  );
};
