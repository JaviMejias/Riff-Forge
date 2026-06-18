import { useState, useEffect } from 'react';
import { Edit3 } from 'lucide-react';
import { Modal } from './Modal';

interface EditPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSave: (newName: string) => void;
}

export const EditPlaylistModal = ({ isOpen, onClose, currentName, onSave }: EditPlaylistModalProps) => {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== currentName) {
      onSave(name.trim());
    } else {
      onClose(); // Just close if it hasn't changed or is empty
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Lista"
      subtitle="Cambia el nombre de tu lista de reproducción."
      icon={<Edit3 size={24} />}
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 flex flex-col gap-5">
        <div>
          <label className="block text-sm font-bold text-zinc-300 mb-2">
            Nuevo nombre de la lista
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
            placeholder="Ej: Rock Clásico"
            autoFocus
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2 border-t border-white/5 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl font-bold transition-all text-center"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim() || name.trim() === currentName}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-black rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transform hover:-translate-y-0.5 text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
};
