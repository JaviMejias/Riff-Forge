import { useState } from 'react';
import { PenLine, Music, User } from 'lucide-react';
import { Modal } from './Modal';
import { db } from '../db';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { normalizeSongMetadata } from '../services/songMetadataService';
import { findDuplicateSong } from '../services/songDuplicateService';

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

    const normalized = normalizeSongMetadata({ title, artist });
    const finalTitle = normalized.title || '';
    const finalArtist = normalized.artist || 'Desconocido';
    const duplicate = findDuplicateSong(await db.songs.toArray(), finalTitle, finalArtist);
    if (duplicate) {
      const confirmation = await MySwal.fire({
        icon: 'warning',
        title: 'Encontramos una canción similar',
        text: `Ya existe “${duplicate.name}” de ${duplicate.artist || 'Desconocido'}.`,
        showCancelButton: true,
        confirmButtonText: 'Crear otra versión',
        cancelButtonText: 'Cancelar'
      });
      if (!confirmation.isConfirmed) return;
    }

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
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 flex flex-col gap-5 sm:gap-6 overflow-y-auto min-h-0">
        <div>
          <label className="block text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
            <Music size={16} className="text-primary-500" /> Título *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
            placeholder="Ej: Mi primera canción"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
            <User size={16} className="text-primary-500" /> Artista (Opcional)
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
            placeholder="Ej: Autor Original"
          />
        </div>

        <div className="sticky bottom-0 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 px-4 sm:px-6 py-3 sm:py-4 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end border-t border-white/10 mt-2 bg-zinc-900/95 backdrop-blur-xl">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-11 px-6 py-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl font-bold transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto min-h-11 px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-black rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transform hover:-translate-y-0.5"
          >
            Crear y Editar
          </button>
        </div>
      </form>
    </Modal>
  );
};
