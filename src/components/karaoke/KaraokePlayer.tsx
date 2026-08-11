import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Edit3, AlignLeft, MonitorPlay, Music, MoreVertical, Download, X, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { Navbar } from '../Navbar';
import { LocalAudioPlayer } from './player/LocalAudioPlayer';
import type { LocalAudioPlayerRef } from './player/LocalAudioPlayer';
import { KaraokeLyricsView } from './view/KaraokeLyricsView';
import type { AnimationMode } from './view/KaraokeLyricsView';
import { ViewModeSelector } from './view/ViewModeSelector';
import { KaraokeLyricsEditor } from './editor/KaraokeLyricsEditor';
import { db } from '../../db';
import type { Karaoke } from '../../db';
import YouTube, { type YouTubePlayer } from 'react-youtube';
import { downloadKaraokeMp3 } from '../../utils/download';
import Swal from 'sweetalert2';
import { useAudioStore } from '../../store/audioStore';
import { parseLrc } from '../../utils/lrcParser';
import { PlayerControls } from './player/PlayerControls';
import { useCoverArt } from '../../hooks/useCoverArt';
import { usePlayerStore } from '../../store/playerStore';
import { KaraokeAudioUploadButton } from './KaraokeAudioUploadButton';

interface KaraokePlayerProps {
  karaoke: Karaoke;
  onBack: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

type LegacyKaraoke = Karaoke & {
  localFile?: BlobPart;
};

type AudioContextConstructor = typeof AudioContext;

export const KaraokePlayer = ({ karaoke, onBack, isSidebarOpen, onToggleSidebar }: KaraokePlayerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [textContent, setTextContent] = useState(karaoke.textContent || '');
  const [showLyrics, setShowLyrics] = useState(!!textContent);
  const [pitch, setPitchState] = useState(karaoke.pitchShift || 0);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Countdown state
  const [isCountInEnabled, setIsCountInEnabled] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cover Art
  const { coverUrl } = useCoverArt(karaoke.artist, karaoke.name);
  
  const { isKaraokeMiniPlayer, setIsKaraokeMiniPlayer, setActiveKaraokeId } = usePlayerStore();

  const setPitch = async (newPitch: number) => {
    setPitchState(newPitch);
    
    // Update local db
    if (karaoke.id) {
      await db.karaokes.update(karaoke.id, { pitchShift: newPitch });
    }
  };

  // Estados de audio unificados para las letras
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [globalIsPlaying, setGlobalIsPlaying] = useState(false);
  const [animationMode, setAnimationMode] = useState<AnimationMode>('scroll');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pendingSeekRef = useRef<number | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const localPlayerRef = useRef<LocalAudioPlayerRef>(null);

  const hasSyncedLines = useMemo(() => {
    if (!karaoke.textContent) return false;
    return parseLrc(karaoke.textContent).some(l => l.time > 0);
  }, [karaoke.textContent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  // FE-9 fix: clear countdown interval when the component unmounts
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    useAudioStore.getState().setGlobalIsPlaying(globalIsPlaying);
    return () => useAudioStore.getState().setGlobalIsPlaying(false);
  }, [globalIsPlaying]);

  // Extract YouTube ID if it's a YT URL
  const getYoutubeVideoId = (url: string) => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v') || '';
      } else if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.slice(1);
      }
    } catch {
      return null;
    }
    return null;
  };

  const ytVideoId = karaoke.youtubeUrl ? getYoutubeVideoId(karaoke.youtubeUrl) : null;
  const hasLocalAudio = !!karaoke.hasLocalAudio || !!(karaoke as LegacyKaraoke).localFile;

  const [activeSource, setActiveSource] = useState<'youtube' | 'local'>(
    ytVideoId ? 'youtube' : 'local'
  );

  const handleSourceChange = (newSource: 'youtube' | 'local') => {
    if (newSource === activeSource) return;
    
    // Guardamos el tiempo actual para retomarlo
    const timeToSeek = localCurrentTime;
    
    // Detener reproducción y resetear contadores al cambiar
    if (globalIsPlaying) {
      try {
        if (ytPlayer && activeSource === 'youtube') ytPlayer.pauseVideo();
        if (localPlayerRef.current && activeSource === 'local') localPlayerRef.current.pause();
      } catch (e) {
        console.warn('Error pausing during source change:', e);
      }
      setGlobalIsPlaying(false);
    }
    
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    pendingSeekRef.current = timeToSeek;
    setActiveSource(newSource);
  };

  const [ytPlayer, setYtPlayer] = useState<YouTubePlayer | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [globalDuration, setGlobalDuration] = useState(0);

  // Aplicar el seek pendiente cuando el reproductor esté listo (solo para YouTube)
  useEffect(() => {
    if (pendingSeekRef.current === null) return;
    const time = pendingSeekRef.current;

    if (activeSource === 'youtube' && ytPlayer) {
      try {
        ytPlayer.playVideo();
        ytPlayer.seekTo(time, true);
        setTimeout(() => ytPlayer.pauseVideo(), 150);
        pendingSeekRef.current = null;
      } catch(e) { console.warn('Error pending seek YT', e); }
    }
  }, [activeSource, ytPlayer]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (activeSource === 'youtube' && ytPlayer) {
      interval = setInterval(() => {
        const time = ytPlayer.getCurrentTime();
        const playing = ytPlayer.getPlayerState() === 1;
        setLocalCurrentTime(prev => Math.abs(prev - time) > 0.05 ? time : prev);
        setGlobalIsPlaying(playing);
        if (ytPlayer.getDuration && ytPlayer.getDuration() > 0) {
          setGlobalDuration(ytPlayer.getDuration());
        }

        // M-2 fix: Continuous sync check to prevent YouTube and Local Audio drift
        if (hasLocalAudio && playing && localPlayerRef.current) {
          try {
            const localTime = localPlayerRef.current.getCurrentTime();
            // If drift is more than 0.25s, force local player to catch up
            if (Math.abs(localTime - time) > 0.25) {
              localPlayerRef.current.seek(time);
            }
          } catch (error) {
            console.warn('Error synchronizing local audio:', error);
          }
        }
      }, 100); // M-1 fix: 10fps is plenty for lyric sync and saves React re-renders
    }
    return () => clearInterval(interval);
  }, [activeSource, ytPlayer, hasLocalAudio]);

  // Audio Control Methods for Sync Editor
  const handleAbstractPlay = () => {
    try {
      if (activeSource === 'youtube' && ytPlayer) ytPlayer.playVideo();
      else if (activeSource === 'local' && localPlayerRef.current) localPlayerRef.current.play();
    } catch (e) { console.warn(e); }
  };

  const handleAbstractPause = () => {
    try {
      if (activeSource === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
      else if (activeSource === 'local' && localPlayerRef.current) localPlayerRef.current.pause();
    } catch (e) { console.warn(e); }
  };

  const playCountInTick = () => {
    try {
      const audioWindow = window as typeof window & {
        webkitAudioContext?: AudioContextConstructor;
      };
      const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Sonido de baqueta (drumstick click)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
      // FE-3 fix: close AudioContext after oscillator stops to prevent resource leak
      osc.onended = () => ctx.close();
    } catch (e) {
      console.warn('AudioContext error:', e);
    }
  };

  const handlePlayPause = () => {
    if (globalIsPlaying) {
      if (activeSource === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
      if (activeSource === 'local' && localPlayerRef.current) localPlayerRef.current.pause();
      setGlobalIsPlaying(false);
      
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
    } else {
      if (isCountInEnabled && countdown === null) {
        setCountdown(3);
        playCountInTick();
        let count = 3;
        countdownTimerRef.current = setInterval(() => {
          count -= 1;
          if (count > 0) {
            setCountdown(count);
            playCountInTick();
          } else {
            clearInterval(countdownTimerRef.current!);
            countdownTimerRef.current = null;
            setCountdown(null);
            
            if (activeSource === 'youtube' && ytPlayer) ytPlayer.playVideo();
            if (activeSource === 'local' && localPlayerRef.current) localPlayerRef.current.play();
            setGlobalIsPlaying(true);
          }
        }, 1000);
      } else if (countdown === null) {
        if (activeSource === 'youtube' && ytPlayer) ytPlayer.playVideo();
        if (activeSource === 'local' && localPlayerRef.current) localPlayerRef.current.play();
        setGlobalIsPlaying(true);
      }
    }
  };

  const handleAbstractSeek = (time: number) => {
    try {
      if (activeSource === 'youtube' && ytPlayer) ytPlayer.seekTo(time, true);
      else if (activeSource === 'local' && localPlayerRef.current) localPlayerRef.current.seek(time);
    } catch (e) { console.warn(e); }
  };

  // Handle Play/Pause uniformly
  const togglePlayPause = () => {
    handlePlayPause();
  };

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      fullscreenRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // === KEYBOARD SHORTCUTS ===
  const keyboardHandlersRef = useRef({ togglePlayPause, handleAbstractSeek, localCurrentTime });
  useEffect(() => {
    keyboardHandlersRef.current = { togglePlayPause, handleAbstractSeek, localCurrentTime };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const { togglePlayPause: playPause, handleAbstractSeek: seek, localCurrentTime: time } = keyboardHandlersRef.current;

      switch (e.code) {
        case 'Space':
        case 'Enter':
          e.preventDefault();
          playPause();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, time - 5)); // Retroceder 5 segundos
          break;

        case 'ArrowRight':
          e.preventDefault();
          seek(time + 5); // Avanzar 5 segundos
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    setIsMuted(vol === 0);
    try {
      if (ytPlayer && activeSource === 'youtube') {
        if (hasLocalAudio) {
          ytPlayer.mute();
        } else {
          ytPlayer.setVolume(vol * 100);
          if (vol === 0) ytPlayer.mute();
          else ytPlayer.unMute();
        }
      }
    } catch (e) { console.warn(e); }
    
    if (localPlayerRef.current) {
      localPlayerRef.current.setVolume(vol);
    }
  };

  const handleMuteToggle = () => {
    if (isMuted || volume === 0) {
      handleVolumeChange(1); // unMute to max
    } else {
      setVolume(0);
      setIsMuted(true);
      try {
        if (ytPlayer) ytPlayer.mute();
      } catch (e) { console.warn(e); }
      if (localPlayerRef.current) localPlayerRef.current.setVolume(0);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    try {
      if (ytPlayer) ytPlayer.setPlaybackRate(newSpeed);
    } catch (e) { console.warn(e); }
    if (localPlayerRef.current) localPlayerRef.current.setPlaybackRate(newSpeed);
  };

  // Sync state if activeSource changes
  useEffect(() => {
    // Cuando cambiamos de fuente, pausamos la reproducción automáticamente 
    // para evitar que el audio se quede pegado o se desincronice
    try {
      if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
    } catch (e) { console.warn(e); }
    if (localPlayerRef.current) localPlayerRef.current.pause();
    const stateTimer = setTimeout(() => setGlobalIsPlaying(false), 0);
    return () => clearTimeout(stateTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource]);

  // Sync state if karaoke prop changes
  useEffect(() => {
    const stateTimer = setTimeout(() => {
      if (karaoke.textContent && !showLyrics && !isEditing) {
        setShowLyrics(true);
      }
      if (ytVideoId) setActiveSource('youtube');
      else if (hasLocalAudio) setActiveSource('local');
    }, 0);

    return () => clearTimeout(stateTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karaoke.id, ytVideoId, hasLocalAudio]);

  const handleSaveLyrics = async (content: string) => {
    try {
      await db.karaokes.update(karaoke.id!, {
        textContent: content
      });
      setTextContent(content);
      setShowLyrics(!!content.trim());
      
      if (!content.trim()) {
        setIsEditing(false);
      }
      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        icon: 'success',
        title: 'Letra guardada',
        background: '#18181b',
        color: '#f4f4f5',
      });
    } catch (e) {
      console.error(e);
    }
  };


  const ytOpts = useMemo(() => ({
    playerVars: {
      autoplay: 0,
      controls: 0,
      rel: 0,
      disablekb: 0,
      // Note: 'origin' is intentionally omitted — it causes postMessage errors on HTTP deployments.
      // YouTube's iframe API only validates this correctly with HTTPS origins.
      enablejsapi: 1,
    }
  }), []);

  return (
    <>
      <div className={isKaraokeMiniPlayer ? "opacity-0 w-0 h-0 overflow-hidden absolute pointer-events-none" : "karaoke-player-shell flex flex-col absolute inset-0 z-[60] bg-zinc-950 px-3 pt-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:p-8"}>
      
      <Navbar
        title={karaoke.name}
        subtitle={`${karaoke.artist || 'Desconocido'} • Karaoke`}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onBack={onBack}
      >
        <div className="flex gap-2 relative z-[100]" ref={mobileMenuRef}>
          {/* Botón menú hamburguesa (solo móvil) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Mostrar opciones del karaoke"
            aria-expanded={isMobileMenuOpen}
            aria-controls="karaoke-player-actions-menu"
            className="sm:hidden flex items-center justify-center p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all"
          >
            <MoreVertical size={20} />
          </button>

          {/* Contenedor de botones (visible en PC, menú desplegable en móvil) */}
          <div id="karaoke-player-actions-menu" className={`
            absolute top-full right-0 mt-2 p-2 bg-zinc-900 border border-white/10 rounded-2xl shadow-xl flex-col gap-2 min-w-[200px]
            sm:static sm:mt-0 sm:p-0 sm:bg-transparent sm:border-none sm:shadow-none sm:flex sm:flex-row sm:w-auto
            ${isMobileMenuOpen ? 'flex' : 'hidden sm:flex'}
          `}>

            {!isEditing && showLyrics && hasSyncedLines && (
              <div className="w-full sm:w-auto">
                <ViewModeSelector 
                  animationMode={animationMode} 
                  setAnimationMode={setAnimationMode} 
                />
              </div>
            )}

            {!isEditing && (karaoke.hasLocalAudio || karaoke.cloudUrl) && (
              <button
                onClick={() => downloadKaraokeMp3(karaoke)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-primary-500/20 text-zinc-300 hover:text-primary-400 rounded-xl transition-all sm:mr-2 text-sm sm:text-base font-bold whitespace-nowrap w-full sm:w-auto"
                title="Descargar MP3"
              >
                <Download size={16} className="sm:w-5 sm:h-5" /> 
                <span className="sm:hidden">Descargar MP3</span>
              </button>
            )}

            {!isEditing && !karaoke.hasLocalAudio && !karaoke.cloudUrl && (
              <KaraokeAudioUploadButton
                karaoke={karaoke}
                onUploaded={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 sm:gap-2 px-4 py-3 sm:py-2 bg-zinc-800 hover:bg-primary-500/20 text-zinc-300 hover:text-primary-400 rounded-xl transition-all text-sm sm:text-base font-bold whitespace-nowrap w-full sm:w-auto disabled:opacity-50"
              />
            )}

            {!isEditing && (
              <button
                onClick={() => { setShowLyrics(!showLyrics); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 sm:gap-2 px-4 sm:px-4 py-3 sm:py-2 rounded-xl transition-all cursor-pointer font-bold text-sm ${
                  showLyrics 
                    ? 'bg-primary-500/20 text-primary-500 sm:border sm:border-primary-500/30 w-full sm:w-auto' 
                    : 'bg-zinc-800/50 sm:bg-zinc-800 text-zinc-300 hover:bg-zinc-700 w-full sm:w-auto'
                }`}
              >
                <AlignLeft size={18} className="sm:w-4 sm:h-4" /> <span>{showLyrics ? 'Ocultar Letra' : 'Mostrar Letra'}</span>
              </button>
            )}

            {isEditing ? (
              <button
                onClick={() => { setIsEditing(false); setIsMobileMenuOpen(false); }}
                className="flex items-center gap-3 sm:gap-2 bg-zinc-800/50 sm:bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 sm:px-4 py-3 sm:py-2 rounded-xl transition-all cursor-pointer font-bold text-sm w-full sm:w-auto"
              >
                Cerrar Editor
              </button>
            ) : (
              <button
                onClick={() => { 
                  setIsEditing(true); 
                  setShowLyrics(true); 
                  if (hasLocalAudio) handleSourceChange('local');
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-3 sm:gap-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 px-4 sm:px-4 py-3 sm:py-2 rounded-xl transition-all cursor-pointer font-bold text-sm sm:shadow-[0_0_20px_var(--theme-glow)] w-full sm:w-auto"
              >
                <Edit3 size={18} className="sm:w-4 sm:h-4" /> <span>Editar Letra</span>
              </button>
            )}
          </div>
        </div>
      </Navbar>

      <div className="karaoke-player-content flex-1 min-h-0 flex flex-col lg:flex-row gap-2 sm:gap-4 lg:gap-6 mt-2 sm:mt-4 lg:mt-6 overflow-hidden">
        
        {/* LADO IZQUIERDO: REPRODUCTOR */}
        <div className={`karaoke-media-pane relative flex-col transition-all duration-300 flex ${
          showLyrics || isEditing
            ? `${isEditing ? 'h-[210px]' : 'h-[250px]'} sm:h-[320px] lg:w-1/2 shrink-0 lg:h-full`
            : 'w-full h-full'
        }`}>
          {/* Selector de Fuente (superpuesto para ahorrar espacio) */}
          {!isFullscreen && ytVideoId && hasLocalAudio && (
            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex bg-black/60 backdrop-blur-md p-1 rounded-xl z-40 border border-white/10 shadow-xl">
              <button
                onClick={() => handleSourceChange('youtube')}
                disabled={isEditing}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-4 sm:py-2 rounded-lg font-bold text-[10px] sm:text-sm transition-colors z-10 ${
                  activeSource === 'youtube' 
                    ? 'text-zinc-950' 
                    : 'text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                {activeSource === 'youtube' && (
                  <motion.div
                    layoutId="karaokeSourcePill"
                    className="absolute inset-0 bg-primary-500 rounded-lg shadow-md -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <MonitorPlay size={12} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">YouTube</span><span className="sm:hidden">YT</span>
              </button>
              <button
                onClick={() => handleSourceChange('local')}
                disabled={isEditing}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-4 sm:py-2 rounded-lg font-bold text-[10px] sm:text-sm transition-colors z-10 ${
                  activeSource === 'local' 
                    ? 'text-zinc-950' 
                    : 'text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
              >
                {activeSource === 'local' && (
                  <motion.div
                    layoutId="karaokeSourcePill"
                    className="absolute inset-0 bg-primary-500 rounded-lg shadow-md -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <Music size={12} className="sm:w-4 sm:h-4" /> MP3
              </button>
            </div>
          )}

          <div 
            ref={fullscreenRef}
            className={`flex flex-col h-full rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-white/10 relative z-20 transition-all duration-700 ${
              isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-none w-screen h-screen' : 
              ((showLyrics || isEditing)
                ? 'shrink-0 lg:h-auto lg:flex-1' 
                : 'flex-1 min-h-[300px]')
            }`}
          >
            {!ytVideoId && !hasLocalAudio ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 h-full">
                <AlertCircle size={48} className="mb-4 opacity-50" />
                <p className="text-xl font-bold">Fuente no encontrada</p>
                <p className="text-sm">El enlace de YouTube no es válido o el archivo local no existe.</p>
              </div>
            ) : activeSource === 'youtube' && ytVideoId ? (
              <div className="flex-1 w-full flex items-center justify-center bg-black overflow-hidden">
                <div className="w-full aspect-video lg:aspect-auto lg:w-full lg:h-full relative group">
                  <div>
                    <YouTube
                      videoId={ytVideoId}
                      className="absolute inset-0 w-full h-full border-0"
                      iframeClassName="w-full h-full"
                      opts={ytOpts}
                      onReady={(e) => {
                        const player = e.target;
                        setYtPlayer(player);
                        // If we have local audio, keep YouTube muted
                        if (hasLocalAudio) {
                          player.mute();
                        } else {
                          player.unMute();
                          player.setVolume(volume * 100);
                        }
                      }}
                      onPlay={(e) => {
                        if (!hasStarted) setHasStarted(true);
                        try {
                          if (hasLocalAudio && activeSource === 'youtube') {
                            e.target.mute();
                          } else {
                            e.target.setVolume(volume * 100);
                            if (isMuted || volume === 0) e.target.mute();
                            else e.target.unMute();
                          }
                        } catch (error) {
                          console.warn('Error restoring YouTube volume:', error);
                        }
                        if (hasLocalAudio && activeSource === 'youtube') {
                          try {
                            localPlayerRef.current?.seek(e.target.getCurrentTime());
                            localPlayerRef.current?.play();
                          } catch (error) {
                            console.warn('Error starting synchronized local audio:', error);
                          }
                        }
                      }}
                      onPause={() => {
                        if (hasLocalAudio && activeSource === 'youtube') {
                          localPlayerRef.current?.pause();
                        }
                      }}
                      onStateChange={(e) => {
                        // Si el video se búfea (3) o termina (0), paramos el local
                        if (e.data === 3 || e.data === 0) {
                          localPlayerRef.current?.pause();
                        }
                        if (e.data === 0) {
                          setGlobalIsPlaying(false);
                        }
                        
                        // Si terminó de bufferear y empezó a reproducir, sincronizar y reproducir
                        if (e.data === 1 && hasLocalAudio && activeSource === 'youtube') {
                          localPlayerRef.current?.seek(ytPlayer.getCurrentTime());
                          localPlayerRef.current?.play();
                        }
                      }}
                    />
                  </div>
                
                {/* Click-to-Start Overlay to bypass Autoplay Policies */}
                {!hasStarted && ytPlayer && (
                  <div 
                    className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
                    onClick={() => {
                      setHasStarted(true);
                      ytPlayer.playVideo();
                    }}
                  >
                    <div className="bg-primary-500 text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                      <MonitorPlay size={20} />
                      Iniciar Karaoke
                    </div>
                  </div>
                )}
                
                {/* Background LocalAudioPlayer for synced Pitch Shifting during YouTube playback */}
                {hasLocalAudio && (
                  <LocalAudioPlayer 
                    ref={localPlayerRef} 
                    karaoke={karaoke} 
                    hiddenUI={true}
                    pitch={pitch}
                  />
                )}
              </div>
            </div>
            ) : activeSource === 'local' && hasLocalAudio ? (
              <div className="flex-1 w-full flex items-center justify-center bg-zinc-950">
                <div className="w-full aspect-video lg:aspect-auto lg:w-full lg:h-full relative flex flex-col items-center justify-center group overflow-hidden">
                {/* Animación del tocadiscos (Vinilo Realista) */}
                <div className="relative flex flex-col items-center justify-center mb-4">
                  {/* Contenedor principal del vinilo */}
                  <div className="relative w-28 h-28 sm:w-48 sm:h-48 xl:w-64 xl:h-64">
                    
                    {/* El disco que gira */}
                    <div className="absolute inset-0 rounded-full bg-zinc-950 border-[6px] sm:border-8 border-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden animate-spin" 
                         style={{ animationDuration: '4s', animationTimingFunction: 'linear', animationPlayState: globalIsPlaying ? 'running' : 'paused' }}>
                      
                      {/* Surcos del Vinilo */}
                      <div className="absolute inset-[8%] rounded-full border border-zinc-800/30"></div>
                      <div className="absolute inset-[15%] rounded-full border border-zinc-800/40"></div>
                      <div className="absolute inset-[22%] rounded-full border border-zinc-800/30"></div>
                      <div className="absolute inset-[28%] rounded-full border border-zinc-800/50"></div>
                      <div className="absolute inset-[35%] rounded-full border border-zinc-800/30"></div>

                      {/* Etiqueta Central */}
                      <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-zinc-900 border-[3px] border-zinc-900 shadow-[inset_0_0_15px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center overflow-hidden">
                        
                        {/* Imagen de la Carátula (si existe) o Fondo de respaldo */}
                        {coverUrl ? (
                          <img src={coverUrl} alt="Cover Art" className="absolute inset-0 w-full h-full object-cover opacity-90 mix-blend-screen" />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600" />
                        )}

                        {/* Capa oscurecedora para que el texto siga siendo legible si hay carátula */}
                        {coverUrl && <div className="absolute inset-0 bg-black/50" />}

                        {/* Texto Superior (Artista) */}
                        <div className={`absolute top-2 sm:top-3 w-full px-2 text-center flex flex-col z-10 ${coverUrl ? 'text-white drop-shadow-md' : 'text-primary-950'}`}>
                          <span className={`text-[5px] sm:text-[6px] font-bold uppercase tracking-widest leading-none mb-0.5 ${coverUrl ? 'text-white/80' : 'text-primary-950/70'}`}>Artista</span>
                          <span className="text-[6px] sm:text-[9px] font-black uppercase tracking-wider line-clamp-1 truncate leading-none">{karaoke.artist || 'Desconocido'}</span>
                        </div>
                        
                        {/* Agujero Base */}
                        <div className="w-3 h-3 bg-zinc-900 rounded-full z-10 border border-zinc-800/50 shadow-inner"></div>

                        {/* Texto Inferior (Canción) */}
                        <div className={`absolute bottom-2 sm:bottom-3 w-full px-2 text-center flex flex-col z-10 ${coverUrl ? 'text-white drop-shadow-md' : 'text-primary-900'}`}>
                          <span className="text-[7px] sm:text-[10px] font-bold leading-tight line-clamp-1 truncate">{karaoke.name || 'Pista Local'}</span>
                          <span className={`text-[4px] sm:text-[5px] font-bold uppercase tracking-widest mt-0.5 ${coverUrl ? 'text-white/60' : 'text-primary-900/50'}`}>STEREO</span>
                        </div>
                        
                      </div>
                    </div>

                    {/* Reflejos estáticos de luz (no giran) */}
                    <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'conic-gradient(from 180deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.06) 45deg, rgba(255,255,255,0) 90deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,0.06) 225deg, rgba(255,255,255,0) 270deg, rgba(255,255,255,0) 360deg)' }}></div>

                    {/* Eje metálico (no gira) */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-br from-zinc-300 to-zinc-500 rounded-full flex items-center justify-center shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-20">
                      <div className="w-1.5 h-1.5 bg-zinc-950 rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]"></div>
                    </div>
                  </div>
                </div>
                
                <LocalAudioPlayer 
                  ref={localPlayerRef} 
                  karaoke={karaoke} 
                  compactMode={showLyrics || isEditing}
                  pitch={pitch}
                  hiddenUI={true}
                  onTimeUpdate={(t) => {
                    if (activeSource === 'local') setLocalCurrentTime(t);
                  }}
                  onDurationUpdate={(d) => {
                    setGlobalDuration(d);
                    if (pendingSeekRef.current !== null && activeSource === 'local') {
                      const time = pendingSeekRef.current;
                      if (localPlayerRef.current) {
                        try {
                          localPlayerRef.current.play();
                          localPlayerRef.current.seek(time);
                          setTimeout(() => localPlayerRef.current?.pause(), 150);
                          pendingSeekRef.current = null;
                          setGlobalIsPlaying(false);
                        } catch (error) {
                          console.warn('Error applying pending local seek:', error);
                        }
                      }
                    }
                  }}
                  onPlayStateChange={setGlobalIsPlaying}
                />
              </div>
            </div>
            ) : null}

            {/* Unified Controls Overlay/Bottom bar */}
            <PlayerControls
              isPlaying={globalIsPlaying}
              onPlayPause={togglePlayPause}
              currentTime={localCurrentTime}
              duration={globalDuration}
              onSeek={handleAbstractSeek}
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
              speed={speed}
              onSpeedChange={handleSpeedChange}
              pitch={pitch}
              onPitchChange={setPitch}
              isFullscreen={isFullscreen}
              onFullscreenToggle={toggleFullscreen}
              isCountInEnabled={isCountInEnabled}
              onCountInToggle={() => setIsCountInEnabled(!isCountInEnabled)}
            />
            
            {/* Countdown Overlay Overlaying the entire player when active */}
            {countdown !== null && (
              <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <motion.div 
                  key={countdown}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-[120px] sm:text-[200px] font-black text-primary-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.8)]"
                >
                  {countdown}
                </motion.div>
              </div>
            )}
          </div>
        </div>

        {/* LADO DERECHO: LETRA */}
        {showLyrics && (
          <div className="flex-1 min-h-0 w-full lg:w-1/2 lg:h-full bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/5 flex flex-col overflow-hidden shadow-2xl relative">
            
            {/* Brillo decorativo superior */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-primary-500/5 blur-3xl pointer-events-none rounded-full" />
            
            {isEditing ? (
              <KaraokeLyricsEditor 
                karaoke={{...karaoke, textContent}}
                initialContent={textContent}
                currentTime={localCurrentTime}
                duration={globalDuration}
                isPlaying={globalIsPlaying}
                onPlay={handleAbstractPlay}
                onPause={handleAbstractPause}
                onSeek={handleAbstractSeek}
                onSpeedChange={(speed) => {
                  if (activeSource === 'local') {
                    localPlayerRef.current?.setPlaybackRate(speed);
                  } else if (activeSource === 'youtube') {
                    if (ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
                      ytPlayer.setPlaybackRate(speed);
                    }
                  }
                }}
                onSave={handleSaveLyrics}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <KaraokeLyricsView 
                karaoke={{...karaoke, textContent}}
                currentTime={localCurrentTime}
                animationMode={animationMode}
                onEdit={() => {
                  setIsEditing(true);
                  if (hasLocalAudio) setActiveSource('local');
                }}
                onSeek={handleAbstractSeek}
              />
            )}
          </div>
        )}

      </div>
    </div>

      {isKaraokeMiniPlayer && (
        <div className="karaoke-mini-player absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] flex h-[4.5rem] flex-col border-t border-white/10 bg-zinc-950/95 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:h-24 md:bottom-0">
          <input
            type="range"
            min={0}
            max={globalDuration || 100}
            value={Math.min(Math.max(localCurrentTime, 0), globalDuration || 100)}
            onChange={(e) => handleAbstractSeek(parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 hover:[&::-webkit-slider-thumb]:w-3 hover:[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 hover:h-2 transition-all absolute top-0 -translate-y-1/2 z-10"
            style={{
              background: `linear-gradient(to right, var(--primary-500) ${((localCurrentTime / (globalDuration || 1)) * 100) || 0}%, #27272a ${((localCurrentTime / (globalDuration || 1)) * 100) || 0}%)`
            }}
            aria-label="Posición del karaoke"
          />
          <div className="flex flex-1 items-center gap-2 px-2.5 sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={() => setIsKaraokeMiniPlayer(false)}
            className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-800 shadow-inner sm:h-12 sm:w-12"
            aria-label="Expandir karaoke"
          >
            {coverUrl ? <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" /> : <Music className="w-full h-full p-2 text-zinc-500 opacity-50" />}
          </button>
          <button type="button" className="group flex min-w-0 flex-1 flex-col text-left" onClick={() => setIsKaraokeMiniPlayer(false)} aria-label={`Expandir ${karaoke.name}`}>
            <span className="w-full truncate text-sm font-bold text-white transition-colors group-hover:text-primary-400 sm:text-base">{karaoke.name}</span>
            <span className="w-full truncate text-[11px] text-zinc-400 sm:text-xs">{karaoke.artist || 'Desconocido'}</span>
          </button>
          <div className="flex shrink-0 items-center gap-1 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <button 
                onClick={handleMuteToggle} 
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 md:w-24 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 hover:[&::-webkit-slider-thumb]:bg-primary-400"
              />
            </div>
            <button onClick={togglePlayPause} className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all hover:bg-primary-400 sm:h-12 sm:w-12" aria-label={globalIsPlaying ? 'Pausar karaoke' : 'Reproducir karaoke'}>
              {globalIsPlaying ? <Pause size={18} className="fill-black" /> : <Play size={18} className="fill-black ml-1" />}
            </button>
            <button onClick={() => setActiveKaraokeId(null)} className="flex h-11 w-10 items-center justify-center text-zinc-400 transition-colors hover:text-white sm:hidden" aria-label="Cerrar karaoke">
               <X size={20} />
            </button>
          </div>
          <button onClick={() => setIsKaraokeMiniPlayer(false)} className="hidden rounded-xl border border-white/5 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-300 transition-all hover:bg-white/10 hover:text-white sm:flex">
            Expandir
          </button>
          <button onClick={() => setActiveKaraokeId(null)} className="hidden h-10 w-10 items-center justify-center text-zinc-400 transition-colors hover:text-white sm:flex" aria-label="Cerrar karaoke">
            <X size={20} />
          </button>
          </div>
        </div>
      )}
    </>
  );
};
