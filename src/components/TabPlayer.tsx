import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { motion, AnimatePresence } from 'framer-motion';
import { Guitar, Loader2, Settings2, Play, Pause, Plus, Minus, Printer, Trash2, MoreVertical, Maximize, Download, X, ChevronUp, Keyboard } from 'lucide-react';
import { PlayerToolbar } from './PlayerToolbar';
import { PracticeControls } from './PracticeControls';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { AdvancedPracticePanel, type TrainerStatus } from './AdvancedPracticePanel';
import { TrackMixer } from './TrackMixer';
import { ChordsView } from './ChordsView';
import { Navbar } from './Navbar';
import { db, type PracticeLoop, type Song } from '../db';
import { usePlayerStore } from '../store/playerStore';
import { useAudioStore } from '../store/audioStore';
import { useAlphaTab } from '../hooks/useAlphaTab';
import { useUiStore } from '../store/uiStore';
import { useMetronome, type MetronomeSound } from '../hooks/useMetronome';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

interface TabPlayerProps {
  song: Song;
  onBack: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const TabPlayer = ({ song, onBack, isSidebarOpen, onToggleSidebar }: TabPlayerProps) => {
  const { toggleImmersiveMode, isImmersiveMode } = useUiStore();
  const {
    mainViewMode, setMainViewMode,
    masterVolume, setMasterVolume,
    playbackSpeed, setPlaybackSpeed,
    isMetronomeActive, setIsMetronomeActive,
    isLooping, setIsLooping,
    isNotePreviewMode, setIsNotePreviewMode
  } = usePlayerStore();

  const {
    containerRef,
    apiRef,
    isPlaying,
    playerPosition,
    playbackRange,
    tracks,
    activeTrackIndex,
    transposition,
    setTransposition,
    tuning,
    songTitle,
    songArtist,
    songAlbum,
    originalTempo,
    isLoading,
    setIsLoading,
    loadingMsg,
    setLoadingMsg,
    errorMsg,
    trackVolumes,
    setTrackVolumes,
    trackMutes,
    setTrackMutes,
    trackSolos,
    setTrackSolos,
    changeTrack
  } = useAlphaTab(song);

  const hasCifraContent = useMemo(() => {
    if (song.textContent?.trim()) return true;
    const activeTrack = tracks[activeTrackIndex];
    return activeTrack?.staves.some(stave => stave.bars.some(bar =>
      bar.voices.some(voice => voice.beats.some(beat =>
        Boolean(beat.chord?.name || beat.lyrics?.some(lyric => lyric.trim()))
      ))
    )) ?? false;
  }, [activeTrackIndex, song.textContent, tracks]);

  const [isMetronomePreviewing, setIsMetronomePreviewing] = useState(false);
  const [metronomeSound, setMetronomeSound] = useState<MetronomeSound>('classic');
  const [metronomeVolume, setMetronomeVolume] = useState(0.6);
  const [practiceLoops, setPracticeLoops] = useState<PracticeLoop[]>(song.practiceLoops ?? []);
  const [trainerStatus, setTrainerStatus] = useState<TrainerStatus>({ enabled: false, completed: false, bpm: 0, repetition: 1, repetitions: 1, progress: 0, scope: 'song' });
  const [trainerReplayRequest, setTrainerReplayRequest] = useState(0);
  const [includeChordDiagramsInPrint, setIncludeChordDiagramsInPrint] = useState(false);
  const targetBpm = Math.round(originalTempo * playbackSpeed);
  const masterBars = useMemo(() => tracks[0]?.score.masterBars ?? [], [tracks]);
  const currentBarIndex = Math.max(0, masterBars.findIndex((bar, index) => {
    const nextStart = masterBars[index + 1]?.start ?? Number.POSITIVE_INFINITY;
    return playerPosition.currentTick >= bar.start && playerPosition.currentTick < nextStart;
  }));
  const barMarkers = useMemo(() => masterBars.map(bar => ({
    tick: bar.start,
    label: bar.section?.text || bar.section?.marker || `Compás ${bar.index + 1}`,
    isSection: Boolean(bar.section),
  })), [masterBars]);
  const shouldPlayMetronome = isMetronomePreviewing || (isMetronomeActive && (mainViewMode === 'cifra' || isPlaying));
  useMetronome(targetBpm, shouldPlayMetronome, metronomeSound, metronomeVolume);

  useEffect(() => {
    if (apiRef.current) {
      apiRef.current.metronomeVolume = 0;
    }
  }, [apiRef, tracks]);

  useEffect(() => {
    return () => setIsMetronomeActive(false);
  }, [setIsMetronomeActive]);

  useEffect(() => {
    useAudioStore.getState().setGlobalIsPlaying(isPlaying);
    return () => useAudioStore.getState().setGlobalIsPlaying(false);
  }, [isPlaying]);

  useEffect(() => {
    // If song only has text/chords, force 'cifra' mode
    if (song.type === 'text' || (!song.data && song.textContent)) {
      setMainViewMode('cifra');
    }
    // If song only has tab data, force 'pro' mode
    else if (song.data && !song.textContent) {
      setMainViewMode('pro');
    }
    // Otherwise, it has both, and we respect the user's previously saved mainViewMode
  }, [song.id, song.type, song.data, song.textContent, setMainViewMode]);

  const handleDeleteSong = async () => {
    if (!song || !song.id) return;
    
    const result = await MySwal.fire({
      title: '¿Eliminar canción?',
      text: `¿Estás seguro de que quieres eliminar "${song.name}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5',
      customClass: {
        popup: 'rounded-2xl border border-white/10 shadow-2xl',
        confirmButton: 'rounded-xl font-bold px-6 text-white',
        cancelButton: 'rounded-xl font-bold px-6 text-white'
      }
    });

    if (result.isConfirmed) {
      await db.songs.delete(song.id);
      onBack(); // Volver a la biblioteca
    }
  };

  const handleSaveToLibrary = async () => {
    if (!song || !song.id) return;
    const result = await MySwal.fire({
      title: 'Guardar en mi Biblioteca',
      text: `¿Quieres guardar "${song.name}" permanentemente en tu biblioteca?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5',
      customClass: {
        popup: 'rounded-2xl border border-white/10 shadow-2xl',
        confirmButton: 'rounded-xl font-bold px-6 text-white',
        cancelButton: 'rounded-xl font-bold px-6 text-white'
      }
    });
    if (result.isConfirmed) {
      await db.songs.update(song.id, { isTemporary: false, catalogSourceId: undefined });
      MySwal.fire({
        title: '¡Guardada!',
        text: `"${song.name}" ahora está en tu biblioteca.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        background: '#18181b',
        color: '#f4f4f5',
      });
    }
  };

  // AUTOSCROLL STATE
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(3);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isMixerOpen, setIsMixerOpen] = useState(false);
  // CONTROL DE VISTAS Y HERRAMIENTAS
  const [showPracticeControls, setShowPracticeControls] = useState(false);
  const [isChordsEditing, setIsChordsEditing] = useState(false);

  // MOBILE MORE MENU LOGIC
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false);
  const mobileMoreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (mobileMoreMenuRef.current && !mobileMoreMenuRef.current.contains(event.target as Node)) {
        setIsMobileMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!showPracticeControls) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowPracticeControls(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showPracticeControls]);

  // AUTO-HIDE TOOLBAR LOGIC
  const [showToolbar, setShowToolbar] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = useCallback(() => {
    setShowToolbar(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      if (apiRef.current && apiRef.current.playerState === alphaTab.synth.PlayerState.Playing) {
        setShowToolbar(false);
      }
    }, 2500);
  }, [apiRef]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleMouseMove);
    hideTimeoutRef.current = setTimeout(() => {
      if (apiRef.current && apiRef.current.playerState === alphaTab.synth.PlayerState.Playing) {
        setShowToolbar(false);
      }
    }, 2500);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [apiRef, handleMouseMove]);

  const [isHorizontalMode, setIsHorizontalMode] = useState<boolean>(false);
  const [countInBars, setCountInBars] = useState(0);
  const [countInBeat, setCountInBeat] = useState<number | null>(null);
  const [countInBeatsPerBar, setCountInBeatsPerBar] = useState(4);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const countInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countInAudioContextRef = useRef<AudioContext | null>(null);

  const handleTranspositionChange = (delta: number) => {
    const newTransposition = transposition + delta;
    setTransposition(newTransposition);
    if (apiRef.current && tracks.length > 0) {
      apiRef.current.changeTrackTranspositionPitch([tracks[activeTrackIndex]], newTransposition);
    }
    window.removeEventListener('mousemove', handleMouseMove);
  };

  // EFECTO DE AUTOSCROLL
  useEffect(() => {
    if (!isAutoScrolling || mainViewMode !== 'cifra') return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let exactScrollTop = scrollRef.current?.scrollTop || 0;

    const scrollLoop = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      if (scrollRef.current) {
        // Velocidad: 1 = muy lento, 10 = muy rápido
        const pixelsPerSecond = autoScrollSpeed * 10;
        const scrollAmount = (pixelsPerSecond * deltaTime) / 1000;

        exactScrollTop += scrollAmount;
        scrollRef.current.scrollTop = exactScrollTop;

        // Sincronizar exactScrollTop en caso de que el usuario haga scroll manual
        // Si la diferencia es mayor a 2px, significa que el usuario o el sistema movió el scroll manual.
        if (Math.abs(scrollRef.current.scrollTop - exactScrollTop) > 2) {
          exactScrollTop = scrollRef.current.scrollTop;
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    animationFrameId = requestAnimationFrame(scrollLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAutoScrolling, autoScrollSpeed, mainViewMode]);

  const cancelCountIn = useCallback(() => {
    if (countInTimerRef.current) clearTimeout(countInTimerRef.current);
    countInTimerRef.current = null;
    setCountInBeat(null);
  }, []);

  const playCountInClick = useCallback((isAccent: boolean) => {
    const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!countInAudioContextRef.current || countInAudioContextRef.current.state === 'closed') {
      countInAudioContextRef.current = new AudioContextClass();
    }
    const context = countInAudioContextRef.current;
    context.resume().catch(console.error);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = isAccent ? 1200 : 800;
    gain.gain.setValueAtTime(0.2, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.05);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.06);
  }, []);

  const startCountIn = useCallback(() => {
    const api = apiRef.current;
    if (!api || countInBars === 0) {
      api?.play();
      return;
    }

    cancelCountIn();
    const masterBars = api.score?.masterBars ?? [];
    const currentBar = [...masterBars].reverse().find((bar) => bar.start <= api.tickPosition) ?? masterBars[0];
    const beatsPerBar = currentBar?.timeSignatureNumerator || 4;
    const totalBeats = countInBars * beatsPerBar;
    const beatDuration = 60000 / targetBpm;
    let beat = 1;
    setCountInBeatsPerBar(beatsPerBar);

    const tick = () => {
      setCountInBeat(beat);
      playCountInClick((beat - 1) % beatsPerBar === 0);
      if (beat >= totalBeats) {
        countInTimerRef.current = setTimeout(() => {
          setCountInBeat(null);
          countInTimerRef.current = null;
          api.play();
        }, beatDuration);
        return;
      }
      beat += 1;
      countInTimerRef.current = setTimeout(tick, beatDuration);
    };
    tick();
  }, [apiRef, cancelCountIn, countInBars, playCountInClick, targetBpm]);

  const togglePlay = useCallback(() => {
    if (!apiRef.current) return;
    if (countInBeat !== null) {
      cancelCountIn();
      return;
    }
    if (apiRef.current.playerState === alphaTab.synth.PlayerState.Playing) {
      apiRef.current.pause();
    } else {
      startCountIn();
    }
  }, [apiRef, cancelCountIn, countInBeat, startCountIn]);

  const handleBpmChange = useCallback((bpm: number) => {
    const targetBpm = Math.min(300, Math.max(20, Math.round(bpm)));
    const speed = targetBpm / originalTempo;
    setPlaybackSpeed(speed);
    if (apiRef.current) apiRef.current.playbackSpeed = speed;
  }, [apiRef, originalTempo, setPlaybackSpeed]);
  const toggleMetronome = () => {
    setIsMetronomeActive(!isMetronomeActive);
  };
  const cycleCountIn = useCallback(() => setCountInBars(current => (current + 1) % 3), []);
  const toggleLoop = useCallback(() => {
    const newState = !isLooping;
    setIsLooping(newState);
    if (apiRef.current) {
      apiRef.current.isLooping = false;
      if (!newState) {
        apiRef.current.playbackRange = null;
        apiRef.current.clearPlaybackRangeHighlight();
      }
    }
  }, [apiRef, isLooping, setIsLooping]);
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setMasterVolume(vol);
    if (apiRef.current) apiRef.current.masterVolume = vol;
  };
  const centerTabCursor = useCallback(() => {
    const container = containerRef.current;
    const cursor = container?.querySelector('.at-cursor-beat') as HTMLElement | null;
    if (!container || !cursor) return;
    const containerRect = container.getBoundingClientRect();
    const cursorRect = cursor.getBoundingClientRect();
    container.scrollLeft += (cursorRect.left + cursorRect.width / 2) - (containerRect.left + containerRect.width / 2);
    container.scrollTop += (cursorRect.top + cursorRect.height / 2) - (containerRect.top + containerRect.height / 2);
  }, [containerRef]);
  const handleSeekTick = useCallback((tick: number) => {
    const api = apiRef.current;
    if (!api) return;
    api.tickPosition = tick;
    requestAnimationFrame(() => requestAnimationFrame(centerTabCursor));
    setTimeout(centerTabCursor, 80);
  }, [apiRef, centerTabCursor]);
  const handleLoopSelect = useCallback((loop: { startTick: number; endTick: number }) => {
    const api = apiRef.current;
    if (!api) return;
    setIsLooping(true);
    api.playbackRange = loop;
    api.isLooping = true;
    handleSeekTick(loop.startTick);
  }, [apiRef, handleSeekTick, setIsLooping]);

  const toggleMixer = () => setIsMixerOpen(!isMixerOpen);

  useEffect(() => {
    if (!apiRef.current) return;
    apiRef.current.masterVolume = masterVolume;
    
    let ticks = 0;
    const interval = setInterval(() => {
      if (apiRef.current) apiRef.current.masterVolume = masterVolume;
      ticks++;
      if (ticks > 10) clearInterval(interval); // Stop enforcing after 500ms
    }, 50);

    return () => clearInterval(interval);
  }, [trackVolumes, trackMutes, trackSolos, masterVolume, apiRef]);

  const handleTrackVolumeChange = (index: number, vol: number) => {
    setTrackVolumes(prev => ({ ...prev, [index]: vol }));
    if (apiRef.current && tracks[index]) {
      apiRef.current.changeTrackVolume([tracks[index]], vol / 16);
    }
  };

  const handleTrackMuteToggle = useCallback((index: number) => {
    const newMute = !trackMutes[index];
    setTrackMutes(prev => ({ ...prev, [index]: newMute }));
    if (apiRef.current && tracks[index]) {
      apiRef.current.changeTrackMute([tracks[index]], newMute);
    }
  }, [apiRef, setTrackMutes, trackMutes, tracks]);

  // === KEYBOARD SHORTCUTS ===
  useEffect(() => {
    return () => {
      if (countInTimerRef.current) clearTimeout(countInTimerRef.current);
      if (countInAudioContextRef.current && countInAudioContextRef.current.state !== 'closed') {
        countInAudioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  const seekToAdjacentBar = useCallback((direction: -1 | 1) => {
    const api = apiRef.current;
    const masterBars = api?.score?.masterBars;
    if (!api || !masterBars?.length) return;
    const currentIndex = masterBars.findIndex((bar, index) => {
      const nextStart = masterBars[index + 1]?.start ?? Number.POSITIVE_INFINITY;
      return api.tickPosition >= bar.start && api.tickPosition < nextStart;
    });
    const range = api.playbackRange;
    const firstAllowedIndex = range ? Math.max(0, masterBars.findIndex(bar => bar.start >= range.startTick)) : 0;
    const lastAllowedIndex = range
      ? Math.max(firstAllowedIndex, masterBars.findLastIndex(bar => bar.start < range.endTick))
      : masterBars.length - 1;
    const targetIndex = Math.min(lastAllowedIndex, Math.max(firstAllowedIndex, currentIndex + direction));
    handleSeekTick(masterBars[targetIndex].start);
    if (isNotePreviewMode) {
      const targetBar = tracks[activeTrackIndex]?.staves[0]?.bars[targetIndex];
      const beat = targetBar?.voices.flatMap(voice => voice.beats).find(candidate => !candidate.isEmpty);
      if (beat) api.playBeat(beat);
    }
  }, [activeTrackIndex, apiRef, handleSeekTick, isNotePreviewMode, tracks]);

  const seekToAdjacentBeat = useCallback((direction: -1 | 1) => {
    const api = apiRef.current;
    const track = tracks[activeTrackIndex];
    if (!api || !track) return;
    const range = api.playbackRange;
    const allBeats = track.staves.flatMap(stave => stave.bars.flatMap(bar => bar.voices.flatMap(voice => voice.beats)));
    const audibleBeats = allBeats.filter(beat => beat.notes.length > 0);
    const sourceBeats = audibleBeats.length > 0 ? audibleBeats : allBeats;
    const beats = sourceBeats
      .filter(beat => !range || (beat.absolutePlaybackStart >= range.startTick && beat.absolutePlaybackStart < range.endTick))
      .sort((first, second) => first.absolutePlaybackStart - second.absolutePlaybackStart)
      .filter((beat, index, list) => index === 0 || beat.absolutePlaybackStart !== list[index - 1].absolutePlaybackStart);
    if (beats.length === 0) return;
    let currentIndex = 0;
    beats.forEach((beat, index) => {
      if (beat.absolutePlaybackStart <= api.tickPosition) currentIndex = index;
    });
    const targetIndex = Math.min(beats.length - 1, Math.max(0, currentIndex + direction));
    const targetBeat = beats[targetIndex];
    handleSeekTick(targetBeat.absolutePlaybackStart);
    if (isNotePreviewMode) api.playBeat(targetBeat);
  }, [activeTrackIndex, apiRef, handleSeekTick, isNotePreviewMode, tracks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === '?' && showKeyboardShortcuts) {
        e.preventDefault();
        setShowKeyboardShortcuts(false);
        return;
      }
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;

      if (e.key === '?') {
        if (window.innerWidth < 640) return;
        e.preventDefault();
        setShowKeyboardShortcuts(current => !current);
        return;
      }

      if (mainViewMode === 'cifra') {
        if (e.code === 'Space') {
          e.preventDefault();
          setIsAutoScrolling(current => !current);
        }
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;

        case 'KeyM':
          e.preventDefault();
          if (mainViewMode === 'pro') handleTrackMuteToggle(activeTrackIndex);
          break;

        case 'KeyS':
          e.preventDefault();
          if (mainViewMode === 'pro') {
            const newSolo = !trackSolos[activeTrackIndex];
            setTrackSolos(prev => ({ ...prev, [activeTrackIndex]: newSolo }));
            if (apiRef.current && tracks[activeTrackIndex]) {
              apiRef.current.changeTrackSolo([tracks[activeTrackIndex]], newSolo);
            }
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) seekToAdjacentBar(-1);
          else seekToAdjacentBeat(-1);
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) seekToAdjacentBar(1);
          else seekToAdjacentBeat(1);
          break;

        case 'KeyR':
          e.preventDefault();
          toggleLoop();
          break;

        case 'KeyC':
          e.preventDefault();
          cycleCountIn();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [apiRef, mainViewMode, activeTrackIndex, trackMutes, trackSolos, tracks, handleTrackMuteToggle, setTrackSolos, togglePlay, seekToAdjacentBar, seekToAdjacentBeat, toggleLoop, cycleCountIn, showKeyboardShortcuts]);

  const handleTrackSoloToggle = (index: number) => {
    const newSolo = !trackSolos[index];
    setTrackSolos(prev => ({ ...prev, [index]: newSolo }));
    if (apiRef.current && tracks[index]) {
      apiRef.current.changeTrackSolo([tracks[index]], newSolo);
    }
  };



  const toggleLayoutMode = () => {
    const newState = !isHorizontalMode;
    setIsHorizontalMode(newState);
    setIsLoading(true);
    setLoadingMsg(newState ? 'Cambiando a modo cinta...' : 'Cambiando a modo página...');

    setTimeout(() => {
      if (apiRef.current) {
        apiRef.current.settings.display.layoutMode = newState ? alphaTab.LayoutMode.Horizontal : alphaTab.LayoutMode.Page;
        apiRef.current.updateSettings();
        apiRef.current.render();
      }
    }, 50);
  };

  const handleResetMixer = () => {
    const newMutes: Record<number, boolean> = {};
    const newSolos: Record<number, boolean> = {};
    const newVols: Record<number, number> = {};

    tracks.forEach((track, i) => {
      newMutes[i] = false;
      newSolos[i] = false;
      const defaultVol = track.playbackInfo?.volume ?? 16;
      newVols[i] = defaultVol;

      if (apiRef.current) {
        apiRef.current.changeTrackMute([track], false);
        apiRef.current.changeTrackSolo([track], false);
        apiRef.current.changeTrackVolume([track], defaultVol / 16);
      }
    });

    setTrackMutes(newMutes);
    setTrackSolos(newSolos);
    setTrackVolumes(newVols);
  };

  return (
    <div className="tab-player-shell relative flex h-full w-full flex-col px-2 py-2 sm:p-4 lg:p-6" onMouseMove={handleMouseMove}>
      {!song && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-slate-500 bg-slate-950 border-2 border-dashed border-slate-800 rounded-3xl">
          <Guitar size={80} className="mb-6 opacity-20" />
          <h2 className="text-2xl font-bold text-slate-400 mb-2">Tu estudio está listo</h2>
          <p className="text-center">Selecciona una canción de tu biblioteca a la izquierda <br />o añade nuevos archivos para comenzar.</p>
        </div>
      )}

      {song && !errorMsg && (
        <Navbar
          title={songTitle}
          subtitle={[songArtist, songAlbum].filter(Boolean).join(' • ') || "Reproductor"}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={onToggleSidebar}
          onBack={onBack}
        >
          {song.type !== 'text' && (
            <div className="hidden bg-zinc-950/50 p-1 rounded-xl border border-white/5 shadow-inner sm:flex">
              <button
                onClick={() => setMainViewMode('pro')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg font-bold transition-all text-xs sm:text-sm ${mainViewMode === 'pro'
                  ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                Pro
              </button>
              <button
                onClick={() => setMainViewMode('cifra')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg font-bold transition-all text-xs sm:text-sm ${mainViewMode === 'cifra'
                  ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                  : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                Cifra
              </button>
            </div>
          )}

          {/* Menú para móviles (Agrupado) */}
          <div className="relative sm:hidden ml-1" ref={mobileMoreMenuRef}>
            <button 
              type="button"
              onClick={() => setIsMobileMoreMenuOpen(!isMobileMoreMenuOpen)}
              aria-label="Mostrar opciones de la tablatura"
              aria-expanded={isMobileMoreMenuOpen}
              aria-controls="tab-player-actions-menu"
              className="p-2 bg-zinc-800/50 text-zinc-300 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors border border-white/5"
            >
              <MoreVertical size={20} />
            </button>
            <AnimatePresence>
              {isMobileMoreMenuOpen && (
                <motion.div
                  id="tab-player-actions-menu"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-zinc-900 border border-white/10 rounded-xl p-2 flex flex-col gap-1 shadow-2xl z-[100] origin-top-right"
                >
                  <button
                    onClick={() => { toggleImmersiveMode(); setIsMobileMoreMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left p-2.5 hover:bg-zinc-800 rounded-lg text-zinc-300 font-bold text-sm transition-colors"
                  >
                    <Maximize size={18} className="text-primary-500" /> Pantalla Completa
                  </button>
                  <button
                    onClick={() => { setShowPracticeControls(!showPracticeControls); setIsMobileMoreMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left p-2.5 hover:bg-zinc-800 rounded-lg text-zinc-300 font-bold text-sm transition-colors"
                  >
                    <Settings2 size={18} className="text-primary-500" /> Herr. Práctica
                  </button>
                  <div className="h-px w-full bg-white/10 my-1"></div>
                  <button 
                    onClick={() => { handleDeleteSong(); setIsMobileMoreMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left p-2.5 hover:bg-red-500/20 rounded-lg text-red-400 font-bold text-sm transition-colors"
                  >
                    <Trash2 size={18} /> Eliminar Canción
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Botones para Desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setShowKeyboardShortcuts(true)}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-zinc-950/50 px-3 py-2 text-sm font-bold text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-200"
              title="Atajos de teclado (?)"
            >
              <Keyboard size={19} />
              <span className="hidden lg:inline">Atajos</span>
            </button>
            <button
              onClick={toggleImmersiveMode}
              className="p-2 rounded-xl bg-zinc-950/50 text-zinc-400 border border-white/5 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
              title="Pantalla Completa"
            >
              <Maximize size={20} />
            </button>

            <button
              onClick={() => setShowPracticeControls(!showPracticeControls)}
              className={`p-2 rounded-xl border transition-all ${showPracticeControls
                ? 'bg-primary-500 text-zinc-950 border-primary-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'bg-zinc-950/50 text-zinc-400 border-white/5 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              title="Herramientas de Práctica"
            >
              <Settings2 size={20} />
            </button>
            
            <button
              onClick={handleDeleteSong}
              className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-xl border border-red-500/20 hover:border-red-500/40 transition-all shadow-sm ml-1"
              title="Eliminar Canción"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </Navbar>
      )}

      {song && !errorMsg && song.type !== 'text' && (
        <div className="tab-view-switch mx-auto my-2 flex shrink-0 rounded-xl border border-white/5 bg-zinc-900/80 p-1 shadow-inner sm:hidden">
          <button onClick={() => setMainViewMode('pro')} className={`min-h-10 rounded-lg px-5 text-xs font-bold transition-all ${mainViewMode === 'pro' ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_var(--theme-glow)]' : 'text-zinc-400'}`}>Tab</button>
          <button onClick={() => setMainViewMode('cifra')} className={`min-h-10 rounded-lg px-5 text-xs font-bold transition-all ${mainViewMode === 'cifra' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'text-zinc-400'}`}>Cifra</button>
        </div>
      )}

      {/* Banner para canciones temporales del catálogo */}
      {song?.isTemporary && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-0 mb-2 flex shrink-0 flex-col items-stretch justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4"
        >
          <div className="flex items-start gap-2 text-xs font-medium text-amber-400 sm:items-center sm:text-sm">
            <span className="text-base">👁️</span>
            <span>Estás viendo una <strong>vista previa temporal</strong>. No está guardada en tu biblioteca.</span>
          </div>
          <button
            onClick={handleSaveToLibrary}
            className="flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-zinc-900 transition-colors hover:bg-amber-400"
          >
            <Download size={14} />
            Guardar en mi Biblioteca
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {!errorMsg && showPracticeControls && (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar herramientas de práctica"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPracticeControls(false)}
              className={`fixed inset-0 z-[60] cursor-default bg-black/45 ${isImmersiveMode ? '' : 'sm:hidden'}`}
            />
            <motion.div
              role="dialog"
              aria-label="Herramientas de práctica"
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className={`practice-controls-panel z-[70] rounded-2xl ${isImmersiveMode
                ? 'fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto border border-white/10 bg-zinc-950 p-1 shadow-2xl'
                : 'fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto border border-white/10 bg-zinc-950 p-1 shadow-2xl sm:relative sm:inset-auto sm:z-40 sm:max-h-none sm:overflow-visible sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none'
              }`}
            >
              <button type="button" onClick={() => setShowPracticeControls(false)} className={`sticky top-1 z-10 ml-auto min-h-11 min-w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-200 shadow-lg ${isImmersiveMode ? 'flex' : 'flex sm:hidden'}`} aria-label="Cerrar herramientas de práctica"><X size={20} /></button>
              <PracticeControls
              isLoading={isLoading}
              originalBpm={originalTempo}
              targetBpm={targetBpm}
              handleBpmChange={handleBpmChange}
              showTabControls={mainViewMode === 'pro' && tracks.length > 0}
              transposition={transposition}
              handleTranspositionChange={handleTranspositionChange}
              isMetronomeActive={isMetronomeActive}
              toggleMetronome={toggleMetronome}
              isMetronomePreviewing={isMetronomePreviewing}
              toggleMetronomePreview={() => setIsMetronomePreviewing(current => !current)}
              metronomeSound={metronomeSound}
              setMetronomeSound={setMetronomeSound}
              metronomeVolume={metronomeVolume}
              setMetronomeVolume={setMetronomeVolume}
              countInBars={countInBars}
              cycleCountIn={cycleCountIn}
              isLooping={isLooping}
              toggleLoop={toggleLoop}
              isHorizontalMode={isHorizontalMode}
              toggleLayoutMode={toggleLayoutMode}
              >
              {mainViewMode === 'pro' && tracks.length > 0 && (
                <AdvancedPracticePanel
                  apiRef={apiRef}
                  song={song}
                  tracks={tracks}
                  playbackRange={playbackRange}
                  originalBpm={originalTempo}
                  targetBpm={targetBpm}
                  handleBpmChange={handleBpmChange}
                  isNotePreviewMode={isNotePreviewMode}
                  setIsNotePreviewMode={setIsNotePreviewMode}
                  onPracticeLoopsChange={setPracticeLoops}
                  onSeekTick={handleSeekTick}
                  onTrainerStatusChange={setTrainerStatus}
                  trainerReplayRequest={trainerReplayRequest}
                />
              )}
              </PracticeControls>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className={`relative w-full flex-1 min-h-0 ${errorMsg ? 'hidden' : ''}`}>

        <AnimatePresence>
          {countInBeat !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/45 backdrop-blur-[2px]"
              aria-live="assertive"
            >
              <motion.div
                key={countInBeat}
                initial={{ scale: 1.25, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-4 border-primary-400 bg-zinc-950/95 text-primary-300 shadow-[0_0_60px_var(--theme-glow-strong)]"
              >
                <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
                  Compás {Math.ceil(countInBeat / countInBeatsPerBar)} de {countInBars}
                </span>
                <span className="text-7xl font-black leading-none">{((countInBeat - 1) % countInBeatsPerBar) + 1}</span>
                <span className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Prepárate</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {song.type !== 'text' && (
          <div className={`transition-all duration-500 ease-in-out h-full flex flex-col ${mainViewMode === 'cifra' ? 'absolute inset-0 opacity-0 -translate-x-10 pointer-events-none' : 'relative opacity-100 translate-x-0'}`}>
            <div className="bg-slate-50 rounded-2xl overflow-hidden shadow-2xl relative border border-slate-700 flex-1 flex flex-col min-h-0">
              {isLoading && tracks.length > 0 && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white transition-all">
                  <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
                  <p className="font-bold text-lg animate-pulse">{loadingMsg}</p>
                </div>
              )}
              <div ref={containerRef} className={`relative h-full w-full flex-1 overflow-x-auto overflow-y-auto p-1 sm:p-4 ${isLooping ? 'select-none' : ''} ${!isHorizontalMode ? 'hide-scrollbar' : 'custom-scrollbar'}`}></div>
            </div>

          </div>
        )}

        <AnimatePresence>
          {mainViewMode === 'cifra' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              ref={scrollRef}
              className="absolute inset-0 w-full h-full overflow-y-auto pb-[30vh] bg-zinc-950"
            >
              <ChordsView
                track={song.type === 'text' ? null : (tracks[activeTrackIndex] || null)}
                songTitle={songTitle}
                song={song}
                onEditChange={setIsChordsEditing}
                originalBpm={originalTempo}
                targetBpm={targetBpm}
                onBpmChange={handleBpmChange}
                isMetronomeActive={isMetronomeActive}
                onToggleMetronome={toggleMetronome}
                includeChordDiagramsInPrint={includeChordDiagramsInPrint}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {mainViewMode === 'cifra' && hasCifraContent && !isChordsEditing && (
          <motion.div
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            className="absolute bottom-4 sm:bottom-8 left-1/2 flex items-center gap-2 sm:gap-4 bg-zinc-900/90 backdrop-blur-md border border-white/10 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl shadow-2xl z-50 print-hide scale-90 sm:scale-100 origin-bottom"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                className={`p-3 rounded-xl transition-all ${isAutoScrolling
                  ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700'
                  }`}
              >
                {isAutoScrolling ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
              </button>

              <div className="flex items-center gap-2 bg-zinc-950/50 rounded-xl p-1 border border-white/5">
                <button
                  onClick={() => setAutoScrollSpeed(Math.max(1, autoScrollSpeed - 1))}
                  className="p-2 text-zinc-400 hover:text-primary-500 hover:bg-white/5 rounded-lg transition-colors"
                  disabled={autoScrollSpeed <= 1}
                >
                  <Minus size={16} />
                </button>
                <div className="flex flex-col items-center justify-center min-w-[2.5rem]">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none mb-1">Vel</span>
                  <span className="font-mono font-bold text-primary-500 leading-none text-lg">{autoScrollSpeed}</span>
                </div>
                <button
                  onClick={() => setAutoScrollSpeed(Math.min(10, autoScrollSpeed + 1))}
                  className="p-2 text-zinc-400 hover:text-primary-500 hover:bg-white/5 rounded-lg transition-colors"
                  disabled={autoScrollSpeed >= 10}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="w-px h-8 bg-white/10 hidden sm:block"></div>

            <button
              onClick={async () => {
                const result = await MySwal.fire({
                  icon: 'question',
                  title: 'Preparar impresión',
                  text: 'Se imprimirá una hoja limpia con los metadatos y la cifra completa.',
                  input: 'checkbox',
                  inputValue: includeChordDiagramsInPrint ? 1 : 0,
                  inputPlaceholder: 'Incluir resumen con diagramas de acordes',
                  showCancelButton: true,
                  confirmButtonText: 'Imprimir / Guardar PDF',
                  cancelButtonText: 'Cancelar'
                });
                if (!result.isConfirmed) return;
                setIncludeChordDiagramsInPrint(Boolean(result.value));
                window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
              }}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-colors border border-white/5"
              title="Imprimir o Guardar como PDF"
            >
              <Printer size={18} />
              <span className="text-sm font-bold">Imprimir / PDF</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {song.type !== 'text' && mainViewMode === 'pro' && showToolbar && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-2 left-0 right-0 px-2 sm:bottom-6 sm:px-6 w-full max-w-7xl mx-auto flex justify-center z-50 pointer-events-none"
          >
            <div className="w-full max-w-6xl pointer-events-auto">
              <PlayerToolbar
                isLoading={isLoading}
                errorMsg={errorMsg}
                loadingMsg={loadingMsg}
                tracks={tracks}
                isPlaying={isPlaying}
                activeTrackIndex={activeTrackIndex}
                tuning={tuning}
                togglePlay={togglePlay}
                changeTrack={(index) => changeTrack(tracks[index], index)}
                isMixerOpen={isMixerOpen}
                toggleMixer={toggleMixer}
                masterVolume={masterVolume}
                handleVolumeChange={handleVolumeChange}
                currentTime={playerPosition.currentTime}
                endTime={playerPosition.endTime}
                currentTick={playerPosition.currentTick}
                endTick={playerPosition.endTick}
                currentBar={currentBarIndex + 1}
                totalBars={masterBars.length}
                barMarkers={barMarkers}
                loopMarkers={practiceLoops}
                onSeekTick={handleSeekTick}
                onLoopSelect={handleLoopSelect}
                trainerStatus={trainerStatus}
                onTrainerReplay={() => setTrainerReplayRequest(current => current + 1)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {song.type !== 'text' && mainViewMode === 'pro' && !showToolbar && (
          <motion.button
            type="button"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={() => handleMouseMove()}
            aria-label="Mostrar controles de reproducción"
            className="absolute bottom-3 left-1/2 z-50 flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-zinc-950/90 px-4 text-xs font-bold text-zinc-200 shadow-2xl backdrop-blur-xl sm:hidden"
          >
            <ChevronUp size={17} />
            Controles
          </motion.button>
        )}
      </AnimatePresence>

      <TrackMixer
        isOpen={isMixerOpen}
        onClose={() => setIsMixerOpen(false)}
        tracks={tracks}
        trackVolumes={trackVolumes}
        trackMutes={trackMutes}
        trackSolos={trackSolos}
        onVolumeChange={handleTrackVolumeChange}
        onMuteToggle={handleTrackMuteToggle}
        onSoloToggle={handleTrackSoloToggle}
        onResetMixer={handleResetMixer}
      />
      <KeyboardShortcutsModal isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} />
    </div>
  );
};
