import { Gauge, Bell, Repeat, LayoutTemplate, Music, Timer, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { CustomSelect } from './CustomSelect';

interface PracticeControlsProps {
  isLoading: boolean;
  playbackSpeed: number;
  handleSpeedChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  transposition: number;
  handleTranspositionChange: (delta: number) => void;
  isCountInActive: boolean;
  toggleCountIn: () => void;
  isMetronomeActive: boolean;
  toggleMetronome: () => void;
  isLooping: boolean;
  toggleLoop: () => void;
  isHorizontalMode: boolean;
  toggleLayoutMode: () => void;
  isMixerOpen: boolean;
  toggleMixer: () => void;
}

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div 
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 px-3 py-1.5 bg-zinc-800 text-xs text-primary-50 border border-white/10 rounded-lg whitespace-nowrap shadow-xl z-50 font-bold tracking-wide pointer-events-none"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const PracticeControls = ({
  isLoading,
  playbackSpeed,
  handleSpeedChange,
  transposition,
  handleTranspositionChange,
  isCountInActive,
  toggleCountIn,
  isMetronomeActive,
  toggleMetronome,
  isLooping,
  toggleLoop,
  isHorizontalMode,
  toggleLayoutMode,
  isMixerOpen,
  toggleMixer,
}: PracticeControlsProps) => {
  return (
    <div className="bg-zinc-900/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 flex flex-wrap gap-3 items-center justify-center lg:justify-start shadow-inner shadow-black/20">
      
      <Tooltip text="Velocidad de reproducción">
        <div className="flex items-center gap-2 bg-zinc-950/80 px-2 py-1 rounded-xl border border-white/5 shadow-sm transition-colors hover:border-sky-500/30 group">
          <Gauge size={18} className="text-sky-400 group-hover:text-sky-300 transition-colors ml-2" />
          <div className="w-32">
            <CustomSelect
              disabled={isLoading}
              value={playbackSpeed}
              onChange={(val) => handleSpeedChange({ target: { value: String(val) } } as React.ChangeEvent<HTMLSelectElement>)}
              options={[
                { value: 0.5, label: "50%" },
                { value: 0.75, label: "75%" },
                { value: 1, label: "Normal" },
                { value: 1.25, label: "125%" },
              ]}
              theme="sky"
              className="!border-transparent !bg-transparent"
            />
          </div>
        </div>
      </Tooltip>

      <Tooltip text="Transposición de Tono">
        <div className="flex items-center gap-2 bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-white/5 shadow-sm group hover:border-pink-500/30 transition-colors">
          <Music size={16} className="text-pink-400 group-hover:text-pink-300" />
          <span className="text-xs text-zinc-400 font-bold hidden sm:inline">
            Tono:
          </span>
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              disabled={isLoading}
              onClick={() => handleTranspositionChange(-1)}
              className="w-6 h-6 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded shadow-sm font-bold disabled:opacity-50"
            >
              -
            </motion.button>
            <span className="w-8 text-center text-sm font-bold text-zinc-300">
              {transposition > 0 ? `+${transposition}` : transposition}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              disabled={isLoading}
              onClick={() => handleTranspositionChange(1)}
              className="w-6 h-6 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded shadow-sm font-bold disabled:opacity-50"
            >
              +
            </motion.button>
          </div>
        </div>
      </Tooltip>

      <div className="flex gap-2 bg-zinc-950/50 p-1.5 rounded-xl border border-white/5">
        <Tooltip text="Cuenta Regresiva (Count-in)">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            onClick={toggleCountIn}
            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all disabled:opacity-50 ${
              isCountInActive
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                : 'bg-zinc-900 border-transparent text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <Timer size={18} />
          </motion.button>
        </Tooltip>

        <Tooltip text="Metrónomo">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            onClick={toggleMetronome}
            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all disabled:opacity-50 ${
              isMetronomeActive
                ? 'bg-primary-500/20 border-primary-500/50 text-primary-400 shadow-[0_0_10px_var(--theme-glow)]'
                : 'bg-zinc-900 border-transparent text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <Bell size={18} />
          </motion.button>
        </Tooltip>

        <Tooltip text="Repetir Canción en Bucle">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            onClick={toggleLoop}
            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-all disabled:opacity-50 ${
              isLooping
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-zinc-900 border-transparent text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <Repeat size={18} />
          </motion.button>
        </Tooltip>
      </div>

      <div className="w-px h-8 bg-white/10 hidden lg:block mx-1"></div>

      <Tooltip text="Cambiar vista a Cinta Horizontal">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isLoading}
          onClick={toggleLayoutMode}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all disabled:opacity-50 ${
            isHorizontalMode
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              : 'bg-zinc-950/80 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <LayoutTemplate size={18} />{' '}
          <span className="text-sm font-bold hidden xl:inline tracking-wide">Cinta</span>
        </motion.button>
      </Tooltip>

      <Tooltip text="Abrir Mezclador de Pistas">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isLoading}
          onClick={toggleMixer}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all disabled:opacity-50 ml-auto w-full md:w-auto mt-2 md:mt-0 ${
            isMixerOpen
              ? 'bg-primary-500/20 border-primary-500/50 text-primary-400 shadow-[0_0_10px_var(--theme-glow)]'
              : 'bg-zinc-950/80 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <SlidersHorizontal size={18} />{' '}
          <span className="text-sm font-bold hidden xl:inline tracking-wide">Mezclador</span>
        </motion.button>
      </Tooltip>
    </div>
  );
};
