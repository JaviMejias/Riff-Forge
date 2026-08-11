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
  const formatTime = (time: number) => {
    const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    return `${Math.floor(safeTime / 60)}:${Math.floor(safeTime % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-3 border-b border-white/5 bg-zinc-900/70 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      
      <div className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 sm:flex sm:w-auto sm:justify-start">
        <button
          onClick={undoSync}
          disabled={syncIndex === 0}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-800 px-3 text-xs font-bold text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-40 sm:min-h-9"
        >
          <RotateCcw size={14} />
          Deshacer
        </button>
        <button
          onClick={isPlaying ? onPause : onPlay}
          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-black transition-colors sm:min-h-9 ${isPlaying ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-primary-500 text-zinc-950 hover:bg-primary-400'}`}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? 'Pausar' : 'Reproducir'}
        </button>
        {onSpeedChange && (
          <select 
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="min-h-11 cursor-pointer rounded-xl bg-zinc-800 px-2 text-xs font-bold text-zinc-300 outline-none transition-colors hover:bg-zinc-700 sm:ml-2 sm:min-h-9"
            defaultValue="1.0"
            aria-label="Velocidad de reproducción"
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1.0">1.0x</option>
          </select>
        )}
      </div>

      {/* BARRA DE PROGRESO */}
      {duration ? (
        <div className="grid w-full flex-1 grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl bg-zinc-950/40 px-2 py-2 sm:w-auto sm:min-w-64 sm:bg-transparent sm:p-0">
          <span className="min-w-9 text-right font-mono text-[10px] tabular-nums text-zinc-500">
            {formatTime(currentTime)}
          </span>
          <input 
            type="range" 
            min="0" 
            max={duration || 100} 
            step="0.1"
            value={Math.min(Math.max(currentTime || 0, 0), duration)}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-primary-500 hover:accent-primary-400"
            aria-label="Posición de reproducción"
          />
          <span className="min-w-9 font-mono text-[10px] tabular-nums text-zinc-500">
            {formatTime(duration)}
          </span>
        </div>
      ) : null}

    </div>
  );
};
