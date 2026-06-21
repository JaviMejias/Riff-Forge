import { useState } from 'react';
import { Maximize, Minimize, Play, Pause, Volume2, VolumeX, Timer } from 'lucide-react';
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
  isFullscreen,
  onFullscreenToggle,
  isCountInEnabled,
  onCountInToggle
}: PlayerControlsProps) => {
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);

  return (
    <div className="flex flex-col w-full bg-zinc-950/80 backdrop-blur-md border-t border-white/10 p-2 sm:p-4 mt-auto z-50">
      
      {/* Seekbar */}
      <div className="flex items-center gap-2 sm:gap-3 w-full mb-1.5 sm:mb-3 group">
        <span className="text-[10px] sm:text-xs text-zinc-400 font-mono w-8 sm:w-10 text-right">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-1 h-1.5 sm:h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-primary-500 focus:outline-none"
        />
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
          
          <div className="flex items-center gap-2 relative" onMouseEnter={() => setIsVolumeOpen(true)} onMouseLeave={() => setIsVolumeOpen(false)}>
            <button 
              onClick={() => {
                // En móvil alternamos el popup. En desktop (donde hay hover) mutear
                if (window.innerWidth < 640) {
                  setIsVolumeOpen(!isVolumeOpen);
                } else {
                  onMuteToggle();
                }
              }} 
              className="text-zinc-400 hover:text-white transition-colors p-1"
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-zinc-900 border border-white/10 rounded-xl p-3 shadow-2xl transition-all origin-bottom flex items-center justify-center ${
              isVolumeOpen ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95 pointer-events-none'
            }`}>
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-24 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Centro/Derecha: Pitch, Velocidad, Count-in */}
        <div className="flex items-center gap-1 sm:gap-6 justify-end flex-1 whitespace-nowrap overflow-x-auto hide-scrollbar sm:overflow-visible">
          
          {/* Count-in Toggle */}
          {onCountInToggle && (
            <button
              onClick={onCountInToggle}
              className={`flex items-center justify-center p-1 sm:p-2 rounded-lg sm:rounded-xl transition-all border shrink-0 ${
                isCountInEnabled 
                  ? 'bg-primary-500/20 text-primary-400 border-primary-500/50 shadow-inner' 
                  : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:text-white hover:bg-zinc-800'
              }`}
              title="Cuenta Regresiva (3s)"
            >
              <Timer size={14} className="sm:w-4 sm:h-4" />
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
              className="w-[60px] sm:w-20 text-[10px] sm:text-xs"
            />
          </div>

          {/* Pitch */}
          <div 
            className={`flex items-center border border-white/5 rounded-lg sm:rounded-xl px-1 sm:px-2 py-0.5 sm:py-1 gap-0.5 sm:gap-1 shrink-0 ${isPitchSupported ? 'bg-zinc-900/50' : 'bg-red-900/10 opacity-50'}`}
            title={isPitchSupported ? "Tono" : "El cambio de tono requiere conexión HTTPS"}
          >
            <span className="hidden sm:inline text-[10px] font-bold text-zinc-500 uppercase px-1">Tono</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onPitchChange(Math.max(-12, pitch - 1))}
                disabled={!isPitchSupported || pitch <= -12}
                className="w-4 h-4 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[10px] sm:text-xs font-bold"
                title="Bajar Medio Tono"
              >
                -
              </button>
              <div className="w-4 sm:w-6 text-center font-mono text-[10px] sm:text-xs text-primary-400 font-bold select-none relative flex justify-center">
                {pitch > 0 ? `+${pitch}` : pitch}
              </div>
              <button
                onClick={() => onPitchChange(Math.min(12, pitch + 1))}
                disabled={!isPitchSupported || pitch >= 12}
                className="w-4 h-4 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[10px] sm:text-xs font-bold"
                title="Subir Medio Tono"
              >
                +
              </button>
            </div>
          </div>

          {/* Fullscreen */}
          <button
            onClick={onFullscreenToggle}
            className="text-zinc-400 hover:text-white transition-colors p-1 sm:p-2 rounded-lg hover:bg-white/5 shrink-0 ml-0.5 sm:ml-1"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize size={14} className="sm:w-4 sm:h-4" /> : <Maximize size={14} className="sm:w-4 sm:h-4" />}
          </button>
          
        </div>
      </div>
    </div>
  );
};
