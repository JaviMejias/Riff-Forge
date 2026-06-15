import { ChordSelector } from './chords/ChordSelector';
import { PenLine } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

interface EditChordModalContentProps {
  chordToEdit: string;
  onReplace: (oldChord: string, newChord: string) => void;
  onClose: () => void;
}

const EditChordModalContent = ({ chordToEdit, onReplace, onClose }: EditChordModalContentProps) => {
  const [selectedNewChord, setSelectedNewChord] = useState<string | null>(null);

  const rootMatch = (chordToEdit || 'C').match(/^[A-G][#b]?/);
  const initialRootNote = rootMatch ? rootMatch[0] : 'C';

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* CABECERA PERSONALIZADA */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400/20 to-primary-600/5 border border-primary-500/20 flex items-center justify-center shrink-0 shadow-inner">
          <PenLine className="text-primary-400" size={24} />
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-xl md:text-2xl font-black text-white m-0 truncate">Personalizar Acorde</h2>
          <p className="text-zinc-500 text-xs md:text-sm font-medium mt-0.5 truncate">
            Reemplazar en toda la canción
          </p>
        </div>
        <div className="ml-auto px-4 py-2 bg-zinc-950 border border-white/10 rounded-xl shadow-inner flex items-center justify-center">
          <span className="text-primary-500 font-black text-xl md:text-2xl tracking-tighter leading-none">{chordToEdit}</span>
        </div>
      </div>

      <p className="text-zinc-400 text-sm leading-relaxed">
        Busca o selecciona de la lista el acorde que deseas utilizar en lugar de <strong className="text-primary-500 bg-primary-500/10 px-1.5 py-0.5 rounded-md">{chordToEdit}</strong>.
      </p>

      <ChordSelector 
        mode="modal" 
        initialRoot={initialRootNote} 
        selectedChord={selectedNewChord} 
        onSelectChord={(c) => setSelectedNewChord(c.name)} 
      />

      <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-2 shrink-0">
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={() => selectedNewChord && onReplace(chordToEdit, selectedNewChord)}
          disabled={!selectedNewChord || selectedNewChord === chordToEdit}
          className="px-6 py-2.5 rounded-xl font-bold bg-primary-500 text-zinc-950 hover:bg-primary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reemplazar
        </button>
      </div>
    </div>
  );
};

export const openEditChordModal = (chordToEdit: string, onReplace: (oldChord: string, newChord: string) => void) => {
  MySwal.fire({
    html: <EditChordModalContent 
            chordToEdit={chordToEdit} 
            onClose={() => MySwal.close()}
            onReplace={(o, n) => {
              MySwal.close();
              onReplace(o, n);
            }} 
          />,
    showConfirmButton: false,
    width: 600,
    background: '#18181b',
    color: '#f4f4f5',
    customClass: {
      popup: 'border border-white/10 rounded-3xl !p-6'
    }
  });
};
