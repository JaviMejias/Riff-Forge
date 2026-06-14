import { X, SlidersHorizontal, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import * as alphaTab from '@coderline/alphatab';
import { createPortal } from 'react-dom';

interface TrackMixerProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: alphaTab.model.Track[];
  trackVolumes: Record<number, number>;
  trackMutes: Record<number, boolean>;
  trackSolos: Record<number, boolean>;
  onVolumeChange: (trackIndex: number, vol: number) => void;
  onMuteToggle: (trackIndex: number) => void;
  onSoloToggle: (trackIndex: number) => void;
  onResetMixer: () => void;
  masterVolume: number;
  onMasterVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const TrackMixer = ({
  isOpen,
  onClose,
  tracks,
  trackVolumes,
  trackMutes,
  trackSolos,
  onVolumeChange,
  onMuteToggle,
  onSoloToggle,
  onResetMixer,
  masterVolume,
  onMasterVolumeChange
}: TrackMixerProps) => {
  if (!isOpen) return null;

  const isAnySolo = Object.values(trackSolos).some(s => s);

  return createPortal(
    <div className="fixed inset-0 z-99999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50 gap-4">
          <div className="flex items-center gap-3 text-indigo-400">
            <SlidersHorizontal size={24} />
            <h2 className="text-xl font-bold text-slate-100">Mezclador de Pistas</h2>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-700 flex-1 sm:flex-none">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Master</span>
              <Volume2 size={16} className="text-indigo-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={masterVolume}
                onChange={onMasterVolumeChange}
                className="w-full sm:w-24 accent-indigo-500 cursor-pointer"
                title="Volumen Maestro"
              />
            </div>

            <button
              onClick={onResetMixer}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold bg-slate-800 text-slate-300 hover:bg-indigo-500 hover:text-white rounded-lg transition-all duration-300 shadow-md active:scale-95 flex-1 sm:flex-none"
              title="Restaurar valores originales"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors hidden sm:block"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 sm:p-5 custom-scrollbar">
          <div className="flex flex-col gap-3">
            {tracks.map((track, i) => {
              const vol = trackVolumes[i] ?? 16;
              const isMuted = trackMutes[i] ?? false;
              const isSolo = trackSolos[i] ?? false;

              const isEffectivelyMuted = isMuted || (isAnySolo && !isSolo);

              return (
                <div
                  key={i}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between bg-slate-800/40 p-4 rounded-xl border transition-all duration-500 gap-4 ${isEffectivelyMuted
                    ? 'border-slate-800 opacity-40 grayscale scale-[0.98]'
                    : isSolo
                      ? 'border-amber-500/50 shadow-lg shadow-amber-500/10 scale-100 bg-slate-800/80'
                      : 'border-slate-700/50 hover:border-slate-500 scale-100 shadow-md'
                    }`}
                >

                  <div className="flex items-center gap-3 min-w-[150px] truncate transition-transform duration-300 origin-left">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm transition-colors duration-300 ${isSolo ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                      {i + 1}
                    </div>
                    <span className={`font-semibold truncate transition-colors duration-300 ${isSolo ? 'text-amber-100' : 'text-slate-200'}`}>
                      {track.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 flex-1 sm:justify-end">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onMuteToggle(i)}
                        className={`w-10 h-10 rounded-lg font-bold transition-all duration-300 flex items-center justify-center shadow-md active:scale-90 ${isMuted
                          ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] scale-95'
                          : isEffectivelyMuted
                            ? 'bg-rose-500/20 text-rose-400/50 border border-rose-500/20'
                            : 'bg-slate-950 border border-slate-700 text-slate-400 hover:border-rose-500/50 hover:text-rose-200'
                          }`}
                        title="Silenciar pista (Mute)"
                      >
                        M
                      </button>
                      <button
                        onClick={() => onSoloToggle(i)}
                        className={`w-10 h-10 rounded-lg font-bold transition-all duration-300 flex items-center justify-center shadow-md active:scale-90 ${isSolo
                          ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105'
                          : 'bg-slate-950 border border-slate-700 text-slate-400 hover:border-amber-500/50 hover:text-amber-200'
                          }`}
                        title="Escuchar solo esta pista (Solo)"
                      >
                        S
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-1 max-w-[200px] bg-slate-950 px-3 py-2 rounded-lg border border-slate-700 transition-colors duration-300">
                      {vol === 0 || isEffectivelyMuted ? <VolumeX size={16} className="text-slate-600 transition-colors" /> : <Volume2 size={16} className={`${isSolo ? 'text-amber-400' : 'text-indigo-400'} transition-colors`} />}
                      <input
                        type="range"
                        min="0"
                        max="16"
                        step="1"
                        value={vol}
                        onChange={(e) => onVolumeChange(i, parseInt(e.target.value))}
                        className={`w-full cursor-pointer transition-all ${isSolo ? 'accent-amber-500' : 'accent-indigo-500'}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
