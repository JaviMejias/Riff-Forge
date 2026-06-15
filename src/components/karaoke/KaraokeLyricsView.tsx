import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlignLeft, Settings2 } from 'lucide-react';
import { parseLrc, hasLrcTags } from '../../utils/lrcParser';
import type { LrcLine } from '../../utils/lrcParser';
import type { Karaoke } from '../../db';

interface KaraokeLyricsViewProps {
  karaoke: Karaoke;
  currentTime: number;
  onEdit: () => void;
}

export const KaraokeLyricsView = ({ karaoke, currentTime, onEdit }: KaraokeLyricsViewProps) => {
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  const textContent = karaoke.textContent || '';
  const isDynamic = hasLrcTags(textContent);
  const [lines, setLines] = useState<LrcLine[]>([]);

  useEffect(() => {
    if (isDynamic) {
      setLines(parseLrc(textContent));
    }
  }, [textContent, isDynamic]);

  // Encuentra la línea actual
  let activeIndex = -1;
  if (isDynamic && lines.length > 0) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentTime >= lines[i].time) {
        activeIndex = i;
        break;
      }
    }
  }

  // Scroll automático
  useEffect(() => {
    if (animationsEnabled && activeIndex !== -1 && activeLineRef.current && containerRef.current) {
      // Usar setTimeout para asegurar que el render se completó
      setTimeout(() => {
        activeLineRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 50);
    }
  }, [activeIndex, animationsEnabled]);

  if (!textContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
        <AlignLeft size={48} className="opacity-20" />
        <p className="text-lg text-center">No hay letra guardada aún</p>
        <button 
          onClick={onEdit}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-zinc-950 rounded-xl transition-colors text-sm font-black uppercase tracking-wider"
        >
          Añadir Letra
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
      {/* Settings Toggle */}
      {isDynamic && (
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl backdrop-blur-md transition-colors ${showSettings ? 'bg-primary-500 text-zinc-950' : 'bg-zinc-800/50 text-zinc-400 hover:text-white'}`}
            title="Ajustes de Letra"
          >
            <Settings2 size={18} />
          </button>
          
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-2 right-0 bg-zinc-900 border border-white/10 p-3 rounded-xl shadow-2xl w-48"
              >
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={animationsEnabled}
                      onChange={(e) => setAnimationsEnabled(e.target.checked)}
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${animationsEnabled ? 'bg-primary-500' : 'bg-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${animationsEnabled ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors">Scroll Automático</span>
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Visor de Letra */}
      <div 
        ref={containerRef}
        className={`flex-1 overflow-y-auto p-6 sm:p-10 hide-scrollbar scroll-smooth ${isDynamic && animationsEnabled ? 'pb-[50vh] pt-[20vh]' : 'pb-20 pt-8'}`}
      >
        {!isDynamic ? (
          // MODO ESTÁTICO (Plano)
          <div className="flex flex-col gap-4 sm:gap-6">
            {textContent.split('\n').map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={idx} className="h-2 sm:h-4" />;
              
              return (
                <p key={idx} className="font-sans text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-zinc-400">
                  {trimmed}
                </p>
              );
            })}
          </div>
        ) : (
          // MODO DINÁMICO (LRC)
          <div className="flex flex-col gap-6 sm:gap-8">
            {lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              
              return (
                <div 
                  key={idx} 
                  ref={isActive ? activeLineRef : null}
                  className={`transition-all duration-500 origin-left ${isActive ? 'scale-105' : 'scale-100'} ${!animationsEnabled ? 'scale-100' : ''}`}
                >
                  <p 
                    className={`font-sans text-3xl sm:text-4xl lg:text-5xl font-black leading-tight transition-colors duration-500 ${
                      isActive 
                        ? 'text-primary-500' 
                        : isPast 
                          ? 'text-zinc-600' 
                          : 'text-zinc-500/50'
                    }`}
                  >
                    {line.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Edit Button */}
      <div className="absolute bottom-6 right-6">
        <button 
          onClick={onEdit}
          className="px-5 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-md text-white rounded-full shadow-xl transition-colors text-xs font-bold border border-white/10"
        >
          Editar Letra
        </button>
      </div>
    </div>
  );
};
