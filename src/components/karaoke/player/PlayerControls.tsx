import { Maximize, Minimize, Play, Pause, Volume2, VolumeX, Loader2, Timer } from 'lucide-react';
import { CustomSelect } from '../../CustomSelect';

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onMuteToggle: () => void;
  
  speed: number;
  onSpeedChange: (speed: number) => void;
  
  pitch: number;
  onPitchChange: (pitch: number) => void;
  isProcessingPitch: boolean;

  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  isCountInEnabled?: boolean;
  onCountInToggle?: () => void;
}

const formatTime = (time: number) => {
  if (isNaN(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const PlayerControls = ({
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  speed,
  onSpeedChange,
  pitch,
  onPitchChange,
  isProcessingPitch,
  isFullscreen,
  onFullscreenToggle,
  isCountInEnabled,
  onCountInToggle
}: PlayerControlsProps) => {

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col w-full bg-zinc-950/80 backdrop-blur-md border-t border-white/10 p-2 sm:p-4 mt-auto z-50">
      
      {/* Seekbar */}
      <div className="flex items-center gap-2 sm:gap-3 w-full mb-1.5 sm:mb-3 group">
        <span className="text-[10px] sm:text-xs text-zinc-400 font-mono w-8 sm:w-10 text-right">{formatTime(currentTime)}</span>
        <div 
          className="relative flex-1 h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
             const rect = e.currentTarget.getBoundingClientRect();
             const x = e.clientX - rect.left;
             const p = Math.max(0, Math.min(1, x / rect.width));
             onSeek(p * duration);
          }}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-primary-500 rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] sm:text-xs text-zinc-400 font-mono w-8 sm:w-10">{formatTime(duration)}</span>
      </div>

      {/* Controles Principales */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Izquierda: Play/Pause y Volumen */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onPlayPause}
            className="w-8 h-8 sm:w-12 sm:h-12 bg-primary-500 hover:bg-primary-400 text-zinc-950 rounded-full flex items-center justify-center transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:scale-105 shrink-0"
          >
            {isPlaying ? <Pause size={16} className="fill-current sm:w-5 sm:h-5" /> : <Play size={16} className="fill-current ml-0.5 sm:ml-1 sm:w-5 sm:h-5" />}
          </button>
          
          <div className="flex items-center gap-2 group relative">
            <button onClick={onMuteToggle} className="text-zinc-400 hover:text-white transition-colors">
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0" max="1" step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-12 opacity-100 sm:w-0 sm:opacity-0 sm:group-hover:w-20 sm:group-hover:opacity-100 transition-all duration-300 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-primary-500"
            />
          </div>
        </div>

        {/* Centro/Derecha: Pitch, Velocidad, Count-in */}
        <div className="flex items-center gap-1.5 sm:gap-6 justify-end flex-1 whitespace-nowrap">
          
          {/* Count-in Toggle */}
          {onCountInToggle && (
            <button
              onClick={onCountInToggle}
              className={`flex items-center justify-center p-1.5 sm:p-2 rounded-xl transition-all border shrink-0 ${
                isCountInEnabled 
                  ? 'bg-primary-500/20 text-primary-400 border-primary-500/50 shadow-inner' 
                  : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:text-white hover:bg-zinc-800'
              }`}
              title="Cuenta Regresiva (3s)"
            >
              <Timer size={16} />
            </button>
          )}

          {/* Velocidad */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="hidden sm:inline text-[10px] font-bold text-zinc-500 uppercase">Velocidad</span>
            <CustomSelect
              options={[
                { value: 0.5, label: '0.5x' },
                { value: 0.75, label: '0.75x' },
                { value: 1, label: '1.0x' },
                { value: 1.25, label: '1.25x' },
                { value: 1.5, label: '1.5x' }
              ]}
              value={speed}
              onChange={(val) => onSpeedChange(Number(val))}
              theme="amber"
              dropup={true}
              className="w-20"
            />
          </div>

          {/* Pitch */}
          <div className="flex items-center bg-zinc-900/50 border border-white/5 rounded-lg sm:rounded-xl px-1.5 sm:px-2 py-0.5 sm:py-1 gap-1 shrink-0">
            <span className="hidden sm:inline text-[10px] font-bold text-zinc-500 uppercase px-1">Tono</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onPitchChange(Math.max(-12, pitch - 1))}
                disabled={pitch <= -12 || isProcessingPitch}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-zinc-800 hover:bg-primary-500/20 text-zinc-300 flex items-center justify-center disabled:opacity-30 transition-colors text-xs"
              >
                -
              </button>
              <span className={`text-[10px] sm:text-xs font-black w-6 sm:w-8 text-center flex items-center justify-center ${pitch !== 0 ? 'text-primary-400' : 'text-white'}`}>
                {isProcessingPitch ? <Loader2 size={10} className="animate-spin text-primary-500" /> : (pitch > 0 ? `+${pitch}` : pitch)}
              </span>
              <button
                onClick={() => onPitchChange(Math.min(12, pitch + 1))}
                disabled={pitch >= 12 || isProcessingPitch}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-zinc-800 hover:bg-primary-500/20 text-zinc-300 flex items-center justify-center disabled:opacity-30 transition-colors text-xs"
              >
                +
              </button>
            </div>
          </div>

          {/* Fullscreen */}
          <button
            onClick={onFullscreenToggle}
            className="text-zinc-400 hover:text-white transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-white/5 shrink-0 ml-1"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          
        </div>
      </div>
    </div>
  );
};
