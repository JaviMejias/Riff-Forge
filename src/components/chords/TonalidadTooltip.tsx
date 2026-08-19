import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Mic2 } from 'lucide-react';

export const TonalidadTooltip = ({ tonalidad }: { tonalidad: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (window.innerWidth < 1024 || !containerRef.current) {
      setPosition(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({
      left: Math.min(rect.right + 12, window.innerWidth - 268),
      top: Math.max(12, Math.min(rect.top, window.innerHeight - 180))
    });
  }, []);

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
      <span className="text-zinc-500 font-bold">Tonalidad:</span>
      <span className="text-primary-400 font-bold">{tonalidad}</span>
      {isHovered && createPortal(
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[200] rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl lg:inset-x-auto lg:bottom-auto lg:w-64"
            style={position || undefined}
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="text-primary-500 font-bold mb-2 flex items-center gap-2"><Mic2 size={16}/> Tono Original</h4>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Este es el tono original de la canción. Si te queda muy agudo o muy grave para cantar, puedes usar los controles de "Tono" a la derecha para transportar los acordes a una cómoda tonalidad.
            </p>
          </motion.div>
        , document.body)}
    </div>
  );
};
