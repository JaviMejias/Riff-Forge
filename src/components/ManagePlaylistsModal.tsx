import { ListMusic, CheckCircle2, Circle } from 'lucide-react';
import { Modal } from './Modal';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Playlist } from '../db';

interface ManagePlaylistsModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId: number;
}

export const ManagePlaylistsModal = ({ isOpen, onClose, songId }: ManagePlaylistsModalProps) => {
  const playlists = useLiveQuery(() => db.playlists.toArray()) || [];
  
  const togglePlaylist = async (playlist: Playlist) => {
    if (!playlist.id) return;
    const isIncluded = playlist.songIds.includes(songId);
    
    let newSongIds;
    if (isIncluded) {
      newSongIds = playlist.songIds.filter(id => id !== songId);
    } else {
      newSongIds = [...playlist.songIds, songId];
    }
    
    await db.playlists.update(playlist.id, { songIds: newSongIds });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gestionar Listas"
      subtitle="Añade o quita esta canción de tus listas de reproducción."
      icon={<ListMusic size={24} />}
    >
      <div className="p-6 flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar">
        {playlists.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <p>No tienes listas de reproducción creadas.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {playlists.map((playlist) => {
              const isIncluded = playlist.songIds.includes(songId);
              return (
                <button
                  key={playlist.id}
                  onClick={() => togglePlaylist(playlist)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isIncluded 
                      ? 'bg-primary-500/10 border-primary-500/50 text-primary-500' 
                      : 'bg-zinc-900 border-white/5 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span className="font-bold">{playlist.name}</span>
                  {isIncluded ? <CheckCircle2 size={20} /> : <Circle size={20} className="text-zinc-600" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="p-6 border-t border-white/5 flex justify-end">
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-colors"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
};
