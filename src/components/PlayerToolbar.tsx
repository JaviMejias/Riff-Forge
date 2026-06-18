import { Play, Pause, Guitar, Loader2, AlertTriangle, SlidersHorizontal, Volume2 } from 'lucide-react';
import * as alphaTab from '@coderline/alphatab';
import { motion } from 'framer-motion';
import { CustomSelect } from './CustomSelect';
import { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';

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
  isMixerOpen: boolean;
  toggleMixer: () => void;
  masterVolume: number;
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  isMixerOpen,
  toggleMixer,
  masterVolume,
  handleVolumeChange,
}: PlayerToolbarProps) => {
  const [isTuningOpen, setIsTuningOpen] = useState(false);
  const tuningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (tuningRef.current && !tuningRef.current.contains(event.target as Node)) {
        setIsTuningOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <motion.div 
      animate={{ boxShadow: ['0px 10px 40px var(--theme-glow)', '0px 10px 80px var(--theme-glow-strong)', '0px 10px 40px var(--theme-glow)'] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className={`bg-zinc-900/90 backdrop-blur-xl p-3 sm:p-4 md:p-5 rounded-2xl md:rounded-3xl border flex w-full flex-col md:flex-row gap-4 md:gap-6 items-center min-h-[60px] md:min-h-[80px] relative transition-colors border-white/10`}>
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
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3 md:gap-6 w-full z-10">
          
          {/* PLAY BUTTON & TRACK SELECTOR */}
          <div className="flex items-center gap-3 md:gap-6 flex-1 min-w-[200px] md:min-w-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary-400 to-primary-600 text-zinc-950 rounded-full shadow-[0_0_20px_var(--theme-glow-strong)] shrink-0 disabled:opacity-50 border border-primary-300/50"
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

          {/* MASTER VOLUME */}
          <div className="flex flex-col flex-1 min-w-[120px] md:max-w-[120px]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider flex items-center gap-1">
                <Volume2 size={12} className="text-primary-500" /> Volumen
              </span>
              <span className="text-[10px] font-bold text-primary-500">{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={masterVolume}
              onChange={handleVolumeChange}
              className="w-full mt-1 cursor-pointer h-2 bg-black/40 border border-white/10 rounded-lg appearance-none"
              style={{
                background: `linear-gradient(to right, var(--primary-500) 0%, var(--primary-500) ${masterVolume * 50}%, rgba(0,0,0,0.4) ${masterVolume * 50}%, rgba(0,0,0,0.4) 100%)`
              }}
            />
          </div>

          <div className="hidden md:block h-10 w-px bg-white/10 mx-2"></div>

          {/* MIXER */}
          <button
            onClick={toggleMixer}
            className={`p-2 md:p-3 ml-auto md:ml-0 rounded-xl transition-all flex items-center justify-center shrink-0 ${isMixerOpen ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white'}`}
            title="Mezclador de Pistas"
          >
            <SlidersHorizontal size={18} className="md:w-5 md:h-5" />
          </button>

          {/* TUNING DISPLAY (POPOVER) */}
          <div 
            className="relative flex flex-col text-center md:text-right shrink-0 z-50"
            onMouseEnter={() => setIsTuningOpen(true)}
            onMouseLeave={() => setIsTuningOpen(false)}
            ref={tuningRef}
          >
            <button 
              onClick={() => setIsTuningOpen(!isTuningOpen)}
              className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-2 md:py-2.5 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl text-xs md:text-sm font-bold text-zinc-300 border border-white/5 transition-colors"
            >
              <Guitar size={16} className="text-primary-500 hidden sm:block" /> Afinación
            </button>
            
            <AnimatePresence>
              {isTuningOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full right-0 md:left-1/2 md:-translate-x-1/2 mb-3 w-48 bg-zinc-900 border border-white/10 p-4 rounded-2xl shadow-2xl z-[100] origin-bottom-right md:origin-bottom"
                >
                  <h4 className="text-primary-500 font-bold mb-3 flex items-center gap-2 justify-center md:justify-start">
                    <Guitar size={16}/> Afinación
                  </h4>
                  <p className="text-[10px] font-medium text-zinc-400 bg-zinc-950/80 px-2 py-1.5 rounded-md border border-white/5 mb-3 leading-tight text-left">
                    1 es la cuerda más delgada y 6 es la más gruesa.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {tuning.length > 0 ? (
                      tuning.map((t, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-zinc-950/50 px-3 py-1.5 rounded-lg border border-white/5">
                          <span className="text-zinc-500 text-xs font-bold">Cuerda {t.stringNumber}</span>
                          <span className="text-primary-400 font-black text-sm">{t.note}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs font-mono text-zinc-500 italic bg-black/40 px-3 py-2 rounded-lg border border-white/5 text-center w-full">
                        N/A
                      </span>
                    )}
                  </div>
                  <div className="absolute top-full right-6 md:left-1/2 md:-translate-x-1/2 border-[6px] border-transparent border-t-zinc-900 pointer-events-none" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>




        </div>
      )}
    </motion.div>
  );
};
