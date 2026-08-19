import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
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
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmed = text.trim();

  const updatePosition = useCallback(() => {
    if (window.innerWidth < 640 || !containerRef.current) {
      setPosition(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipWidth = 220;
    const tooltipHeight = 210;
    const spaceBelow = window.innerHeight - rect.bottom;
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - tooltipWidth - 12)),
      top: spaceBelow >= tooltipHeight + 12
        ? rect.bottom + 10
        : Math.max(12, rect.top - tooltipHeight - 10)
    });
  }, []);

  const showTooltip = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    updatePosition();
    setIsHovered(true);
  }, [updatePosition]);

  const scheduleTooltipClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setIsHovered(false), 120);
  }, []);
  
  useEffect(() => {
    if (!isHovered) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target) && !tooltipRef.current?.contains(target)) {
        setIsHovered(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isHovered, updatePosition]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

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
      onMouseEnter={showTooltip}
      onMouseLeave={scheduleTooltipClose}
      onClick={(e) => {
        if (window.matchMedia('(hover: none)').matches) {
          e.stopPropagation();
          updatePosition();
          setIsHovered(!isHovered);
        } else if (onClick) {
          onClick(trimmed);
        }
      }}
    >
      <span className="text-primary-400 font-bold cursor-help border-b-[1.5px] border-dashed border-primary-500/30 hover:border-primary-400 hover:text-primary-300 transition-colors">
        {text}
      </span>
      {isHovered && createPortal(
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[200] cursor-default rounded-2xl border border-white/10 bg-zinc-900 p-3 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:w-[220px]"
            style={position || undefined}
            onMouseEnter={showTooltip}
            onMouseLeave={scheduleTooltipClose}
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
          </motion.div>
        , document.body)}
    </span>
  );
};
