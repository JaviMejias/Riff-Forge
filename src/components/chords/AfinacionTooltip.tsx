import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Guitar } from 'lucide-react';

export const AfinacionTooltip = ({ afinacion }: { afinacion: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const notas = afinacion.split(/[\s-]+/).filter(Boolean);
  const displayNotas = [...notas].reverse();

  const updatePosition = useCallback(() => {
    if (window.innerWidth < 1024 || !containerRef.current) {
      setPosition(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const estimatedHeight = Math.min(360, 130 + displayNotas.length * 38);
    setPosition({
      left: Math.min(rect.right + 12, window.innerWidth - 204),
      top: Math.max(12, Math.min(rect.top, window.innerHeight - estimatedHeight - 12))
    });
  }, [displayNotas.length]);

  useEffect(() => {
    if (!isHovered) return;
    updatePosition();
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsHovered(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isHovered, updatePosition]);
  
  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-expanded={isHovered}
      className="relative flex min-h-11 cursor-help items-center gap-2 rounded-xl border border-white/5 bg-zinc-900 px-3 py-2 text-sm shadow-sm transition-colors hover:border-white/20 sm:min-h-0 sm:px-4"
      onMouseEnter={() => {
        updatePosition();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        updatePosition();
        setIsHovered(previous => !previous);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          updatePosition();
          setIsHovered(previous => !previous);
        }
        if (event.key === 'Escape') setIsHovered(false);
      }}
    >
      <span className="text-zinc-500 font-bold">Afinación:</span>
      <span className="text-primary-400 font-bold">{afinacion}</span>
      {isHovered && createPortal(
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[200] max-h-[65dvh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl lg:inset-x-auto lg:bottom-auto lg:w-48"
            style={position || undefined}
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="text-primary-500 font-bold mb-3 flex items-center gap-2"><Guitar size={16}/> Cuerdas al aire</h4>
            <p className="text-[10px] font-medium text-zinc-400 bg-zinc-950/80 px-2 py-1.5 rounded-md border border-white/5 mb-3 leading-tight">
              1 es la cuerda más delgada y 6 es la más gruesa.
            </p>
            <div className="flex flex-col gap-1.5">
              {displayNotas.map((nota, i) => (
                <div key={i} className="flex items-center justify-between bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="text-zinc-500 text-xs font-bold">Cuerda {i + 1}</span>
                  <span className="text-primary-400 font-black text-sm">{nota}</span>
                </div>
              ))}
            </div>
          </motion.div>
        , document.body)}
    </div>
  );
};
