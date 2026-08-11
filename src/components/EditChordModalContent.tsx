import { PenLine } from 'lucide-react';
import { useState } from 'react';
import { ChordSelector } from './chords/ChordSelector';

interface EditChordModalContentProps {
  chordToEdit: string;
  onReplace: (oldChord: string, newChord: string) => void;
  onClose: () => void;
}

export const EditChordModalContent = ({ chordToEdit, onReplace, onClose }: EditChordModalContentProps) => {
  const [selectedNewChord, setSelectedNewChord] = useState<string | null>(null);
  const rootMatch = (chordToEdit || 'C').match(/^[A-G][#b]?/);
  const initialRootNote = rootMatch ? rootMatch[0] : 'C';

  return (
    <div className="flex flex-col h-[85vh] sm:h-auto sm:max-h-[85vh] text-left overflow-hidden">
      <div className="shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 border-b border-white/5 pb-4 sm:pb-5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-primary-400/20 to-primary-600/5 border border-primary-500/20 flex items-center justify-center shrink-0 shadow-inner">
            <PenLine className="text-primary-400" size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-[15px] sm:text-xl md:text-2xl font-black text-white m-0 leading-tight">Personalizar Acorde</h2>
            <p className="hidden sm:block text-zinc-500 text-xs md:text-sm font-medium mt-0.5">
              Reemplazar en toda la canción
            </p>
          </div>
          <div className="ml-auto px-2 py-1.5 sm:px-4 sm:py-2 bg-zinc-950 border border-white/10 rounded-xl shadow-inner flex items-center justify-center shrink-0">
            <span className="text-primary-500 font-black text-base sm:text-xl md:text-2xl tracking-tighter leading-none">{chordToEdit}</span>
          </div>
        </div>

        <p className="text-zinc-400 text-sm leading-relaxed mt-4 mb-4">
          Busca o selecciona de la lista el acorde que deseas utilizar en lugar de <strong className="text-primary-500 bg-primary-500/10 px-1.5 py-0.5 rounded-md">{chordToEdit}</strong>.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ChordSelector
          mode="modal"
          initialRoot={initialRootNote}
          selectedChord={selectedNewChord}
          onSelectChord={(chord) => setSelectedNewChord(chord.name)}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-white/10 mt-2 shrink-0 bg-[#18181b] pb-1">
        <button
          onClick={onClose}
          className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-sm sm:text-base"
        >
          Cancelar
        </button>
        <button
          onClick={() => selectedNewChord && onReplace(chordToEdit, selectedNewChord)}
          disabled={!selectedNewChord || selectedNewChord === chordToEdit}
          className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-xl font-bold bg-primary-500 text-zinc-950 hover:bg-primary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
};
