import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { BookmarkPlus, ChevronDown, ChevronLeft, ChevronRight, Gauge, Headphones, Map, Minus, Plus, Save, Trash2 } from 'lucide-react';
import { db, type PracticeLoop, type Song } from '../db';
import { usePlayerStore } from '../store/playerStore';
import { v4 as uuidv4 } from 'uuid';
import { Tooltip } from './PracticeControls';

interface AdvancedPracticePanelProps {
  apiRef: React.RefObject<alphaTab.AlphaTabApi | null>;
  song: Song;
  tracks: alphaTab.model.Track[];
  playbackRange: { startTick: number; endTick: number } | null;
  originalBpm: number;
  targetBpm: number;
  handleBpmChange: (bpm: number) => void;
  isNotePreviewMode: boolean;
  setIsNotePreviewMode: (active: boolean) => void;
  onPracticeLoopsChange: (loops: PracticeLoop[]) => void;
  onSeekTick: (tick: number) => void;
  onTrainerStatusChange: (status: TrainerStatus) => void;
  trainerReplayRequest: number;
}

export interface TrainerStatus {
  enabled: boolean;
  completed: boolean;
  bpm: number;
  repetition: number;
  repetitions: number;
  progress: number;
  scope: 'loop' | 'song';
}

interface TrainerNumberControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}

const TrainerNumberControl = ({ label, value, min, max, suffix, onChange }: TrainerNumberControlProps) => {
  const [inputValue, setInputValue] = useState<string | null>(null);
  const displayedValue = inputValue ?? String(value);

  const commitValue = () => {
    const parsedValue = Number(displayedValue);
    const nextValue = Number.isFinite(parsedValue) ? Math.min(max, Math.max(min, Math.round(parsedValue))) : value;
    onChange(nextValue);
    setInputValue(null);
  };

  return (
    <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-zinc-500">
      {label}
      <span className="flex items-center rounded-lg border border-white/10 bg-zinc-900 p-0.5 focus-within:border-sky-500/40">
        <button type="button" onClick={() => { setInputValue(null); onChange(Math.max(min, value - 1)); }} disabled={value <= min} className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-30" aria-label={`Disminuir ${label.toLowerCase()}`}>
          <Minus size={13} />
        </button>
        <input type="text" inputMode="numeric" value={displayedValue} onChange={event => /^\d*$/.test(event.target.value) && setInputValue(event.target.value)} onBlur={commitValue} onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} className="w-11 bg-transparent text-center text-sm font-bold text-sky-300 outline-none" aria-label={label} />
        {suffix && <span className="mr-1 text-[9px] text-zinc-600">{suffix}</span>}
        <button type="button" onClick={() => { setInputValue(null); onChange(Math.min(max, value + 1)); }} disabled={value >= max} className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-30" aria-label={`Aumentar ${label.toLowerCase()}`}>
          <Plus size={13} />
        </button>
      </span>
    </label>
  );
};

export const AdvancedPracticePanel = ({
  apiRef,
  song,
  tracks,
  playbackRange,
  originalBpm,
  targetBpm,
  handleBpmChange,
  isNotePreviewMode,
  setIsNotePreviewMode,
  onPracticeLoopsChange,
  onSeekTick,
  onTrainerStatusChange,
  trainerReplayRequest,
}: AdvancedPracticePanelProps) => {
  const [loopName, setLoopName] = useState('');
  const [savedLoops, setSavedLoops] = useState<PracticeLoop[]>(song.practiceLoops ?? []);
  const [trainerEnabled, setTrainerEnabled] = useState(false);
  const [trainerRepetitions, setTrainerRepetitions] = useState(3);
  const [completedRepetitions, setCompletedRepetitions] = useState(0);
  const [trainerCompleted, setTrainerCompleted] = useState(false);
  const [isTrainerOpen, setIsTrainerOpen] = useState(false);
  const [isSectionsOpen, setIsSectionsOpen] = useState(false);
  const [isLoopsOpen, setIsLoopsOpen] = useState(false);
  const trainerUsesWholeSongRef = useRef(false);
  const completedRepetitionsRef = useRef(0);
  const trainerEnabledRef = useRef(false);
  const trainerCompletedRef = useRef(false);
  const lastReplayRequestRef = useRef(trainerReplayRequest);
  const setIsLooping = usePlayerStore(state => state.setIsLooping);

  const masterBars = useMemo(() => tracks[0]?.score.masterBars ?? [], [tracks]);
  const sections = useMemo(() => masterBars
    .filter(bar => bar.section)
    .map(bar => ({ label: bar.section?.text || bar.section?.marker || `Compás ${bar.index + 1}`, tick: bar.start })), [masterBars]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const handleFinished = () => {
      if (!trainerEnabledRef.current || trainerCompletedRef.current) return;
      const nextCount = completedRepetitionsRef.current + 1;
      completedRepetitionsRef.current = nextCount;
      setCompletedRepetitions(nextCount);
      if (nextCount >= trainerRepetitions) {
        trainerCompletedRef.current = true;
        setTrainerCompleted(true);
        handleBpmChange(originalBpm);
        api.isLooping = false;
        api.stop();
        return;
      }
      const startBpm = trainerRepetitions === 1 ? originalBpm : Math.max(20, Math.round(originalBpm * 0.6));
      const nextBpm = Math.round(startBpm + ((originalBpm - startBpm) * nextCount) / (trainerRepetitions - 1));
      handleBpmChange(nextBpm);
    };
    api.playerFinished.on(handleFinished);
    return () => api.playerFinished.off(handleFinished);
  }, [apiRef, handleBpmChange, originalBpm, trainerRepetitions]);

  const handleSectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onSeekTick(Number(event.target.value));
  };

  const adjustRange = (edge: 'start' | 'end', direction: -1 | 1) => {
    const api = apiRef.current;
    if (!api || !playbackRange || masterBars.length === 0) return;
    const tick = edge === 'start' ? playbackRange.startTick : Math.max(playbackRange.startTick, playbackRange.endTick - 1);
    const index = Math.max(0, masterBars.findIndex((bar, barIndex) => tick >= bar.start && tick < (masterBars[barIndex + 1]?.start ?? api.endTick + 1)));
    const nextIndex = Math.min(masterBars.length - 1, Math.max(0, index + direction));
    const nextRange = {
      startTick: edge === 'start' ? masterBars[nextIndex].start : playbackRange.startTick,
      endTick: edge === 'end' ? (masterBars[nextIndex + 1]?.start ?? api.endTick) : playbackRange.endTick,
    };
    if (nextRange.startTick >= nextRange.endTick) return;
    api.playbackRange = nextRange;
    api.isLooping = true;
    setIsLooping(true);
  };

  const saveCurrentLoop = async () => {
    if (!song.id || !playbackRange) return;
    const nextLoop: PracticeLoop = {
      id: uuidv4(),
      name: loopName.trim() || `Loop ${savedLoops.length + 1}`,
      ...playbackRange,
    };
    const nextLoops = [...savedLoops, nextLoop];
    setSavedLoops(nextLoops);
    onPracticeLoopsChange(nextLoops);
    setLoopName('');
    await db.songs.update(song.id, { practiceLoops: nextLoops });
  };

  const loadLoop = (loop: PracticeLoop) => {
    const api = apiRef.current;
    if (!api) return;
    api.playbackRange = { startTick: loop.startTick, endTick: loop.endTick };
    api.isLooping = true;
    setIsLooping(true);
    onSeekTick(loop.startTick);
  };

  const deleteLoop = async (id: string) => {
    if (!song.id) return;
    const nextLoops = savedLoops.filter(loop => loop.id !== id);
    setSavedLoops(nextLoops);
    onPracticeLoopsChange(nextLoops);
    await db.songs.update(song.id, { practiceLoops: nextLoops });
  };

  const prepareTrainer = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    // Fully reset AlphaTab before arming a new session. pause() can leave a
    // scheduled loop restart alive and cause overlapping audio on replay.
    trainerEnabledRef.current = false;
    trainerCompletedRef.current = true;
    api.isLooping = false;
    api.stop();

    const startBpm = trainerRepetitions === 1 ? originalBpm : Math.max(20, Math.round(originalBpm * 0.6));
    trainerUsesWholeSongRef.current = !playbackRange;
    handleBpmChange(startBpm);
    api.tickPosition = playbackRange?.startTick ?? 0;
    api.isLooping = true;

    trainerEnabledRef.current = true;
    trainerCompletedRef.current = false;
    completedRepetitionsRef.current = 0;
    setTrainerEnabled(true);
    setTrainerCompleted(false);
    setCompletedRepetitions(0);
    setIsTrainerOpen(false);
  }, [apiRef, handleBpmChange, originalBpm, playbackRange, trainerRepetitions]);

  const toggleTrainer = () => {
    const api = apiRef.current;
    if (!api) return;
    if (!trainerEnabled || trainerCompleted) {
      prepareTrainer();
      return;
    }
    trainerEnabledRef.current = false;
    setTrainerEnabled(false);
    api.isLooping = false;
    api.stop();
  };

  useEffect(() => {
    if (trainerReplayRequest === lastReplayRequestRef.current) return;
    lastReplayRequestRef.current = trainerReplayRequest;
    queueMicrotask(prepareTrainer);
  }, [prepareTrainer, trainerReplayRequest]);

  const trainerStartBpm = trainerRepetitions === 1 ? originalBpm : Math.max(20, Math.round(originalBpm * 0.6));
  const averageIncrease = trainerRepetitions > 1 ? (originalBpm - trainerStartBpm) / (trainerRepetitions - 1) : 0;
  const trainerProgress = Math.min(100, (completedRepetitions / trainerRepetitions) * 100);

  useEffect(() => {
    onTrainerStatusChange({
      enabled: trainerEnabled,
      completed: trainerCompleted,
      bpm: targetBpm,
      repetition: Math.min(trainerRepetitions, completedRepetitions + 1),
      repetitions: trainerRepetitions,
      progress: trainerProgress,
      scope: playbackRange ? 'loop' : 'song',
    });
  }, [completedRepetitions, onTrainerStatusChange, playbackRange, targetBpm, trainerCompleted, trainerEnabled, trainerProgress, trainerRepetitions]);

  const toggleNotePreview = () => {
    setIsNotePreviewMode(!isNotePreviewMode);
  };

  return (
    <>
      {sections.length > 0 && <Tooltip text="Navegar por las secciones de la canción"><button type="button" onClick={() => setIsSectionsOpen(current => !current)} className={`flex h-10 items-center overflow-hidden rounded-lg border transition-colors ${isSectionsOpen ? 'border-primary-500/40 bg-primary-500/10 text-primary-300' : 'border-white/5 bg-zinc-950/70 text-zinc-400'}`}>
        <span className="flex h-full w-10 items-center justify-center"><Map size={17} /></span>
        <ChevronDown size={13} className={`mr-1.5 text-zinc-500 transition-transform ${isSectionsOpen ? 'rotate-180' : ''}`} />
      </button></Tooltip>}

      <Tooltip text={isNotePreviewMode ? 'Desactivar escucha de notas' : 'Escuchar una nota al pulsarla'}><button type="button" onClick={toggleNotePreview} aria-pressed={isNotePreviewMode} className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${isNotePreviewMode ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300' : 'border-white/5 bg-zinc-950/70 text-zinc-400 hover:text-zinc-200'}`}>
        <Headphones size={17} />
      </button></Tooltip>

      <Tooltip text="Configurar entrenador progresivo"><button type="button" onClick={() => setIsTrainerOpen(current => !current)} className={`relative flex h-10 items-center overflow-hidden rounded-lg border transition-colors ${isTrainerOpen || trainerEnabled ? 'border-sky-500/40 bg-sky-500/10 text-sky-300' : 'border-white/5 bg-zinc-950/70 text-zinc-400'}`}>
        <span className="flex h-full w-10 items-center justify-center"><Gauge size={17} /></span>
        {trainerEnabled && <span className="absolute right-4 top-1 h-1.5 w-1.5 rounded-full bg-sky-400" />}
        <ChevronDown size={13} className={`mr-1.5 text-zinc-500 transition-transform ${isTrainerOpen ? 'rotate-180' : ''}`} />
      </button></Tooltip>

      {(playbackRange || savedLoops.length > 0) && <Tooltip text="Ajustar y guardar loops"><button type="button" onClick={() => setIsLoopsOpen(current => !current)} className={`relative flex h-10 items-center overflow-hidden rounded-lg border transition-colors ${isLoopsOpen ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-white/5 bg-zinc-950/70 text-zinc-400'}`}>
        <span className="flex h-full w-10 items-center justify-center"><BookmarkPlus size={17} /></span>
        {savedLoops.length > 0 && <span className="absolute left-6 top-1 rounded-full bg-emerald-500 px-1 text-[8px] font-black text-zinc-950">{savedLoops.length}</span>}
        <ChevronDown size={13} className={`mr-1.5 text-zinc-500 transition-transform ${isLoopsOpen ? 'rotate-180' : ''}`} />
      </button></Tooltip>}

      {isSectionsOpen && sections.length > 0 && <div className="w-full rounded-xl border border-primary-500/15 bg-zinc-950/80 p-2">
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-400"><Map size={15} className="text-primary-400" /> Ir a sección
          <select onChange={handleSectionChange} defaultValue="" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-800 px-2 py-2 text-zinc-200 outline-none">
            <option value="" disabled>Seleccionar…</option>
            {sections.map(section => <option key={`${section.tick}-${section.label}`} value={section.tick}>{section.label}</option>)}
          </select>
        </label>
      </div>}

      {isLoopsOpen && <div className="w-full space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
      {playbackRange && <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-xs font-black uppercase tracking-wider text-emerald-400">Rango seleccionado</span>
            <button type="button" onClick={() => adjustRange('start', -1)} className="rounded-lg bg-zinc-800 p-2 text-zinc-300" title="Mover inicio un compás atrás"><ChevronLeft size={15} /></button>
            <span className="text-[10px] font-bold text-zinc-500">INICIO</span>
            <button type="button" onClick={() => adjustRange('start', 1)} className="rounded-lg bg-zinc-800 p-2 text-zinc-300" title="Mover inicio un compás adelante"><ChevronRight size={15} /></button>
            <button type="button" onClick={() => adjustRange('end', -1)} className="rounded-lg bg-zinc-800 p-2 text-zinc-300" title="Mover fin un compás atrás"><ChevronLeft size={15} /></button>
            <span className="text-[10px] font-bold text-zinc-500">FIN</span>
            <button type="button" onClick={() => adjustRange('end', 1)} className="rounded-lg bg-zinc-800 p-2 text-zinc-300" title="Mover fin un compás adelante"><ChevronRight size={15} /></button>
          </div>
          <div className="flex gap-2">
            <input value={loopName} onChange={event => setLoopName(event.target.value)} placeholder={`Loop ${savedLoops.length + 1}`} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-emerald-500/50" />
            <button type="button" onClick={saveCurrentLoop} className="flex min-h-10 items-center gap-2 rounded-lg bg-emerald-500 px-3 text-xs font-black text-zinc-950"><Save size={15} /> Guardar</button>
          </div>
        </>}
      {savedLoops.length > 0 && <div className="flex flex-wrap gap-2 border-t border-white/5 pt-2">
        {savedLoops.map(loop => <div key={loop.id} className="flex items-center overflow-hidden rounded-lg border border-white/5 bg-zinc-950/70">
          <button type="button" onClick={() => loadLoop(loop)} className="flex min-h-10 items-center gap-2 px-3 text-xs font-bold text-zinc-300 hover:text-primary-300"><BookmarkPlus size={14} /> {loop.name}</button>
          <button type="button" onClick={() => deleteLoop(loop.id)} className="min-h-10 border-l border-white/5 px-2 text-zinc-600 hover:text-rose-400" aria-label={`Eliminar ${loop.name}`}><Trash2 size={14} /></button>
        </div>)}
      </div>}
      </div>}

      {isTrainerOpen && <div className="w-full rounded-xl border border-sky-500/15 bg-sky-500/5 p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-300"><Gauge size={15} /> Entrenador progresivo</div>
          <div className="flex flex-wrap items-end gap-2">
          <TrainerNumberControl label="Vueltas" value={trainerRepetitions} min={1} max={99} onChange={setTrainerRepetitions} />
          <button type="button" onClick={toggleTrainer} className={`min-h-10 rounded-lg px-4 text-xs font-black ${trainerEnabled && !trainerCompleted ? 'bg-rose-500 text-white' : 'bg-sky-500 text-zinc-950'}`}>{trainerEnabled && !trainerCompleted ? 'Detener' : trainerCompleted ? 'Preparar de nuevo' : 'Preparar'}</button>
          </div>
          {(!trainerEnabled || trainerCompleted) && <div className="mt-3 rounded-lg border border-white/5 bg-zinc-950/50 p-2.5 text-xs text-zinc-400">
            <span className="font-bold text-zinc-200">Plan automático:</span> {trainerStartBpm} → {originalBpm} BPM en {trainerRepetitions} {trainerRepetitions === 1 ? 'vuelta' : 'vueltas'}{trainerRepetitions > 1 && ` · aproximadamente +${averageIncrease.toFixed(1)} BPM por vuelta`}.
            <div className="mt-1 text-zinc-500">{playbackRange ? 'Se practicará el bucle seleccionado.' : 'Sin un bucle seleccionado, se practicará la canción completa.'}</div>
          </div>}
      </div>}
    </>
  );
};
