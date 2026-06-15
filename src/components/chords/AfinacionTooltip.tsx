import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Guitar } from 'lucide-react';

export const AfinacionTooltip = ({ afinacion }: { afinacion: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const notas = afinacion.split(/[\s-]+/).filter(Boolean);
  const displayNotas = [...notas].reverse();
  
  return (
    <div 
      className="relative flex items-center gap-2 bg-zinc-900 border border-white/5 px-4 py-2 rounded-xl shadow-sm text-sm cursor-help hover:border-white/20 transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-zinc-500 font-bold">Afinación:</span>
      <span className="text-primary-400 font-bold">{afinacion}</span>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-full mt-3 left-0 w-48 bg-zinc-900 border border-white/10 p-4 rounded-2xl shadow-2xl"
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
            <div className="absolute bottom-full left-6 border-[6px] border-transparent border-b-zinc-900 pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
