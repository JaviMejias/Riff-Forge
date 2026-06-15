import { useState, useRef, useEffect } from 'react';
import { Plus, ListMusic } from 'lucide-react';
import { Modal } from './Modal';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const CreatePlaylistModal = ({ isOpen, onClose, onCreate }: CreatePlaylistModalProps) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Lista"
      subtitle="Crea una nueva lista de reproducción."
      icon={<ListMusic size={24} />}
    >
      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6">
        <div className="mb-6">
          <label htmlFor="playlistName" className="block text-sm font-bold text-zinc-300 mb-2">
            Nombre de la lista
          </label>
          <input
            ref={inputRef}
            id="playlistName"
            type="text"
            placeholder="Ej: Canciones para practicar..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950/80 border border-white/10 rounded-xl py-3 px-4 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:hover:bg-primary-500 text-zinc-950 font-bold py-2.5 px-5 rounded-xl transition-all"
          >
            <Plus size={18} />
            Crear
          </button>
        </div>
      </form>
    </Modal>
  );
};
