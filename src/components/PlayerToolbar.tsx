import { Play, Pause, Guitar, Loader2, AlertTriangle, RotateCcw, SlidersHorizontal, Volume2 } from 'lucide-react';
import * as alphaTab from '@coderline/alphatab';
import { motion } from 'framer-motion';
import { CustomSelect } from './CustomSelect';
import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { TrainerStatus } from './AdvancedPracticePanel';

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
  currentTime: number;
  endTime: number;
  currentTick: number;
  endTick: number;
  currentBar: number;
  totalBars: number;
  barMarkers: { tick: number; label: string; isSection: boolean }[];
  loopMarkers: { id: string; name: string; startTick: number; endTick: number }[];
  onSeekTick: (tick: number) => void;
  onLoopSelect: (loop: { startTick: number; endTick: number }) => void;
  trainerStatus: TrainerStatus;
  onTrainerReplay: () => void;
}

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

const positionLoopMarkers = (loops: { id: string; name: string; startTick: number; endTick: number }[]) => {
  const laneEnds: number[] = [];
  return [...loops]
    .sort((first, second) => first.startTick - second.startTick || first.endTick - second.endTick)
    .map(loop => {
      let lane = laneEnds.findIndex(endTick => endTick <= loop.startTick);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = loop.endTick;
      return { ...loop, lane };
    });
};

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
  currentTime,
  endTime,
  currentTick,
  endTick,
  currentBar,
  totalBars,
  barMarkers,
  loopMarkers,
  onSeekTick,
  onLoopSelect,
  trainerStatus,
  onTrainerReplay,
}: PlayerToolbarProps) => {
  const [isTuningOpen, setIsTuningOpen] = useState(false);
  const positionedLoopMarkers = useMemo(() => positionLoopMarkers(loopMarkers), [loopMarkers]);
  const loopMarkerElements = useMemo(() => positionedLoopMarkers.map(loop => (
    <div key={loop.id}>
      <div
        className="pointer-events-none absolute h-1 rounded-sm border border-emerald-400/60 bg-emerald-400/30"
        style={{
          top: `${1 + loop.lane * 4}px`,
          left: `${endTick > 0 ? (loop.startTick / endTick) * 100 : 0}%`,
          width: `${endTick > 0 ? Math.max(0.5, ((loop.endTick - loop.startTick) / endTick) * 100) : 0}%`,
        }}
      />
      <button
        type="button"
        onClick={() => onLoopSelect(loop)}
        title={`${loop.name} · Activar loop`}
        aria-label={`Activar loop ${loop.name}`}
        className="pointer-events-auto absolute z-10 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] border border-emerald-300 bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.7)] transition-transform hover:scale-150"
        style={{ top: `${loop.lane * 4}px`, left: `${endTick > 0 ? (loop.startTick / endTick) * 100 : 0}%` }}
      />
    </div>
  )), [endTick, onLoopSelect, positionedLoopMarkers]);
  const barMarkerElements = useMemo(() => barMarkers.map((marker, index) => (
    <button
      key={`${marker.tick}-${index}`}
      type="button"
      onClick={() => onSeekTick(marker.tick)}
      title={`${marker.label} · Compás ${index + 1}`}
      aria-label={`Ir a ${marker.label}, compás ${index + 1}`}
      className={`pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-150 ${marker.isSection ? 'h-3 w-1.5 bg-primary-400 shadow-[0_0_6px_var(--theme-glow)]' : 'h-2 w-px bg-zinc-400/70'}`}
      style={{ left: `${endTick > 0 ? (marker.tick / endTick) * 100 : 0}%` }}
    />
  )), [barMarkers, endTick, onSeekTick]);
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
      className="relative flex min-h-[60px] w-full flex-col items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur-xl transition-colors sm:gap-4 sm:p-4 md:min-h-[80px] md:flex-row md:gap-6 md:rounded-3xl md:p-5">

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
        <div className="z-10 flex w-full flex-col gap-1.5">
        <div className="flex w-full flex-nowrap items-center justify-between gap-2 sm:flex-wrap sm:gap-3 md:flex-nowrap md:gap-6">
          
          {/* PLAY BUTTON & TRACK SELECTOR */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:gap-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary-300/50 bg-gradient-to-br from-primary-400 to-primary-600 text-zinc-950 shadow-[0_0_20px_var(--theme-glow-strong)] disabled:opacity-50 md:h-14 md:w-14"
              disabled={isLoading}
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" className="md:w-7 md:h-7" />
              ) : (
                <Play size={24} fill="currentColor" className="ml-1 md:w-7 md:h-7" />
              )}
            </motion.button>

            <div className="h-10 w-px bg-white/10 hidden md:block"></div>

            <div className="flex min-w-0 flex-1 flex-col sm:max-w-[280px]">
              <span className="mb-1 hidden items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 sm:flex">
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
          <div className="hidden min-w-[120px] flex-1 flex-col sm:flex md:max-w-[120px]">
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
            className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl p-2 transition-all md:ml-0 md:p-3 ${isMixerOpen ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white'}`}
            title="Mezclador de Pistas"
          >
            <SlidersHorizontal size={18} className="md:w-5 md:h-5" />
          </button>

          {/* TUNING DISPLAY (POPOVER) */}
          <div 
            className="relative z-50 hidden shrink-0 flex-col text-center sm:flex md:text-right"
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
        {trainerStatus.enabled && <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="shrink-0 text-lg font-black leading-none text-sky-300">{trainerStatus.bpm} <span className="text-[9px] text-zinc-500">BPM</span></div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold">
                <span className="truncate text-zinc-200">{trainerStatus.completed ? `Completado · ${trainerStatus.repetitions} vueltas` : `Vuelta ${trainerStatus.repetition} de ${trainerStatus.repetitions}`}</span>
                <span className="hidden shrink-0 uppercase tracking-wider text-sky-300 sm:block">{trainerStatus.scope === 'loop' ? 'Bucle seleccionado' : 'Canción completa'}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-label="Progreso del entrenador" aria-valuenow={Math.round(trainerStatus.progress)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all" style={{ width: `${trainerStatus.progress}%` }} /></div>
            </div>
            {trainerStatus.completed && <button type="button" onClick={onTrainerReplay} className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-[10px] font-black text-zinc-950 hover:bg-sky-400"><RotateCcw size={13} /> Repetir</button>}
          </div>
        </div>}
        <div className="flex w-full items-center gap-2 px-1 text-[9px] font-bold text-zinc-500 sm:gap-3 sm:text-[10px]">
          <span className="hidden shrink-0 sm:block">Compás {currentBar}/{totalBars || 1}</span>
          <div className="relative flex min-w-0 flex-1 items-center">
            <input
              type="range"
              min="0"
              max={Math.max(1, endTick)}
              step="1"
              value={currentTick}
              onChange={(event) => onSeekTick(Number(event.target.value))}
              aria-label="Posición de la canción"
              className="relative z-10 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700"
            />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-6 -translate-y-1/2">
              {loopMarkerElements}
              {barMarkerElements}
            </div>
          </div>
          <span className="shrink-0 font-mono">{formatTime(currentTime)} / {formatTime(endTime)}</span>
        </div>
        </div>
      )}
    </motion.div>
  );
};
