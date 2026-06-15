import { Play, Pause, Guitar, Loader2, AlertTriangle } from 'lucide-react';
import * as alphaTab from '@coderline/alphatab';
import { motion } from 'framer-motion';
import { CustomSelect } from './CustomSelect';
import { useUiStore } from '../store/uiStore';
import { Maximize, Minimize } from 'lucide-react';

interface PlayerToolbarProps {
  isLoading: boolean;
  errorMsg: string | null;
  loadingMsg: string;
  tracks: alphaTab.model.Track[];
  isPlaying: boolean;
  activeTrackIndex: number;
  tuning: { stringNumber: number; note: string }[];
  togglePlay: () => void;
  changeTrack: (index: number) => void;
}

export const PlayerToolbar = ({
  isLoading,
  errorMsg,
  loadingMsg,
  tracks,
  isPlaying,
  activeTrackIndex,
  tuning,
  togglePlay,
  changeTrack,
}: PlayerToolbarProps) => {
  const { isImmersiveMode, toggleImmersiveMode } = useUiStore();

  return (
    <div className={`bg-zinc-900/90 backdrop-blur-xl p-3 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-2xl shadow-black/60 border flex flex-col md:flex-row gap-4 md:gap-6 items-center min-h-[60px] md:min-h-[80px] relative transition-colors ${isImmersiveMode ? 'border-primary-500/30' : 'border-white/10'}`}>
      {/* Decorative gradient orb */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary-500/10 rounded-full blur-3xl"></div>
      </div>

      {errorMsg ? (
        <div className="flex items-center gap-3 text-rose-400 w-full font-medium z-10 justify-center">
          <AlertTriangle size={24} className="shrink-0" />
          <p>{errorMsg}</p>
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex items-center gap-3 text-primary-500 w-full font-bold animate-pulse z-10 justify-center">
          <Loader2 size={24} className="animate-spin shrink-0" />
          <p>{loadingMsg}</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 w-full z-10">
          
          {/* PLAY BUTTON & TRACK SELECTOR */}
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto flex-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary-400 to-primary-600 text-zinc-950 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.3)] shrink-0 disabled:opacity-50 border border-primary-300/50"
              disabled={isLoading}
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" className="md:w-7 md:h-7" />
              ) : (
                <Play size={24} fill="currentColor" className="ml-1 md:w-7 md:h-7" />
              )}
            </motion.button>

            <div className="h-10 w-px bg-white/10 hidden md:block"></div>

            <div className="flex flex-col flex-1 max-w-[280px]">
              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                <Guitar size={12} className="text-primary-500" /> Pista Visualizada
              </span>
              <div className="relative w-full">
                <CustomSelect
                  disabled={isLoading}
                  value={activeTrackIndex}
                  onChange={(val) => changeTrack(Number(val))}
                  options={tracks
                    .filter((track) => !track.isPercussion)
                    .map((track) => ({
                      value: tracks.indexOf(track),
                      label: (
                        <div className="flex items-center gap-2">
                          <Guitar size={14} className="text-zinc-500 shrink-0" />
                          <span className="truncate">{track.name}</span>
                        </div>
                      )
                    }))}
                  theme="amber"
                  dropup={true}
                />
              </div>
            </div>
          </div>

          {/* TUNING DISPLAY */}
          <div className="flex flex-col text-center md:text-right shrink-0 mt-1 md:mt-0">
            <span className="text-[8px] md:text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-1">
              Afinación
            </span>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-1">

              {tuning.length > 0 ? (
                tuning.map((t, idx) => {
                  let tooltip = `Cuerda ${t.stringNumber}`;
                  if (t.stringNumber === 1) tooltip += ' (Más delgada / Aguda)';
                  if (t.stringNumber === 6) tooltip += ' (Más gruesa / Grave)';
                  if (t.stringNumber === 7 || t.stringNumber === 8) tooltip += ' (Cuerda extra grave)';
                  
                  return (
                    <div key={idx} title={tooltip} className="flex items-center bg-black/40 hover:bg-black/60 transition-colors rounded-md border border-white/5 overflow-hidden cursor-help">
                      <span className="px-1.5 md:px-2 py-0.5 md:py-1 bg-zinc-800 text-[9px] md:text-[10px] font-bold text-zinc-500">
                        {t.stringNumber}
                      </span>
                      <span className="px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs font-bold text-primary-500">
                        {t.note}
                      </span>
                    </div>
                  );
                })
              ) : (
                <span className="text-xs font-mono text-zinc-500 italic bg-black/40 px-2 py-1 rounded-md border border-white/5">
                  N/A
                </span>
              )}
            </div>
          </div>

          <div className="hidden md:flex ml-4 pl-4 border-l border-white/5 items-center">
            <button
              onClick={toggleImmersiveMode}
              className={`p-2 rounded-xl transition-all flex items-center justify-center shrink-0 ${isImmersiveMode ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white'}`}
              title={isImmersiveMode ? "Salir de Modo Inmersivo" : "Modo Inmersivo (Pantalla Completa)"}
            >
              {isImmersiveMode ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
          
        </div>
      )}
    </div>
  );
};
