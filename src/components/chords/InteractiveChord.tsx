import { useState, useEffect, useRef } from 'react';
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
  const containerRef = useRef<HTMLSpanElement>(null);
  const trimmed = text.trim();
  
  useEffect(() => {
    if (!isHovered) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsHovered(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isHovered]);

  // Ignore purely separator elements like " | "
  if (trimmed === '|' || !trimmed) {
    return <span>{text}</span>;
  }

  const chordDef = getChord(trimmed);

  if (!chordDef) {
    return <span className="text-primary-600 font-bold">{text}</span>;
  }

  return (
    <span 
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (window.matchMedia('(hover: none)').matches) {
          e.stopPropagation();
          setIsHovered(!isHovered);
        } else if (onClick) {
          onClick(trimmed);
        }
      }}
    >
      <span className="text-primary-400 font-bold cursor-help border-b-[1.5px] border-dashed border-primary-500/30 hover:border-primary-400 hover:text-primary-300 transition-colors">
        {text}
      </span>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[100] cursor-default rounded-2xl border border-white/10 bg-zinc-900 p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[120%] sm:mb-2 sm:min-w-[120px]"
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
                  className="group flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-800 py-1.5 text-xs font-bold text-zinc-400 transition-all hover:bg-primary-500 hover:text-zinc-950 sm:min-h-0"
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
                    className="group flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-800 py-1.5 text-xs font-bold text-zinc-400 transition-all hover:bg-primary-500 hover:text-zinc-950 sm:min-h-0"
                  >
                    <Edit2 size={14} className="group-hover:scale-110 transition-transform" />
                    Editar
                  </button>
                )}
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-full left-4 hidden border-[6px] border-transparent border-b-zinc-900 sm:block" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};
