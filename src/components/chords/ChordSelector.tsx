import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Volume2, Plus, Trash2 } from 'lucide-react';
import { CHORD_DICTIONARY } from '../../chords';
import { ChordBox } from '../ChordBox';
import { playChordAudio } from '../../audio';
import type { ChordDef } from '../../chords';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { CreateChordModal } from './CreateChordModal';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

interface ChordSelectorProps {
  initialRoot?: string;
  selectedChord?: string | null;
  onSelectChord?: (chord: ChordDef) => void;
  mode?: 'modal' | 'full';
}

export const ChordSelector = ({ initialRoot, selectedChord, onSelectChord, mode = 'full' }: ChordSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const customChords = useLiveQuery(() => db.customChords.toArray()) || [];
  const allAvailableChords = [...CHORD_DICTIONARY, ...customChords];

  const allRoots = Array.from(new Set(allAvailableChords.map(c => c.root).filter(Boolean))) as string[];
  const [activeRoot, setActiveRoot] = useState<string | 'ALL'>(
    initialRoot && allRoots.includes(initialRoot) ? initialRoot : 'ALL'
  );

  const filteredChords = allAvailableChords.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRoot = activeRoot === 'ALL' || c.root === activeRoot;
    return matchesSearch && matchesRoot;
  });

  const handleDeleteCustomChord = async (e: React.MouseEvent, chordId: number) => {
    e.stopPropagation();
    const result = await MySwal.fire({
      title: '¿Eliminar acorde?',
      text: "No podrás revertir esto.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#fff'
    });

    if (result.isConfirmed) {
      await db.customChords.delete(chordId);
    }
  };

  const isMobile = window.innerWidth < 768;
  const boxWidth = mode === 'modal' ? (isMobile ? 80 : 110) : 120;
  const boxHeight = mode === 'modal' ? (isMobile ? 110 : 150) : 160;

  return (
    <div className={`flex flex-col h-full w-full gap-3 sm:gap-4 ${mode === 'modal' ? 'p-0 sm:p-2' : 'p-4 sm:p-8'}`}>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Buscar acorde (ej. Cmaj7)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-xl sm:rounded-2xl py-2 sm:py-3 pl-10 pr-4 text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all shadow-inner"
          />
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-zinc-800 hover:bg-primary-500 hover:text-zinc-950 text-white font-bold text-sm sm:text-base rounded-xl sm:rounded-2xl transition-all border border-white/5"
        >
          <Plus size={18} />
          Crear Acorde
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 -mx-2 px-2 shrink-0">
        <button
          onClick={() => setActiveRoot('ALL')}
          className={`px-5 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeRoot === 'ALL'
            ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
            : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-white/5'
            }`}
        >
          Todos
        </button>
        {allRoots.map(root => (
          <button
            key={root}
            onClick={() => setActiveRoot(root)}
            className={`px-5 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeRoot === root
              ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-white/5'
              }`}
          >
            {root}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:gap-4 overflow-y-auto custom-scrollbar p-1 sm:p-2 ${mode === 'modal' ? 'max-h-[50vh]' : 'flex-1'}`}>
        <AnimatePresence mode="popLayout">
          {filteredChords.map((chordDef, index) => {
            const isSelected = selectedChord === chordDef.name;
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: index * 0.03 } }}
                exit={{ opacity: 0, scale: 0.8 }}
                key={chordDef.name}
                onClick={() => onSelectChord && onSelectChord(chordDef)}
                className={`bg-zinc-900/60 border p-2 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col items-center hover:bg-zinc-800 hover:border-primary-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] transition-colors group cursor-pointer ${isSelected ? 'border-primary-500 shadow-[0_0_15px_var(--theme-glow)] bg-zinc-800' : 'border-white/5'
                  }`}
              >
                <div className="relative">
                  <ChordBox chord={chordDef} width={boxWidth} height={boxHeight} hideName={true} />
                  {chordDef.isCustom && chordDef.id && (
                    <button
                      onClick={(e) => handleDeleteCustomChord(e, chordDef.id!)}
                      className="absolute -top-2 -right-2 p-1.5 sm:p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className={`text-center mt-2 mb-2 font-bold text-lg sm:text-xl ${isSelected ? 'text-primary-500' : 'text-white'}`}>
                  {chordDef.name}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playChordAudio(chordDef.frets);
                  }}
                  className={`mt-auto flex items-center justify-center gap-2 w-full py-2 sm:py-3 rounded-xl transition-all font-bold text-xs sm:text-base ${isSelected
                    ? 'bg-primary-500 text-zinc-950 hover:bg-primary-400'
                    : 'bg-zinc-950/50 hover:bg-primary-500 hover:text-zinc-950 text-zinc-400'
                    }`}
                >
                  <Volume2 size={16} />
                  Sonar
                </button>
              </motion.div>
            );
          })}
          {filteredChords.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-full py-12 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900/30 rounded-3xl border-2 border-dashed border-white/5 min-h-[200px]"
            >
              <Search size={48} className="mb-4 opacity-50 text-primary-500/50" />
              <p className="text-lg font-bold text-zinc-300">No se encontraron acordes</p>
              <p className="text-sm mt-1">¡Usa el botón "Crear Acorde" para añadirlo a tu biblioteca!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CreateChordModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
