import { Edit3, Trash, Search, Library, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KaraokeCard } from '../karaoke/KaraokeCard';
import { Navbar } from '../Navbar';
import { AddSongsModal } from '../AddSongsModal'; // We'll adapt this or make AddKaraokeModal
import { db } from '../../db';
import type { Karaoke } from '../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

const MySwal = withReactContent(Swal);

interface KaraokePlaylistViewProps {
  playlistId: number;
  activeKaraokeId: number | null;
  onPlayKaraoke: (karaoke: Karaoke) => void;
  onBackToLibrary: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const KaraokePlaylistView = ({ playlistId, activeKaraokeId, onPlayKaraoke, onBackToLibrary, isSidebarOpen, onToggleSidebar }: KaraokePlaylistViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const playlist = useLiveQuery(() => db.karaokePlaylists.get(playlistId));
  const karaokes = useLiveQuery(async () => {
    if (!playlist) return [];
    return await db.karaokes.where('id').anyOf(playlist.karaokeIds).toArray();
  }, [playlist]);

  const allKaraokes = useLiveQuery(() => db.karaokes.toArray());
  const availableKaraokes = allKaraokes?.filter(k => k.id && !playlist?.karaokeIds.includes(k.id)) || [];

  const removeKaraokeFromPlaylist = async (karaokeId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playlist || !playlist.id) return;

    await db.karaokePlaylists.update(playlist.id, {
      karaokeIds: playlist.karaokeIds.filter(id => id !== karaokeId)
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
      await db.karaokePlaylists.update(playlist.id, {
        name: newName.trim()
      });
      MySwal.fire({
        toast: true,
        position: 'top-end',
        title: '¡Actualizada!',
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
      text: `¿Seguro que quieres borrar la lista "${playlist?.name}"? Los karaokes no se borrarán de tu biblioteca.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, borrar lista',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5'
    });

    if (result.isConfirmed) {
      await db.karaokePlaylists.delete(playlistId);
      onBackToLibrary();
      MySwal.fire({
        toast: true,
        position: 'top-end',
        title: '¡Borrada!',
        icon: 'success',
        background: '#18181b',
        color: '#f4f4f5',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  const handleAddKaraokes = async (karaokeIds: number[]) => {
    if (!playlist || !playlist.id) return;
    await db.karaokePlaylists.update(playlist.id, {
      karaokeIds: [...playlist.karaokeIds, ...karaokeIds]
    });
    MySwal.fire({
      toast: true,
      position: 'top-end',
      title: 'Añadidos a la lista',
      icon: 'success',
      background: '#18181b',
      color: '#f4f4f5',
      timer: 1500,
      showConfirmButton: false
    });
  };

  if (!playlist) return null;

  const filteredKaraokes = karaokes?.filter(k => 
    k.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    k.artist?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const { visibleItems: displayedKaraokes, loadMoreRef, hasMore } = useInfiniteScroll({ items: filteredKaraokes, itemsPerPage: 20 });

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-8 pb-4 shrink-0">
        <Navbar
          title={playlist.name}
          subtitle={`Lista de Karaoke • ${karaokes?.length || 0} pistas`}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={onToggleSidebar}
          onBack={onBackToLibrary}
        >
          <div className="flex gap-2">
            <button
              onClick={editPlaylist}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              title="Editar Nombre"
            >
              <Edit3 size={18} />
            </button>
            <button
              onClick={deletePlaylist}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
              title="Borrar Lista"
            >
              <Trash size={18} />
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 px-4 py-2 rounded-xl transition-all font-bold text-sm"
            >
              <Plus size={18} /> Añadir Karaokes
            </button>
          </div>
        </Navbar>
      </div>

      <div className="px-8 pb-4 shrink-0">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar en esta lista..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all shadow-inner"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 pt-4 hide-scrollbar">
        {filteredKaraokes?.length === 0 ? (
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
            <p className="text-xl font-bold text-zinc-300 mb-2">La lista está vacía</p>
            <p className="text-sm max-w-sm text-center">
              {searchQuery 
                ? 'Ningún karaoke coincide con tu búsqueda.' 
                : 'Añade algunos karaokes a esta lista usando el botón superior.'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <AnimatePresence>
              {displayedKaraokes?.map((karaoke, idx) => (
                <motion.div
                  key={karaoke.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -5 }}
                >
                  <div className="relative group h-full">
                    <KaraokeCard
                      karaoke={karaoke}
                      isActive={karaoke.id === activeKaraokeId}
                      index={idx}
                      onPlay={() => onPlayKaraoke(karaoke)}
                      onDelete={(e) => removeKaraokeFromPlaylist(karaoke.id!, e)}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {hasMore && (
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-6">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin opacity-50"></div>
          </div>
        )}
      </div>

      <AddSongsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        availableItems={availableKaraokes}
        onAdd={handleAddKaraokes}
        title="Añadir Karaokes a la Lista"
        itemLabel="Karaokes"
      />
    </div>
  );
};
