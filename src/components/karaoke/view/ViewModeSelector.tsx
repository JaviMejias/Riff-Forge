import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, MoveVertical, Focus, PlaySquare, AlignJustify } from 'lucide-react';
import type { AnimationMode } from './KaraokeLyricsView';

interface Props {
  animationMode: AnimationMode;
  setAnimationMode: (mode: AnimationMode) => void;
}

export const ViewModeSelector = ({ animationMode, setAnimationMode }: Props) => {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    if (showSettings) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showSettings]);

  const animationOptions = [
    { id: 'scroll', label: 'Scroll Automático', icon: <MoveVertical size={14} /> },
    { id: 'focus', label: 'Modo Enfoque', icon: <Focus size={14} /> },
    { id: 'carousel', label: 'Modo Carrusel', icon: <PlaySquare size={14} /> },
    { id: 'static', label: 'Estático', icon: <AlignJustify size={14} /> },
  ] as const;

  return (
    <div className="relative" ref={settingsRef}>
      <button 
        onClick={() => setShowSettings(!showSettings)}
        className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2 px-3 sm:px-4 py-2 sm:py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all cursor-pointer font-bold text-sm sm:text-sm border border-transparent"
      >
        <span className="flex items-center gap-2">
          <Settings2 size={16} className={`transition-all duration-300 ${showSettings ? 'rotate-90 text-primary-500' : ''}`} />
          <span className="inline whitespace-nowrap">
            {animationOptions.find(o => o.id === animationMode)?.label || 'Modo de Vista'}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 right-0 w-48 sm:w-56 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]"
          >
            <div className="px-3 pt-3 pb-1 border-b border-white/5">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Modo de Vista</span>
            </div>
            <div className="p-2 flex flex-col gap-1">
              {animationOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setAnimationMode(opt.id as AnimationMode);
                    setShowSettings(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all w-full text-left ${
                    animationMode === opt.id 
                      ? 'bg-primary-500/20 text-primary-400 shadow-[inset_0_0_10px_var(--theme-glow)]' 
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className={animationMode === opt.id ? 'text-primary-500' : 'text-zinc-500'}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
