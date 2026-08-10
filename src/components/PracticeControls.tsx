import { Gauge, Bell, Repeat, LayoutTemplate, Music, Timer, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface PracticeControlsProps {
  isLoading: boolean;
  originalBpm: number;
  targetBpm: number;
  handleBpmChange: (bpm: number) => void;
  showTabControls: boolean;
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
  originalBpm,
  targetBpm,
  handleBpmChange,
  showTabControls,
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
}: PracticeControlsProps) => {
  const [bpmInput, setBpmInput] = useState(String(targetBpm));

  useEffect(() => {
    setBpmInput(String(targetBpm));
  }, [targetBpm]);

  const commitBpmInput = () => {
    const bpm = Number(bpmInput);
    if (bpmInput.trim() === '' || !Number.isFinite(bpm)) {
      setBpmInput(String(targetBpm));
      return;
    }
    handleBpmChange(bpm);
  };

  return (
    <div className="bg-zinc-900/40 backdrop-blur-md p-4 rounded-2xl border border-white/5 flex flex-wrap gap-3 items-center justify-center lg:justify-start shadow-inner shadow-black/20">
      
      <Tooltip text={`BPM objetivo · Original: ${originalBpm} BPM`}>
        <div className="flex items-center gap-2 bg-zinc-950/80 px-2 py-1 rounded-xl border border-white/5 shadow-sm transition-colors hover:border-sky-500/30 group">
          <Gauge size={18} className="text-sky-400 group-hover:text-sky-300 transition-colors ml-2" />
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5">
            <motion.button
              whileTap={{ scale: 0.9 }}
              disabled={isLoading}
              onClick={() => handleBpmChange(targetBpm - 1)}
              className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded shadow-sm font-bold disabled:opacity-50"
              aria-label="Disminuir un BPM"
            >
              −
            </motion.button>
            <input
              type="text"
              inputMode="numeric"
              disabled={isLoading}
              value={bpmInput}
              onChange={(event) => {
                if (/^\d*$/.test(event.target.value)) {
                  setBpmInput(event.target.value);
                }
              }}
              onBlur={commitBpmInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setBpmInput(String(targetBpm));
                  event.currentTarget.blur();
                }
              }}
              className="w-12 bg-transparent text-center text-sm font-bold text-sky-300 outline-none disabled:opacity-50"
              aria-label="BPM objetivo"
            />
            <span className="text-[10px] font-bold text-zinc-500 mr-1">BPM</span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              disabled={isLoading}
              onClick={() => handleBpmChange(targetBpm + 1)}
              className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded shadow-sm font-bold disabled:opacity-50"
              aria-label="Aumentar un BPM"
            >
              +
            </motion.button>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            disabled={isLoading || targetBpm === originalBpm}
            onClick={() => handleBpmChange(originalBpm)}
            className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-sky-300 rounded-md transition-colors disabled:opacity-30 disabled:cursor-default"
            aria-label="Restaurar BPM original"
            title={`Restaurar ${originalBpm} BPM`}
          >
            <RotateCcw size={14} />
          </motion.button>
        </div>
      </Tooltip>

      {showTabControls && <Tooltip text="Transposición de Tono">
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
      </Tooltip>}

      <div className="flex gap-2 bg-zinc-950/50 p-1.5 rounded-xl border border-white/5">
        {showTabControls && <Tooltip text="Cuenta Regresiva (Count-in)">
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
        </Tooltip>}

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

        {showTabControls && <Tooltip text="Repetir Canción en Bucle">
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
        </Tooltip>}
      </div>

      {showTabControls && <div className="w-px h-8 bg-white/10 hidden lg:block mx-1"></div>}

      {showTabControls && <Tooltip text="Cambiar vista a Cinta Horizontal">
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
      </Tooltip>}

    </div>
  );
};
