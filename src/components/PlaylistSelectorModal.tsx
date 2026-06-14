import { useState, useMemo } from 'react';
import { Search, Plus, ListMusic } from 'lucide-react';
import type { Playlist } from '../db';
import { Modal } from './Modal';

interface PlaylistSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: Playlist[];
  onSelect: (playlistId: number) => void;
  onCreateNew: () => void;
}

export const PlaylistSelectorModal = ({ isOpen, onClose, playlists, onSelect, onCreateNew }: PlaylistSelectorModalProps) => {
  const [search, setSearch] = useState('');

  const filteredPlaylists = useMemo(() => {
    return playlists.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [playlists, search]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Añadir a lista"
      subtitle="Selecciona o busca una lista de reproducción."
    >
      {/* Search */}
      <div className="p-4 border-b border-white/5 bg-zinc-900/50">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            autoFocus
            placeholder="Buscar lista..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950/80 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-2">
        {filteredPlaylists.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-zinc-500">
            <ListMusic size={32} className="mb-2 opacity-20" />
            <p>No se encontraron listas.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredPlaylists.map(playlist => (
              <button
                key={playlist.id}
                onClick={() => onSelect(playlist.id!)}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all w-full text-left group"
              >
                <div className="w-12 h-12 rounded-lg bg-zinc-800/80 flex items-center justify-center group-hover:bg-amber-500/20 group-hover:text-amber-500 transition-colors shrink-0">
                  <ListMusic size={20} className="text-zinc-500 group-hover:text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-zinc-200 truncate group-hover:text-amber-400 transition-colors">
                    {playlist.name}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {playlist.songIds.length} {playlist.songIds.length === 1 ? 'canción' : 'canciones'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/5 bg-zinc-950/50">
        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 px-4 rounded-xl transition-all"
        >
          <Plus size={18} />
          Crear Nueva Lista
        </button>
      </div>
    </Modal>
  );
};
