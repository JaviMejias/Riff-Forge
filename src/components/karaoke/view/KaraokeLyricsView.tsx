import { useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlignLeft, Music } from 'lucide-react';
import { parseLrc } from '../../../utils/lrcParser';
import type { Karaoke } from '../../../db';

export type AnimationMode = 'scroll' | 'focus' | 'carousel' | 'static';

export interface KaraokeLyricsViewProps {
  karaoke: Karaoke;
  currentTime: number;
  onEdit?: () => void;
  onSeek?: (time: number) => void;
  animationMode: AnimationMode;
}

const isInstrumentalLine = (text: string) => {
  const t = text.toLowerCase().trim();
  return (
    t.includes('[música]') || t.includes('(música)') || t.includes('musica') ||
    t.includes('[instrumental]') || t.includes('(instrumental)') || t.includes('instrumental') ||
    t.includes('[solo]') || t.includes('(solo)') ||
    t.includes('🎵') || t.includes('🎶') || t.includes('🎸')
  );
};

export const KaraokeLyricsView = ({ karaoke, currentTime, onEdit, onSeek, animationMode }: KaraokeLyricsViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const textContent = karaoke.textContent || '';
  const lines = useMemo(() => parseLrc(textContent), [textContent]);
  const isDynamic = lines.some(l => l.time > 0);

  // Restablecer scroll al cambiar a carrusel
  useEffect(() => {
    if (animationMode === 'carousel' && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [animationMode]);

  let activeIndex = -1;
  if (isDynamic && lines.length > 0) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].time >= 0 && currentTime >= lines[i].time) {
        activeIndex = i;
        break;
      }
    }
  }

  // Scroll automático
  useEffect(() => {
    if (animationMode !== 'static' && animationMode !== 'carousel' && activeIndex !== -1) {
      const el = document.getElementById(`lyric-line-${activeIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeIndex, animationMode]);

  if (!textContent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
        <AlignLeft size={48} className="opacity-20" />
        <p className="text-lg text-center">No hay letra guardada aún</p>
        {onEdit && (
          <button 
            onClick={onEdit}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-500 text-zinc-950 rounded-xl transition-colors text-sm font-black uppercase tracking-wider shadow-[0_0_15px_var(--theme-glow)]"
          >
            Añadir Letra
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
      {/* Visor de Letra */}
      <div 
        ref={containerRef}
        className={`relative flex-1 overflow-y-auto overflow-x-hidden p-6 sm:p-10 hide-scrollbar scroll-smooth flex flex-col ${
          animationMode === 'carousel' 
            ? 'justify-center' 
            : isDynamic && animationMode !== 'static' 
              ? 'pb-[30vh] pt-[15vh] sm:pb-[50vh] sm:pt-[30vh] sm:pr-12' 
              : 'pb-20 pt-8 sm:pr-12'
        }`}
      >
        {!isDynamic ? (
          // MODO ESTÁTICO (Plano)
          <div className="flex flex-col gap-4 sm:gap-6">
            {textContent.split('\n').map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={idx} className="h-2 sm:h-4" />;
              
              return (
                <p key={idx} className="font-sans text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-zinc-400 max-w-[90%] sm:max-w-[85%]">
                  {trimmed}
                </p>
              );
            })}
          </div>
        ) : (
          // MODO DINÁMICO (LRC)
          <div className="flex flex-col gap-6 sm:gap-8">
            <AnimatePresence mode="popLayout">
              {lines.map((line, idx) => {
                const isActive = idx === activeIndex;
                const isPast = idx < activeIndex;

                // Lógicas de visualización según el modo
                const isVisibleCarousel = animationMode !== 'carousel' || isActive || idx === activeIndex + 1 || idx === activeIndex - 1;

                if (!isVisibleCarousel) return null;

                let opacityClass = '';
                let scaleClass = 'scale-100';
                let colorClass = 'text-zinc-500/50';
                let blurClass = '';

                if (animationMode === 'static') {
                  opacityClass = 'opacity-100';
                  colorClass = 'text-zinc-400 hover:text-white';
                } else if (animationMode === 'scroll') {
                  opacityClass = 'opacity-100';
                  scaleClass = isActive ? 'scale-[1.02] sm:scale-105' : 'scale-100';
                  colorClass = isActive ? 'text-primary-400 drop-shadow-[0_0_15px_var(--theme-glow)]' : isPast ? 'text-zinc-600' : 'text-zinc-500/50';
                } else if (animationMode === 'focus') {
                  opacityClass = isActive ? 'opacity-100' : isPast ? 'opacity-20' : 'opacity-30';
                  scaleClass = isActive ? 'scale-[1.05] sm:scale-110' : 'scale-95';
                  blurClass = !isActive ? 'blur-[1px]' : '';
                  colorClass = isActive ? 'text-primary-400 drop-shadow-[0_0_20px_var(--theme-glow-strong)]' : 'text-zinc-500';
                } else if (animationMode === 'carousel') {
                  opacityClass = isActive ? 'opacity-100' : 'opacity-40';
                  scaleClass = isActive ? 'scale-[1.05] sm:scale-110 origin-left' : 'scale-95 origin-left';
                  colorClass = isActive ? 'text-primary-400 drop-shadow-[0_0_15px_var(--theme-glow)]' : 'text-zinc-500';
                }
                
                const isInstrumental = isInstrumentalLine(line.text);
                const nextLine = lines[idx + 1];
                const lineDuration = nextLine ? nextLine.time - line.time : 0;
                const elapsed = currentTime - line.time;
                const progress = lineDuration > 0 ? Math.min(1, Math.max(0, elapsed / lineDuration)) : 0;
                
                return (
                  <motion.div 
                    key={idx} 
                    id={`lyric-line-${idx}`}
                    layout={animationMode === 'carousel' ? "position" : false}
                    initial={{ opacity: 0, y: 20, height: 'auto', x: 0 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0,
                      x: isActive && animationMode !== 'static' ? 16 : 0
                    }}
                    exit={{ opacity: 0, scale: 0.8, x: -20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    onClick={() => {
                      if (onSeek && line.time >= 0) {
                        onSeek(line.time);
                      }
                    }}
                    className={`origin-left ${scaleClass} ${opacityClass} ${blurClass} ${onSeek ? 'cursor-pointer hover:opacity-100' : ''}`}
                  >
                    {isInstrumental ? (
                      <div className={`flex flex-col gap-3 py-2 ${colorClass}`}>
                        <div className="flex items-center gap-3 opacity-80">
                          <Music size={24} className={isActive ? "animate-bounce text-primary-400" : ""} />
                          <span className="text-xl sm:text-2xl font-bold uppercase tracking-widest italic opacity-80">
                            {line.text.replace(/[\[\]()]/g, '').trim() || 'Instrumental'}
                          </span>
                        </div>
                        {isActive && lineDuration > 2 && (
                          <div className="w-full max-w-[200px] sm:max-w-xs h-2 bg-zinc-900/80 rounded-full overflow-hidden mt-3 border border-white/5 relative">
                            <div 
                              className="h-full bg-gradient-to-r from-primary-600 to-primary-400 shadow-[0_0_15px_var(--theme-glow)] rounded-full relative transition-all duration-75 ease-linear" 
                              style={{ width: `${Math.max(2, progress * 100)}%` }} 
                            >
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full shadow-[0_0_10px_white]" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className={`font-sans text-3xl sm:text-4xl lg:text-5xl font-black leading-tight transition-colors duration-500 max-w-[90%] sm:max-w-[85%] ${colorClass}`}>
                        {line.text}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
