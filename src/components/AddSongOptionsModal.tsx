import { FileText, Plus, Upload } from 'lucide-react';
import { Modal } from './Modal';

interface AddSongOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  onPaste: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AddSongOptionsModal = ({ isOpen, onClose, onCreateNew, onPaste, onImport }: AddSongOptionsModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Añadir Canción"
      subtitle="Elige cómo quieres añadir una nueva canción."
      icon={<Plus size={24} />}
    >
      <div className="flex flex-col gap-3 p-6">
        <button
          onClick={() => {
            onClose();
            onCreateNew();
          }}
          className="flex items-center justify-center gap-3 px-4 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-primary-500 font-bold transition-colors border border-primary-500/20 hover:border-primary-500/40"
        >
          <FileText size={20} />
          Escribir desde cero
        </button>
        
        <button
          onClick={() => {
            onClose();
            onPaste();
          }}
          className="flex items-center justify-center gap-3 px-4 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-white font-bold transition-colors"
        >
          <FileText size={20} />
          Pegar Letra / Acordes
        </button>
        
        <label className="flex items-center justify-center gap-3 px-4 py-4 bg-primary-500 hover:bg-primary-400 rounded-2xl text-zinc-950 font-bold transition-colors cursor-pointer shadow-[0_0_15px_var(--theme-glow)] mt-2">
          <Upload size={20} />
          Importar Guitar Pro
          <input
            type="file"
            multiple
            accept=".gp3,.gp4,.gp5,.gpx,.gp"
            onChange={(e) => {
              onClose();
              onImport(e);
            }}
            className="hidden"
          />
        </label>
      </div>
    </Modal>
  );
};
