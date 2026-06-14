import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2, Edit2 } from 'lucide-react';
import { getChord } from '../../chords';
import { ChordBox } from '../ChordBox';
import { playChordAudio } from '../../audio';

interface InteractiveChordProps {
  text: string;
  onClick?: (chord: string) => void;
}

export const InteractiveChord = ({ text, onClick }: InteractiveChordProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const trimmed = text.trim();
  
  // Ignore purely separator elements like " | "
  if (trimmed === '|' || !trimmed) {
    return <span>{text}</span>;
  }

  const chordDef = getChord(trimmed);

  if (!chordDef) {
    return <span className="text-amber-600 font-bold">{text}</span>;
  }

  return (
    <span 
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick && onClick(trimmed)}
    >
      <span className="text-amber-400 font-bold cursor-help border-b-[1.5px] border-dashed border-amber-500/30 hover:border-amber-400 hover:text-amber-300 transition-colors">
        {text}
      </span>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-[120%] left-0 mb-2 bg-zinc-900 border border-white/10 p-3 rounded-2xl shadow-2xl cursor-default min-w-[120px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <ChordBox chord={chordDef} width={90} height={120} />
              <div className="flex gap-2 w-full mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playChordAudio(chordDef.frets);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-400 rounded-xl transition-all font-bold text-xs group"
                >
                  <Volume2 size={14} className="group-hover:scale-110 transition-transform" />
                  Sonar
                </button>
                {onClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsHovered(false);
                      onClick(trimmed);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-400 rounded-xl transition-all font-bold text-xs group"
                  >
                    <Edit2 size={14} className="group-hover:scale-110 transition-transform" />
                    Editar
                  </button>
                )}
              </div>
            </div>
            <div className="absolute bottom-full left-4 border-[6px] border-transparent border-b-zinc-900 pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};
