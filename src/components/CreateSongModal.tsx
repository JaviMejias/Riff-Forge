import { useState } from 'react';
import { PenLine, Music, User } from 'lucide-react';
import { Modal } from './Modal';
import { db } from '../db';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

interface CreateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSongId: number) => void;
}

export const CreateSongModal = ({ isOpen, onClose, onSuccess }: CreateSongModalProps) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      MySwal.fire({
        title: 'Faltan datos',
        text: 'Debes introducir al menos el título de la canción.',
        icon: 'warning',
        background: '#18181b',
        color: '#f4f4f5',
        confirmButtonColor: '#f59e0b'
      });
      return;
    }

    const finalTitle = title.trim();
    const finalArtist = artist.trim() || 'Desconocido';

    const newId = await db.songs.add({
      name: finalTitle,
      artist: finalArtist,
      type: 'text',
      textContent: '',
      dateAdded: Date.now()
    });

    // Reset form
    setTitle('');
    setArtist('');
    
    onSuccess(newId as number);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear Nueva Canción"
      subtitle="Escribe el título y artista para empezar tu composición."
      icon={<PenLine size={24} />}
    >
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
        <div>
          <label className="block text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
            <Music size={16} className="text-amber-500" /> Título *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
            placeholder="Ej: Mi primera canción"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
            <User size={16} className="text-amber-500" /> Artista (Opcional)
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
            placeholder="Ej: Autor Original"
          />
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-white/5 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl font-bold transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transform hover:-translate-y-0.5"
          >
            Crear y Editar
          </button>
        </div>
      </form>
    </Modal>
  );
};
