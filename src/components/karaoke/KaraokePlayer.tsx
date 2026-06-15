import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Edit3, AlignLeft, MonitorPlay, Music, Settings, Loader2 } from 'lucide-react';
import * as Tone from 'tone';
import { Navbar } from '../Navbar';
import { LocalAudioPlayer } from './LocalAudioPlayer';
import type { LocalAudioPlayerRef } from './LocalAudioPlayer';
import { KaraokeLyricsView } from './KaraokeLyricsView';
import { KaraokeLyricsEditor } from './KaraokeLyricsEditor';
import { db } from '../../db';
import type { Karaoke } from '../../db';
import Swal from 'sweetalert2';
import YouTube from 'react-youtube';

interface KaraokePlayerProps {
  karaoke: Karaoke;
  onBack: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const KaraokePlayer = ({ karaoke, onBack, isSidebarOpen, onToggleSidebar }: KaraokePlayerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showLyrics, setShowLyrics] = useState(!!karaoke.textContent);
  const [showYtSettings, setShowYtSettings] = useState(false);

  // Estados de audio unificados para las letras
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [globalIsPlaying, setGlobalIsPlaying] = useState(false);
  const localPlayerRef = useRef<LocalAudioPlayerRef>(null);



  // Extract YouTube ID if it's a YT URL
  const getYoutubeVideoId = (url: string) => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v') || '';
      } else if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.slice(1);
      }
    } catch (e) {
      // invalid url
    }
    return null;
  };

  const ytVideoId = karaoke.youtubeUrl ? getYoutubeVideoId(karaoke.youtubeUrl) : null;
  const hasLocalAudio = !!karaoke.hasLocalAudio || !!(karaoke as any).localFile;

  const [activeSource, setActiveSource] = useState<'youtube' | 'local'>(ytVideoId ? 'youtube' : 'local');

  const [ytPlayer, setYtPlayer] = useState<any>(null);
  const [ytAudioUrl, setYtAudioUrl] = useState<string | null>(null);
  const [isFetchingAudio, setIsFetchingAudio] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [pitch, setPitch] = useState(0);
  
  const ytAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null);
  const isInitializingRef = useRef(false);

  useEffect(() => {
    let interval: any;
    if (activeSource === 'youtube' && ytPlayer) {
      interval = setInterval(() => {
        setLocalCurrentTime(ytPlayer.getCurrentTime());
        setGlobalIsPlaying(ytPlayer.getPlayerState() === 1);
      }, 50); // Fast polling for smooth lyric sync
    }
    return () => clearInterval(interval);
  }, [activeSource, ytPlayer]);

  // Audio Control Methods for Sync Editor
  const handleAbstractPlay = () => {
    if (activeSource === 'youtube' && ytPlayer) ytPlayer.playVideo();
    else if (activeSource === 'local' && localPlayerRef.current) localPlayerRef.current.play();
  };

  const handleAbstractPause = () => {
    if (activeSource === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
    else if (activeSource === 'local' && localPlayerRef.current) localPlayerRef.current.pause();
  };

  const handleAbstractSeek = (time: number) => {
    if (activeSource === 'youtube' && ytPlayer) ytPlayer.seekTo(time, true);
    else if (activeSource === 'local' && localPlayerRef.current) localPlayerRef.current.seek(time);
  };

  // Fetch audio from RapidAPI (youtube-mp36)
  useEffect(() => {
    if (activeSource === 'youtube' && ytVideoId) {
      setIsFetchingAudio(true);
      
      const options = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': 'c9117d63b8mshb442dcb1e10060bp1f5a88jsn6f88c2e57088',
          'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
        }
      };

      const fetchAudio = async (retries = 15) => {
        try {
          const res = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${ytVideoId}`, options);
          const data = await res.json();
          
          if (data.status === 'ok' && data.link) {
            setYtAudioUrl(data.link);
            setIsFetchingAudio(false);
          } else if (data.msg === 'in process' && retries > 0) {
            // La API está procesando el audio, reintentar en 2 segundos
            setTimeout(() => fetchAudio(retries - 1), 2000);
          } else {
            throw new Error(data.msg || "Error en la API");
          }
        } catch (e) {
          console.error("Fallo la extracción de RapidAPI", e);
          setIsFetchingAudio(false);
        }
      };

      fetchAudio();
    }
  }, [activeSource, ytVideoId]);

  // Sync mute state of YouTube player based on whether we have extracted audio
  useEffect(() => {
    if (!ytPlayer) return;

    let interval: ReturnType<typeof setInterval>;

    if (ytAudioUrl) {
      // Forzar mute y volumen 0 agresivamente para evitar cualquier "fuga" de sonido nativo
      interval = setInterval(() => {
        try {
          if (typeof ytPlayer.mute === 'function') ytPlayer.mute();
          if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(0);
        } catch (e) {}
      }, 500);
      
      // Llamada inmediata por si acaso
      try {
        if (typeof ytPlayer.mute === 'function') ytPlayer.mute();
        if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(0);
      } catch (e) {}
    } else {
      try {
        if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
        if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(100);
      } catch (e) {}
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ytPlayer, ytAudioUrl]);



  const initAudioContext = async () => {
    if (!ytAudioRef.current || audioCtxRef.current || isInitializingRef.current) return;
    
    isInitializingRef.current = true;
    try {
      // Iniciar el contexto de Tone
      await Tone.start();
      const ctx = Tone.getContext().rawContext as AudioContext;
      
      const pitchShift = new Tone.PitchShift({
        pitch: pitch,
        windowSize: 0.1
      }).toDestination();
      
      pitchShiftRef.current = pitchShift;
      
      if (!audioCtxRef.current) {
        const source = ctx.createMediaElementSource(ytAudioRef.current);
        Tone.connect(source, pitchShift);
        
        audioCtxRef.current = ctx;
        sourceRef.current = source;
      }
      
      // En Firefox, el AudioContext puede nacer "suspended", debemos forzarlo a "running"
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
    } catch (e: any) {
      console.error(e);
    } finally {
      isInitializingRef.current = false;
    }
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseFloat(e.target.value);
    setPitch(p);
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = p;
    }
  };

  // Sync state if karaoke prop changes
  useEffect(() => {
    setShowYtSettings(false);
  }, [activeSource]);

  useEffect(() => {
    if (karaoke.textContent && !showLyrics && !isEditing) {
      setShowLyrics(true);
    }
    // Update active source if the available sources change
    if (ytVideoId && !hasLocalAudio) setActiveSource('youtube');
    else if (!ytVideoId && hasLocalAudio) setActiveSource('local');
  }, [karaoke.textContent, ytVideoId, hasLocalAudio]);

  const handleSaveLyrics = async (content: string) => {
    try {
      await db.karaokes.update(karaoke.id!, {
        textContent: content
      });
      karaoke.textContent = content; // mutate local copy
      setIsEditing(false);
      setShowLyrics(!!content.trim());
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


  return (
    <div className="flex flex-col h-full w-full p-8">
      <Navbar
        title={karaoke.name}
        subtitle={`${karaoke.artist || 'Desconocido'} • Karaoke`}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onBack={onBack}
      >
        <div className="flex gap-2">
          {!isEditing && (
            <button
              onClick={() => setShowLyrics(!showLyrics)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer font-bold text-xs sm:text-sm ${
                showLyrics 
                  ? 'bg-primary-500/20 text-primary-500 border border-primary-500/30' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <AlignLeft size={16} /> <span className="hidden sm:inline">{showLyrics ? 'Ocultar Letra' : 'Mostrar Letra'}</span>
            </button>
          )}

          {isEditing ? (
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer font-bold text-xs sm:text-sm"
            >
              Cerrar Editor
            </button>
          ) : (
            <button
              onClick={() => { setIsEditing(true); setShowLyrics(true); }}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer font-bold text-xs sm:text-sm shadow-[0_0_20px_var(--theme-glow)]"
            >
              <Edit3 size={16} /> <span className="hidden sm:inline">Editar Letra</span>
            </button>
          )}
        </div>
      </Navbar>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-6 overflow-hidden">
        
        {/* LADO IZQUIERDO: REPRODUCTOR */}
        <div className={`relative flex-col transition-all duration-300 ${
          showLyrics ? 'lg:w-1/2 h-[40vh] lg:h-full' : 'w-full h-full'
        } ${isEditing ? 'hidden lg:flex' : 'flex'}`}>
          {/* Selector de Fuente (Sólo si tiene ambas) */}
          {ytVideoId && hasLocalAudio && (
            <div className="flex bg-zinc-900/50 p-1 rounded-xl mb-4 self-center sm:self-start border border-white/5 relative">
              <button
                onClick={() => setActiveSource('youtube')}
                className={`relative flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-colors z-10 ${
                  activeSource === 'youtube' 
                    ? 'text-zinc-950' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
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
                <MonitorPlay size={14} className="sm:w-4 sm:h-4" /> YouTube
              </button>
              <button
                onClick={() => setActiveSource('local')}
                className={`relative flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-colors z-10 ${
                  activeSource === 'local' 
                    ? 'text-zinc-950' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
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
                <Music size={14} className="sm:w-4 sm:h-4" /> MP3
              </button>
            </div>
          )}

          <motion.div 
            animate={{ boxShadow: ['0px 0px 20px var(--theme-glow)', '0px 0px 60px var(--theme-glow-strong)', '0px 0px 20px var(--theme-glow)'] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="flex-1 rounded-3xl overflow-hidden bg-black border border-white/10 relative"
          >
            {!ytVideoId && !hasLocalAudio ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 h-full">
                <AlertCircle size={48} className="mb-4 opacity-50" />
                <p className="text-xl font-bold">Fuente no encontrada</p>
                <p className="text-sm">El enlace de YouTube no es válido o el archivo local no existe.</p>
              </div>
            ) : activeSource === 'youtube' && ytVideoId ? (
              <div className="flex-1 w-full h-full relative group">
                <YouTube
                  videoId={ytVideoId}
                  className="absolute inset-0 w-full h-full border-0"
                  iframeClassName="w-full h-full"
                  opts={{
                    playerVars: {
                      autoplay: 0,
                      controls: 1,
                      rel: 0,
                      disablekb: 0,
                      mute: 1 // Inicia el reproductor nativamente en mute para evitar el "eco" inicial
                    }
                  }}
                  onReady={(e) => {
                    setYtPlayer(e.target);
                    if (ytAudioUrl) {
                      try { e.target.mute(); } catch (err) {}
                    }
                  }}
                  onPlay={(e) => {
                    if (ytAudioUrl) {
                      try { 
                        e.target.mute(); 
                        e.target.setVolume(0);
                      } catch (err) {}
                    }
                    // Siempre sincronizar el audio oculto y el AudioContext cuando YouTube reproduzca
                    if (ytAudioRef.current) {
                      if (!hasStarted) setHasStarted(true);
                      ytAudioRef.current.play().catch(console.error);
                      initAudioContext();
                      
                      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                        audioCtxRef.current.resume();
                      }
                    }
                  }}
                  onPause={() => {
                    if (ytAudioRef.current) ytAudioRef.current.pause();
                  }}
                  onStateChange={(e) => {
                    // Sync time when playing (1) or buffering (3)
                    if (ytAudioRef.current && ytPlayer && (e.data === 1 || e.data === 3)) {
                      const ytTime = ytPlayer.getCurrentTime();
                      // Only sync if the difference is large to avoid micro-stutters
                      if (Math.abs(ytAudioRef.current.currentTime - ytTime) > 0.5) {
                        ytAudioRef.current.currentTime = ytTime;
                      }
                    }
                  }}
                />
                
                {/* Hidden Audio Stream for Pitch Shifting */}
                {ytAudioUrl && (
                  <audio
                    ref={ytAudioRef}
                    src={ytAudioUrl}
                    crossOrigin="anonymous"
                    preload="auto"
                  />
                )}
                
                {/* Audio Status Overlay (Loading) */}
                {isFetchingAudio && (
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-none z-10">
                    <Loader2 size={12} className="text-primary-500 animate-spin" />
                    <span className="text-[10px] font-bold text-primary-500">Conectando motor de audio...</span>
                  </div>
                )}
                
                {/* Click-to-Start Overlay to bypass Autoplay Policies */}
                {!hasStarted && ytPlayer && !isFetchingAudio && ytAudioUrl && (
                  <div 
                    className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
                    onClick={() => {
                      setHasStarted(true);
                      if (ytAudioRef.current) ytAudioRef.current.play();
                      ytPlayer.playVideo();
                      initAudioContext();
                    }}
                  >
                    <div className="bg-primary-500 text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                      <MonitorPlay size={20} />
                      Iniciar Karaoke
                    </div>
                  </div>
                )}
                
                {/* Overlay Settings Button */}
                <div className="absolute bottom-20 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => setShowYtSettings(!showYtSettings)}
                    className="p-2 sm:p-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full text-white transition-colors shadow-lg"
                    title="Ajustes de Audio"
                  >
                    <Settings size={20} className={`transition-transform duration-500 ${showYtSettings ? 'rotate-90 text-primary-500' : ''}`} />
                  </button>
                </div>
                {/* Info Pop-up */}
                {showYtSettings && (
                  <>
                    {/* Fondo transparente para cerrar al hacer clic fuera */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowYtSettings(false)}
                      title="Cerrar ajustes"
                    />
                    <div className="absolute bottom-36 right-4 sm:right-8 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 w-72 sm:w-80 shadow-2xl z-20">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white text-sm flex items-center gap-2">
                          <Settings size={16} className="text-primary-500" /> Motor de Audio
                        </h3>
                      <button onClick={() => setShowYtSettings(false)} className="text-zinc-400 hover:text-white">✕</button>
                    </div>
                    
                    {!ytAudioUrl ? (
                      <div className="text-center py-4">
                        <AlertCircle size={24} className="text-rose-500 mx-auto mb-2" />
                        <p className="text-xs text-zinc-300 font-bold mb-2">Motor de Tono Inactivo</p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed mb-4">
                          La API comunitaria que extrae el audio limpio de YouTube está temporalmente bloqueada. Estás escuchando el audio original (sin capacidad de cambiar el tono).
                        </p>
                        <div className="bg-zinc-800 rounded-xl p-3 text-left">
                          <p className="text-[10px] text-zinc-300 font-bold mb-2">Opciones:</p>
                          <ul className="text-[10px] text-zinc-500 list-disc pl-4 space-y-1">
                            <li>Usa la pestaña <strong>MP3</strong> (100% nativo y sin bloqueos).</li>
                            <li>Instala la extensión <strong>Transpose</strong> en el navegador y abre el video directamente en YouTube.</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Control de Tono */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-zinc-300">Tono (Semitonos)</label>
                            <span className="text-xs font-mono bg-zinc-800 text-primary-500 px-2 py-0.5 rounded">
                              {pitch > 0 ? `+${pitch}` : pitch}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-500 font-bold">-12</span>
                            <input
                              type="range"
                              min="-12"
                              max="12"
                              step="1"
                              value={pitch}
                              onChange={handlePitchChange}
                              className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                            />
                            <span className="text-xs text-zinc-500 font-bold">+12</span>
                          </div>
                          <div className="flex justify-between mt-2">
                            <button onClick={() => handlePitchChange({target: {value: '0'}} as any)} className="text-[10px] text-zinc-500 hover:text-primary-500 transition-colors">Resetear</button>
                          </div>
                        </div>
                        
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                          <p className="text-xs text-emerald-400/80 mb-1 font-bold flex items-center gap-1">
                            <Music size={12} /> Audio Directo Activo
                          </p>
                          <p className="text-[10px] text-emerald-400/60 leading-relaxed">
                            Estás escuchando la pista original procesada en tiempo real.
                          </p>
                        </div>


                      </div>
                    )}
                  </div>
                  </>
                )}
              </div>
            ) : activeSource === 'local' && hasLocalAudio ? (
              <div className="flex-1 w-full h-full">
                <LocalAudioPlayer 
                  ref={localPlayerRef} 
                  karaoke={karaoke} 
                  onTimeUpdate={setLocalCurrentTime}
                  onPlayStateChange={setGlobalIsPlaying}
                />
              </div>
            ) : null}
          </motion.div>
        </div>

        {/* LADO DERECHO: LETRA */}
        {showLyrics && (
          <div className={`${isEditing ? 'flex-1 w-full lg:w-1/2 lg:h-full' : 'h-[50vh] lg:h-full lg:w-1/2'} bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl rounded-3xl border border-white/5 flex flex-col overflow-hidden shadow-2xl relative`}>
            
            {/* Brillo decorativo superior */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-primary-500/5 blur-3xl pointer-events-none rounded-full" />
            
            {isEditing ? (
              <KaraokeLyricsEditor 
                initialContent={karaoke.textContent || ''}
                currentTime={localCurrentTime}
                isPlaying={globalIsPlaying}
                onPlay={handleAbstractPlay}
                onPause={handleAbstractPause}
                onSeek={handleAbstractSeek}
                onSave={handleSaveLyrics}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <KaraokeLyricsView 
                karaoke={karaoke}
                currentTime={localCurrentTime}
                onEdit={() => setIsEditing(true)}
              />
            )}
          </div>
        )}

      </div>
    </div>
  );
};
