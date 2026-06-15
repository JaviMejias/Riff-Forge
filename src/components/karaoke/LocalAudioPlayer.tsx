import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Loader2, FastForward, Music, Settings } from 'lucide-react';
import { db } from '../../db';
import type { Karaoke } from '../../db';
import * as Tone from 'tone';

export interface LocalAudioPlayerRef {
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  seek: (time: number) => void;
  getDuration: () => number;
}

interface LocalAudioPlayerProps {
  karaoke: Karaoke;
  onTimeUpdate?: (time: number) => void;
  onDurationUpdate?: (duration: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export const LocalAudioPlayer = forwardRef<LocalAudioPlayerRef, LocalAudioPlayerProps>(({ karaoke, onTimeUpdate, onDurationUpdate, onPlayStateChange }, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [pitch, setPitch] = useState(0); // -12 to 12 semitones
  const [speed, setSpeed] = useState(1.0); // 0.5 to 1.5
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (audioRef.current && audioRef.current.paused) togglePlay();
    },
    pause: () => {
      if (audioRef.current && !audioRef.current.paused) togglePlay();
    },
    getCurrentTime: () => audioRef.current ? audioRef.current.currentTime : 0,
    seek: (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
        if (onTimeUpdate) onTimeUpdate(time);
      }
    },
    getDuration: () => duration
  }));

  // Fetch the huge binary file ONLY when this component mounts, 
  // with a small delay so the page transition animation finishes first.
  useEffect(() => {
    let url = '';
    let isMounted = true;

    const loadAudio = async () => {
      try {
        const fileRecord = await db.karaokeFiles.get(karaoke.id!);
        if (!isMounted) return;

        // Fallback for non-migrated legacy files if any
        let data: Uint8Array | undefined;
        if (fileRecord) {
          data = fileRecord.data;
        } else if ((karaoke as any).localFile) {
          data = (karaoke as any).localFile;
        }

        if (data && isMounted) {
          const blob = new Blob([data as any], { type: 'audio/mpeg' });
          url = URL.createObjectURL(blob);
          setAudioUrl(url);
        }
      } catch (e) {
        console.error("Failed to load audio file", e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      loadAudio();
    }, 300); // 300ms delay to allow page animation to finish

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [karaoke.id]);

  // Setup Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null);
  const isInitializingRef = useRef(false);

  const initAudioContext = async () => {
    if (!audioRef.current || audioCtxRef.current || isInitializingRef.current) return;
    
    isInitializingRef.current = true;
    try {
      await Tone.start();
      const ctx = Tone.getContext().rawContext as AudioContext;
      
      const pitchShift = new Tone.PitchShift({
        pitch: pitch,
        windowSize: 0.1
      }).toDestination();
      
      pitchShiftRef.current = pitchShift;
      
      // Only connect if not already connected
      if (!audioCtxRef.current) {
        const source = ctx.createMediaElementSource(audioRef.current);
        Tone.connect(source, pitchShift);
        
        audioCtxRef.current = ctx;
        sourceRef.current = source;
      }
    } catch (e) {
      console.error("AudioContext initialization failed:", e);
    } finally {
      isInitializingRef.current = false;
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // Inicializar el contexto DE INMEDIATO con el click del usuario
        if (!audioCtxRef.current && !isInitializingRef.current) {
          initAudioContext();
        } else if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        audioRef.current.play();
      }
      const newPlayingState = !isPlaying;
      setIsPlaying(newPlayingState);
      if (onPlayStateChange) onPlayStateChange(newPlayingState);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) onTimeUpdate(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      if (onDurationUpdate) onDurationUpdate(audioRef.current.duration);
      // We want to preserve pitch when changing playbackRate so we can shift it independently
      (audioRef.current as any).preservesPitch = true;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseFloat(e.target.value);
    setPitch(p);
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = p;
    }
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseFloat(e.target.value);
    setSpeed(s);
    if (audioRef.current) {
      audioRef.current.playbackRate = s;
    }
  };

  const resetPitch = () => {
    setPitch(0);
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = 0;
    }
  };

  const resetSpeed = () => {
    setSpeed(1.0);
    if (audioRef.current) {
      audioRef.current.playbackRate = 1.0;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-950/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 text-zinc-400">
        <Loader2 size={32} className="animate-spin mb-4" />
        <p className="font-bold">Cargando archivo de audio...</p>
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-950/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 text-zinc-500">
        <p className="font-bold">Error: No se pudo cargar el archivo de audio.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden group">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          if (onPlayStateChange) onPlayStateChange(false);
        }}
      />

      {/* Animated Vinyl Area */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center">
        {/* Decorative background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] aspect-square bg-primary-500/5 blur-3xl rounded-full pointer-events-none" />
        
        {/* Vinyl Record */}
        <div className="relative group w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 -mt-16 sm:-mt-10">
          {/* Tone Arm (aesthetic only) */}
          <div className={`absolute -top-10 -right-10 sm:-top-16 sm:-right-16 w-8 h-32 sm:w-12 sm:h-48 origin-top-right transition-transform duration-1000 z-10 ${isPlaying ? 'rotate-[25deg]' : 'rotate-0'}`}>
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-zinc-400 absolute top-0 right-0 shadow-lg border-2 border-zinc-700" />
            <div className="w-1.5 sm:w-2 h-full bg-gradient-to-b from-zinc-300 to-zinc-500 absolute top-2 right-2 sm:right-3 rounded-full shadow-lg" />
            <div className="w-6 h-10 sm:w-8 sm:h-16 bg-zinc-800 absolute bottom-0 right-0 rounded-sm border border-zinc-600 shadow-xl" />
          </div>

          {/* The Record */}
          <div 
            className={`w-full h-full rounded-full bg-zinc-950 shadow-[0_10px_40px_rgba(0,0,0,0.8)] border-[4px] border-zinc-900 flex items-center justify-center relative overflow-hidden ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}
            style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
          >
            {/* Grooves */}
            <div className="absolute inset-2 border border-white/5 rounded-full pointer-events-none" />
            <div className="absolute inset-6 border border-white/5 rounded-full pointer-events-none" />
            <div className="absolute inset-10 border border-white/5 rounded-full pointer-events-none" />
            <div className="absolute inset-14 border border-white/5 rounded-full pointer-events-none" />
            <div className="absolute inset-18 border border-white/5 rounded-full pointer-events-none" />
            
            {/* Vinyl Highlight / Reflection */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-transparent rotate-45 pointer-events-none" />

            {/* Center Label */}
            <div className="w-1/3 h-1/3 bg-primary-500 rounded-full shadow-inner flex flex-col items-center justify-center p-2 text-center relative border-[3px] border-primary-600">
              <div className="w-3 h-3 bg-zinc-950 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10" />
              <p className="text-[0.5rem] sm:text-[0.6rem] font-black text-primary-950 uppercase tracking-widest truncate w-full mb-1">{karaoke.artist || 'Unknown'}</p>
              <p className="text-[0.4rem] sm:text-[0.5rem] font-bold text-primary-900 uppercase truncate w-full leading-tight">{karaoke.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Pop-up Menu */}
      {showSettings && (
        <>
          {/* Overlay to close on click outside */}
          <div 
            className="absolute inset-0 z-10" 
            onClick={() => setShowSettings(false)}
          />
          <div className="absolute bottom-20 right-4 sm:right-8 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 w-64 sm:w-72 shadow-2xl z-20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white text-sm">Ajustes de Audio</h3>
            <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-white">✕</button>
          </div>
          
          <div className="flex flex-col gap-5">
            {/* Pitch Control */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-zinc-400 font-bold">
                <span className="flex items-center gap-1"><Music size={12}/> Tono</span>
                <span className={pitch !== 0 ? 'text-primary-400' : ''}>
                  {pitch > 0 ? '+' : ''}{pitch} st
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={pitch}
                  onChange={handlePitchChange}
                  className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <button 
                  onClick={resetPitch}
                  className="p-1 hover:bg-zinc-700 rounded-md transition-colors"
                  title="Restablecer"
                >
                  <RotateCcw size={12} className="text-zinc-400 hover:text-primary-400" />
                </button>
              </div>
            </div>

            {/* Speed Control */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-zinc-400 font-bold">
                <span className="flex items-center gap-1"><FastForward size={12}/> Velocidad</span>
                <span className={speed !== 1.0 ? 'text-primary-400' : ''}>
                  {speed.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={speed}
                  onChange={handleSpeedChange}
                  className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <button 
                  onClick={resetSpeed}
                  className="p-1 hover:bg-zinc-700 rounded-md transition-colors"
                  title="Restablecer"
                >
                  <RotateCcw size={12} className="text-zinc-400 hover:text-primary-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Control Bar Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-12 pb-4 px-4 sm:px-8 transition-opacity duration-300 opacity-100">
        
        {/* Progress Bar (Full width at the top of the control bar) */}
        <div className="w-full flex items-center mb-3 group/slider">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary-500 hover:h-2 transition-all"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Play Button */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-primary-400 transition-colors"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/vol relative">
              <button onClick={() => {
                const newMute = !isMuted;
                setIsMuted(newMute);
                if (audioRef.current) audioRef.current.muted = newMute;
              }} className="text-white hover:text-primary-400 transition-colors">
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              {/* Expandable volume slider on desktop, fixed small on mobile */}
              <div className="w-0 overflow-hidden sm:group-hover/vol:w-20 w-16 sm:w-0 transition-all duration-300 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value);
                    setVolume(vol);
                    if (audioRef.current) audioRef.current.volume = vol;
                    if (vol > 0 && isMuted) setIsMuted(false);
                  }}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>

            {/* Time display */}
            <div className="text-xs font-mono text-zinc-300 select-none">
              {formatTime(currentTime)} <span className="text-zinc-500 mx-1">/</span> {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`text-white transition-colors ${showSettings || pitch !== 0 || speed !== 1 ? 'text-primary-500' : 'hover:text-primary-400'}`}
              title="Configuración de audio"
            >
              <Settings size={20} className={`transition-transform duration-500 ${showSettings ? 'rotate-90' : ''}`} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
});
