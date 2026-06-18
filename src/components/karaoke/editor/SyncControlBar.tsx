import { RotateCcw, Pause, Play } from 'lucide-react';

interface SyncControlBarProps {
  syncIndex: number;
  undoSync: () => void;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange?: (speed: number) => void;
  duration?: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export const SyncControlBar = ({
  syncIndex,
  undoSync,
  isPlaying,
  onPlay,
  onPause,
  onSpeedChange,
  duration,
  currentTime,
  onSeek
}: SyncControlBarProps) => {
  return (
    <div className="p-3 bg-zinc-900/50 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
      
      <div className="flex items-center w-full justify-between sm:w-auto sm:justify-start gap-2">
        <button
          onClick={undoSync}
          disabled={syncIndex === 0}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw size={14} />
          Deshacer
        </button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-colors ${isPlaying ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-primary-500 text-zinc-950 hover:bg-primary-400'}`}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? 'Pausar' : 'Reproducir'}
        </button>
        {onSpeedChange && (
          <select 
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="ml-2 px-2 py-1 bg-zinc-800 text-xs font-bold text-zinc-300 rounded-lg outline-none cursor-pointer hover:bg-zinc-700 transition-colors"
            defaultValue="1.0"
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1.0">1.0x</option>
          </select>
        )}
      </div>

      {/* BARRA DE PROGRESO */}
      {duration ? (
        <div className="flex-1 w-full sm:w-auto flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500 min-w-[32px] text-right">
            {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
          </span>
          <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            step="0.1"
            value={currentTime || 0}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-primary-500 hover:accent-primary-400"
          />
          <span className="text-[10px] font-mono text-zinc-500 min-w-[32px]">
            {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
          </span>
        </div>
      ) : null}

    </div>
  );
};
