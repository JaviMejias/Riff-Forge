import { useEffect, useRef, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { motion, AnimatePresence } from 'framer-motion';
import { Guitar, Loader2, Settings2, Play, Pause, Plus, Minus, Printer, Trash2, MoreVertical, Maximize } from 'lucide-react';
import { PlayerToolbar } from './PlayerToolbar';
import { PracticeControls } from './PracticeControls';
import { TrackMixer } from './TrackMixer';
import { ChordsView } from './ChordsView';
import { Navbar } from './Navbar';
import { db, type Song } from '../db';
import { usePlayerStore } from '../store/playerStore';
import { useAudioStore } from '../store/audioStore';
import { useAlphaTab } from '../hooks/useAlphaTab';
import { useUiStore } from '../store/uiStore';
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
  const { toggleImmersiveMode } = useUiStore();
  const {
    mainViewMode, setMainViewMode,
    masterVolume, setMasterVolume,
    playbackSpeed, setPlaybackSpeed,
    isMetronomeActive, setIsMetronomeActive,
    isLooping, setIsLooping
  } = usePlayerStore();

  const {
    containerRef,
    apiRef,
    isPlaying,
    tracks,
    activeTrackIndex,
    transposition,
    setTransposition,
    tuning,
    songTitle,
    songArtist,
    songAlbum,
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

  useEffect(() => {
    useAudioStore.getState().setGlobalIsPlaying(isPlaying);
    return () => useAudioStore.getState().setGlobalIsPlaying(false);
  }, [isPlaying]);

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

  // AUTO-HIDE TOOLBAR LOGIC
  const [showToolbar, setShowToolbar] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = () => {
    setShowToolbar(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      if (apiRef.current && apiRef.current.playerState === alphaTab.synth.PlayerState.Playing) {
        setShowToolbar(false);
      }
    }, 2500);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleMouseMove);
    handleMouseMove(); // Initial trigger

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!apiRef.current) return;
        if (apiRef.current.playerState === alphaTab.synth.PlayerState.Playing) {
          apiRef.current.pause();
        } else {
          apiRef.current.play();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const [isHorizontalMode, setIsHorizontalMode] = useState<boolean>(false);
  const [isCountInActive, setIsCountInActive] = useState<boolean>(false);

  const handleTranspositionChange = (delta: number) => {
    const newTransposition = transposition + delta;
    setTransposition(newTransposition);
    if (apiRef.current && tracks.length > 0) {
      apiRef.current.changeTrackTranspositionPitch([tracks[activeTrackIndex]], newTransposition);
    }
    window.removeEventListener('mousemove', handleMouseMove);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isPlaying]);

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

  const togglePlay = () => {
    if (!apiRef.current) return;
    if (apiRef.current.playerState === alphaTab.synth.PlayerState.Playing) {
      apiRef.current.pause();
    } else {
      apiRef.current.play();
    }
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const speed = parseFloat(e.target.value);
    setPlaybackSpeed(speed);
    if (apiRef.current) apiRef.current.playbackSpeed = speed;
  };
  const toggleMetronome = () => {
    const newState = !isMetronomeActive;
    setIsMetronomeActive(newState);
    if (apiRef.current) apiRef.current.metronomeVolume = newState ? 1 : 0;
  };
  const toggleCountIn = () => {
    const newState = !isCountInActive;
    setIsCountInActive(newState);
    if (apiRef.current) apiRef.current.countInVolume = newState ? 1 : 0;
  };
  const toggleLoop = () => {
    const newState = !isLooping;
    setIsLooping(newState);
    if (apiRef.current) apiRef.current.isLooping = newState;
  };
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setMasterVolume(vol);
    if (apiRef.current) apiRef.current.masterVolume = vol;
  };

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

  const handleTrackMuteToggle = (index: number) => {
    const newMute = !trackMutes[index];
    setTrackMutes(prev => ({ ...prev, [index]: newMute }));
    if (apiRef.current && tracks[index]) {
      apiRef.current.changeTrackMute([tracks[index]], newMute);
    }
  };

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
    <div className="flex flex-col h-full w-full relative p-8" onMouseMove={handleMouseMove}>
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
            <div className="flex bg-zinc-950/50 p-1 rounded-xl border border-white/5 shadow-inner">
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
              onClick={() => setIsMobileMoreMenuOpen(!isMobileMoreMenuOpen)}
              className="p-2 bg-zinc-800/50 text-zinc-300 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors border border-white/5"
            >
              <MoreVertical size={20} />
            </button>
            <AnimatePresence>
              {isMobileMoreMenuOpen && (
                <motion.div 
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
                  {song.type !== 'text' && mainViewMode === 'pro' && (
                    <button 
                      onClick={() => { setShowPracticeControls(!showPracticeControls); setIsMobileMoreMenuOpen(false); }}
                      className="flex items-center gap-2 w-full text-left p-2.5 hover:bg-zinc-800 rounded-lg text-zinc-300 font-bold text-sm transition-colors"
                    >
                      <Settings2 size={18} className="text-primary-500" /> Herr. Práctica
                    </button>
                  )}
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
              onClick={toggleImmersiveMode}
              className="p-2 rounded-xl bg-zinc-950/50 text-zinc-400 border border-white/5 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
              title="Pantalla Completa"
            >
              <Maximize size={20} />
            </button>

            {song.type !== 'text' && mainViewMode === 'pro' && (
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
            )}
            
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

      <AnimatePresence>
        {tracks.length > 0 && !errorMsg && showPracticeControls && mainViewMode === 'pro' && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="shrink-0 relative z-40"
          >
            <PracticeControls
              isLoading={isLoading}
              playbackSpeed={playbackSpeed}
              handleSpeedChange={handleSpeedChange}
              transposition={transposition}
              handleTranspositionChange={handleTranspositionChange}
              isMetronomeActive={isMetronomeActive}
              toggleMetronome={toggleMetronome}
              isCountInActive={isCountInActive}
              toggleCountIn={toggleCountIn}
              isLooping={isLooping}
              toggleLoop={toggleLoop}
              isHorizontalMode={isHorizontalMode}
              toggleLayoutMode={toggleLayoutMode}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`relative w-full flex-1 min-h-0 ${errorMsg ? 'hidden' : ''}`}>

        {song.type !== 'text' && (
          <div className={`transition-all duration-500 ease-in-out h-full flex flex-col ${mainViewMode === 'cifra' ? 'absolute inset-0 opacity-0 -translate-x-10 pointer-events-none' : 'relative opacity-100 translate-x-0'}`}>
            <div className="bg-slate-50 rounded-2xl overflow-hidden shadow-2xl relative border border-slate-700 flex-1 flex flex-col min-h-0">
              {isLoading && tracks.length > 0 && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white transition-all">
                  <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
                  <p className="font-bold text-lg animate-pulse">{loadingMsg}</p>
                </div>
              )}
              <div ref={containerRef} className={`overflow-y-auto overflow-x-auto p-4 relative w-full h-full flex-1 ${!isHorizontalMode ? 'hide-scrollbar' : 'custom-scrollbar'}`}></div>
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {mainViewMode === 'cifra' && !isChordsEditing && (
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
              onClick={() => window.print()}
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
            className="absolute bottom-6 left-0 right-0 px-6 w-full max-w-7xl mx-auto flex justify-center z-50 pointer-events-none"
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
              />
            </div>
          </motion.div>
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
    </div>
  );
};
