import { useEffect, useMemo, useRef, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { BookmarkPlus, ChevronDown, ChevronLeft, ChevronRight, Gauge, Headphones, Map, Save, Trash2 } from 'lucide-react';
import { db, type PracticeLoop, type Song } from '../db';
import { usePlayerStore } from '../store/playerStore';
import { v4 as uuidv4 } from 'uuid';
import { Tooltip } from './PracticeControls';

interface AdvancedPracticePanelProps {
  apiRef: React.RefObject<alphaTab.AlphaTabApi | null>;
  song: Song;
  tracks: alphaTab.model.Track[];
  playbackRange: { startTick: number; endTick: number } | null;
  targetBpm: number;
  handleBpmChange: (bpm: number) => void;
  isNotePreviewMode: boolean;
  setIsNotePreviewMode: (active: boolean) => void;
  onPracticeLoopsChange: (loops: PracticeLoop[]) => void;
  onSeekTick: (tick: number) => void;
}

export const AdvancedPracticePanel = ({
  apiRef,
  song,
  tracks,
  playbackRange,
  targetBpm,
  handleBpmChange,
  isNotePreviewMode,
  setIsNotePreviewMode,
  onPracticeLoopsChange,
  onSeekTick,
}: AdvancedPracticePanelProps) => {
  const [loopName, setLoopName] = useState('');
  const [savedLoops, setSavedLoops] = useState<PracticeLoop[]>(song.practiceLoops ?? []);
  const [trainerEnabled, setTrainerEnabled] = useState(false);
  const [trainerStart, setTrainerStart] = useState(Math.max(20, Math.round(targetBpm * 0.6)));
  const [trainerEnd, setTrainerEnd] = useState(targetBpm);
  const [trainerStep, setTrainerStep] = useState(5);
  const [trainerRepetitions, setTrainerRepetitions] = useState(3);
  const [completedRepetitions, setCompletedRepetitions] = useState(0);
  const [isTrainerOpen, setIsTrainerOpen] = useState(false);
  const [isSectionsOpen, setIsSectionsOpen] = useState(false);
  const [isLoopsOpen, setIsLoopsOpen] = useState(false);
  const previousTickRef = useRef(0);
  const setIsLooping = usePlayerStore(state => state.setIsLooping);

  const masterBars = useMemo(() => tracks[0]?.score.masterBars ?? [], [tracks]);
  const sections = useMemo(() => masterBars
    .filter(bar => bar.section)
    .map(bar => ({ label: bar.section?.text || bar.section?.marker || `Compás ${bar.index + 1}`, tick: bar.start })), [masterBars]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const handlePosition = (position: alphaTab.synth.PositionChangedEventArgs) => {
      if (!trainerEnabled || !api.playbackRange || api.playerState !== alphaTab.synth.PlayerState.Playing) {
        previousTickRef.current = position.currentTick;
        return;
      }
      const wrapped = !position.isSeek && previousTickRef.current > position.currentTick && position.currentTick <= api.playbackRange.startTick + 200;
      previousTickRef.current = position.currentTick;
      if (!wrapped) return;

      setCompletedRepetitions(current => {
        const nextCount = current + 1;
        if (nextCount < trainerRepetitions) return nextCount;
        const nextBpm = Math.min(trainerEnd, targetBpm + trainerStep);
        if (nextBpm > targetBpm) handleBpmChange(nextBpm);
        if (nextBpm >= trainerEnd) setTrainerEnabled(false);
        return 0;
      });
    };
    api.playerPositionChanged.on(handlePosition);
    return () => api.playerPositionChanged.off(handlePosition);
  }, [apiRef, handleBpmChange, targetBpm, trainerEnabled, trainerEnd, trainerRepetitions, trainerStep]);

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

  const toggleTrainer = () => {
    if (!playbackRange) return;
    const nextEnabled = !trainerEnabled;
    setTrainerEnabled(nextEnabled);
    setCompletedRepetitions(0);
    previousTickRef.current = playbackRange.startTick;
    if (nextEnabled) handleBpmChange(trainerStart);
  };

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
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-300"><Gauge size={15} /> Entrenador progresivo {trainerEnabled && <span className="ml-auto normal-case text-zinc-400">{targetBpm} BPM · {completedRepetitions}/{trainerRepetitions}</span>}</div>
          <div className="flex flex-wrap items-end gap-2">
          {[['Inicio', trainerStart, setTrainerStart], ['Meta', trainerEnd, setTrainerEnd], ['Paso', trainerStep, setTrainerStep], ['Vueltas', trainerRepetitions, setTrainerRepetitions]].map(([label, value, setter]) => (
            <label key={String(label)} className="flex flex-col gap-1 text-[10px] font-bold uppercase text-zinc-500">{String(label)}
              <input type="number" value={Number(value)} min="1" onChange={event => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(event.target.value))} className="w-20 rounded-lg border border-white/10 bg-zinc-900 px-2 py-2 text-sm text-zinc-200 outline-none" />
            </label>
          ))}
          <button type="button" disabled={!playbackRange} onClick={toggleTrainer} className={`min-h-10 rounded-lg px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${trainerEnabled ? 'bg-rose-500 text-white' : 'bg-sky-500 text-zinc-950'}`}>{trainerEnabled ? 'Detener' : 'Comenzar'}</button>
          </div>
          {!playbackRange && <p className="mt-2 text-xs text-zinc-500">Selecciona primero una sección con el modo bucle.</p>}
      </div>}
    </>
  );
};
