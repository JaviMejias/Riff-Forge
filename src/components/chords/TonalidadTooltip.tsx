import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic2 } from 'lucide-react';

export const TonalidadTooltip = ({ tonalidad }: { tonalidad: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      className="relative flex items-center gap-2 bg-zinc-900 border border-white/5 px-4 py-2 rounded-xl shadow-sm text-sm cursor-help hover:border-white/20 transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-zinc-500 font-bold">Tonalidad:</span>
      <span className="text-primary-400 font-bold">{tonalidad}</span>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-full mt-3 left-0 w-64 bg-zinc-900 border border-white/10 p-4 rounded-2xl shadow-2xl"
          >
            <h4 className="text-primary-500 font-bold mb-2 flex items-center gap-2"><Mic2 size={16}/> Tono Original</h4>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Este es el tono original de la canción. Si te queda muy agudo o muy grave para cantar, puedes usar los controles de "Tono" a la derecha para transportar los acordes a una cómoda tonalidad.
            </p>
            <div className="absolute bottom-full left-6 border-[6px] border-transparent border-b-zinc-900 pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
