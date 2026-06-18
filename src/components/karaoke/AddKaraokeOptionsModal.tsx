import { Video, Plus, Upload } from 'lucide-react';
import { Modal } from '../Modal';

interface AddKaraokeOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AddKaraokeOptionsModal = ({ isOpen, onClose, onCreateNew, onUpload }: AddKaraokeOptionsModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Añadir Karaoke"
      subtitle="Elige cómo quieres añadir tu pista de karaoke."
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
          <Video size={20} />
          Añadir desde YouTube
        </button>
        
        <label className="flex items-center justify-center gap-3 px-4 py-4 bg-primary-500 hover:bg-primary-400 rounded-2xl text-zinc-950 font-bold transition-colors cursor-pointer shadow-[0_0_15px_var(--theme-glow)] mt-2">
          <Upload size={20} />
          Subir Archivo MP3 / Audio
          <input
            type="file"
            accept="audio/*,video/*"
            onChange={(e) => {
              onClose();
              onUpload(e);
            }}
            className="hidden"
          />
        </label>
      </div>
    </Modal>
  );
};
