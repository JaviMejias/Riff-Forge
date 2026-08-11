import { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { Modal } from './Modal';

interface EditMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle: string;
  initialArtist: string;
  onSave: (title: string, artist: string) => void;
}

export const EditMetadataModal = ({ isOpen, onClose, initialTitle, initialArtist, onSave }: EditMetadataModalProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [artist, setArtist] = useState(initialArtist);
  const [initialValues, setInitialValues] = useState({ title: initialTitle, artist: initialArtist });

  if (initialTitle !== initialValues.title || initialArtist !== initialValues.artist) {
    setInitialValues({ title: initialTitle, artist: initialArtist });
    setTitle(initialTitle);
    setArtist(initialArtist);
  }

  const handleClose = () => {
    setTitle(initialTitle);
    setArtist(initialArtist);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), artist.trim());
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Editar Metadatos"
      subtitle="Modifica el título y el artista para actualizar la carátula."
      icon={<Edit3 size={24} />}
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full min-h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600"
            placeholder="Título de la canción"
            autoFocus
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Artista</label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full min-h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600"
            placeholder="Nombre del artista"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end mt-3 pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto min-h-11 px-6 py-2.5 rounded-xl text-zinc-400 hover:text-white font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full sm:w-auto min-h-11 px-6 py-2.5 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:hover:bg-primary-500 text-zinc-950 font-bold rounded-xl transition-colors shadow-[0_0_15px_var(--theme-glow)]"
          >
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
};
