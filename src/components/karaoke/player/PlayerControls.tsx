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
    <div className="z-50 mt-auto flex w-full flex-col border-t border-white/10 bg-zinc-950/90 p-2 backdrop-blur-md sm:p-4">
      
      {/* Seekbar */}
      <div className="flex items-center gap-2 sm:gap-3 w-full mb-1.5 sm:mb-3 group">
        <span className="text-[10px] sm:text-xs text-zinc-400 font-mono w-8 sm:w-10 text-right">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={Math.min(Math.max(currentTime, 0), duration || 100)}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-1 h-1.5 sm:h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-primary-500 focus:outline-none"
          aria-label="Posición de reproducción"
        />
        <span className="text-[10px] sm:text-xs text-zinc-400 font-mono w-8 sm:w-10">{formatTime(duration)}</span>
      </div>

      {/* Controles Principales */}
      <div className="flex items-start justify-between gap-2 sm:items-center sm:gap-4">
        
        {/* Izquierda: Play/Pause y Volumen */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-4">
          <button
            onClick={onPlayPause}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all hover:scale-105 hover:bg-primary-400 sm:h-12 sm:w-12"
            aria-label={isPlaying ? 'Pausar karaoke' : 'Reproducir karaoke'}
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
              className="flex h-11 w-10 items-center justify-center text-zinc-400 transition-colors hover:text-white sm:h-auto sm:w-auto sm:p-1"
              aria-label={isMuted || volume === 0 ? 'Abrir volumen, actualmente silenciado' : 'Abrir control de volumen'}
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 pb-3 transition-all origin-bottom flex items-center justify-center ${
              isVolumeOpen ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95 pointer-events-none'
            }`}>
              <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 shadow-2xl">
                <input
                type="range"
                min="0" max="1" step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-24 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-primary-500"
                aria-label="Volumen"
              />
              </div>
            </div>
          </div>
        </div>

        {/* Centro/Derecha: Pitch, Velocidad, Count-in */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 whitespace-nowrap sm:flex-nowrap sm:gap-6">
          
          {/* Count-in Toggle */}
          {onCountInToggle && (
            <button
              onClick={onCountInToggle}
              className={`order-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all sm:order-none sm:h-auto sm:w-auto sm:rounded-xl sm:p-2 ${
                isCountInEnabled 
                  ? 'bg-primary-500/20 text-primary-400 border-primary-500/50 shadow-inner' 
                  : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:text-white hover:bg-zinc-800'
              }`}
              title="Cuenta Regresiva (3s)"
              aria-pressed={isCountInEnabled}
              aria-label="Cuenta regresiva de tres segundos"
            >
              <Timer size={14} className="sm:w-4 sm:h-4" />
            </button>
          )}

          {/* Velocidad */}
          <div className="order-2 flex shrink-0 items-center gap-1 sm:order-none sm:gap-2">
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
          <div className="order-4 flex basis-full shrink-0 items-center justify-end gap-0.5 rounded-lg border border-white/5 bg-zinc-900/50 px-1 py-0.5 sm:order-none sm:basis-auto sm:justify-start sm:gap-1 sm:rounded-xl sm:px-2 sm:py-1">
            <span className="hidden sm:inline text-[10px] font-bold text-zinc-500 uppercase px-1">Tono</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onPitchChange(Math.max(-12, pitch - 1))}
                disabled={pitch <= -12}
                className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-xs font-bold"
                title="Bajar Medio Tono"
                aria-label="Bajar medio tono"
              >
                -
              </button>
              <div className="w-8 sm:w-10 text-center font-mono text-[10px] sm:text-xs text-primary-400 font-bold select-none relative flex justify-center">
                {(() => {
                  if (pitch === 0) return '0';
                  const sign = pitch > 0 ? '+' : '-';
                  const abs = Math.abs(pitch);
                  const whole = Math.floor(abs / 2);
                  const half = abs % 2 !== 0 ? '½' : '';
                  return whole === 0 ? `${sign}${half}` : `${sign}${whole}${half}`;
                })()}
              </div>
              <button
                onClick={() => onPitchChange(Math.min(12, pitch + 1))}
                disabled={pitch >= 12}
                className="w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-xs font-bold"
                title="Subir Medio Tono"
                aria-label="Subir medio tono"
              >
                +
              </button>
            </div>
          </div>

          {/* Fullscreen */}
          <button
            onClick={onFullscreenToggle}
            className="order-3 ml-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white sm:order-none sm:ml-1 sm:h-auto sm:w-auto sm:p-2"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Abrir pantalla completa'}
          >
            {isFullscreen ? <Minimize size={14} className="sm:w-4 sm:h-4" /> : <Maximize size={14} className="sm:w-4 sm:h-4" />}
          </button>
          
        </div>
      </div>
    </div>
  );
};
