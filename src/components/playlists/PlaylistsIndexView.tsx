import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, Search, PlusCircle, Trash2, Guitar, Mic2, Edit3 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Link } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { CreatePlaylistModal } from '../CreatePlaylistModal';
import { Toast } from '../../utils/toast';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { PullIndicator } from '../PullIndicator';

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
  const playlists = useLiveQuery<any[]>(
    () => type === 'tabs' 
      ? db.playlists.orderBy('createdAt').reverse().toArray() 
      : db.karaokePlaylists.orderBy('createdAt').reverse().toArray(),
    [type]
  );

  const title = type === 'tabs' ? 'Listas de Partituras' : 'Listas de Karaokes';
  const subtitle = type === 'tabs' ? 'Organiza tus partituras y acordes' : 'Organiza tus pistas de karaoke';
  const Icon = type === 'tabs' ? Guitar : Mic2;

  const { containerRef: pullRef, pullProgress, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      const { SyncService } = await import('../../services/syncService');
      await SyncService.performAutoSync();
    },
  });

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
    <div className="flex flex-col h-full w-full p-8">
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

      <div ref={pullRef} className="flex-1 overflow-y-auto hide-scrollbar pb-10 mt-6">
        <PullIndicator pullProgress={pullProgress} isRefreshing={isRefreshing} />
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-4 sm:p-6 min-h-[500px]">
          
          {/* HEADER DEL CONTENEDOR: Buscador */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-6">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
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
            className="flex flex-col items-center justify-center h-[450px] text-zinc-500 border-2 border-dashed border-white/5 rounded-2xl bg-zinc-900/20"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <AnimatePresence>
              {displayedPlaylists?.map((playlist) => {
                const count = type === 'tabs' ? (playlist as any).songIds?.length || 0 : (playlist as any).karaokeIds?.length || 0;
                const linkPath = type === 'tabs' ? `/playlist/${playlist.id}` : `/karaoke-playlist/${playlist.id}`;
                
                return (
                  <motion.div
                    key={playlist.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -5 }}
                    className="group"
                  >
                    <Link
                      to={linkPath}
                      className="bg-zinc-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center gap-4 hover:border-primary-500/50 hover:bg-zinc-800/80 transition-all shadow-lg cursor-pointer h-full relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      
                      <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20">
                        <button
                          onClick={(e) => handleRenamePlaylist(playlist.id!, playlist.name, e)}
                          className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-primary-500 hover:text-zinc-950 transition-all backdrop-blur-md shadow-lg"
                          title="Renombrar lista"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDeletePlaylist(playlist.id!, e)}
                          className="p-2 rounded-lg bg-red-500/80 text-white hover:bg-red-500 hover:scale-110 transition-all backdrop-blur-md shadow-lg"
                          title="Eliminar lista"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="w-20 h-20 bg-zinc-950 rounded-2xl flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform">
                        <Icon size={32} className="text-primary-500 opacity-80" />
                        <div className="absolute -bottom-2 -right-2 bg-zinc-800 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 shadow-lg">
                          {count}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-white font-bold text-lg line-clamp-1 group-hover:text-primary-400 transition-colors">
                          {playlist.name}
                        </h3>
                        <p className="text-zinc-500 text-sm mt-1">
                          {count} {count === 1 ? (type === 'tabs' ? 'Partitura' : 'Karaoke') : (type === 'tabs' ? 'Partituras' : 'Karaokes')}
                        </p>
                      </div>
                    </Link>
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
