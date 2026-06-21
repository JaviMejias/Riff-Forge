import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Loader2, FastForward, Settings } from 'lucide-react';
import { db } from '../../../db';
import type { Karaoke } from '../../../db';
import { VinylAnimation } from './VinylAnimation';
import { useAudioStore } from '../../../store/audioStore';
import { API_BASE_URL } from '../../../config'; // FE-1: use config
import { BungeePitchShift } from 'bungee-pitch-shift';

export interface LocalAudioPlayerRef {
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  seek: (time: number) => void;
  getDuration: () => number;
  setPlaybackRate: (rate: number) => void;
  setVolume: (vol: number) => void;
}

interface LocalAudioPlayerProps {
  karaoke: Karaoke;
  onTimeUpdate?: (time: number) => void;
  onDurationUpdate?: (duration: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  compactMode?: boolean;
  pitch: number;
  hiddenUI?: boolean;
}

export const LocalAudioPlayer = forwardRef<LocalAudioPlayerRef, LocalAudioPlayerProps>(({ karaoke, onTimeUpdate, onDurationUpdate, onPlayStateChange, compactMode, pitch, hiddenUI }, ref) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1.0); // 0.5 to 1.5
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);

  // Web Audio API and Pitch Shifting refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pitchShiftNodeRef = useRef<any>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    useAudioStore.getState().setGlobalIsPlaying(isPlaying);
    return () => useAudioStore.getState().setGlobalIsPlaying(false);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Cleanup Web Audio API
      if (pitchShiftNodeRef.current) {
        pitchShiftNodeRef.current.dispose();
        pitchShiftNodeRef.current = null;
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Update pitch in real-time when the pitch prop changes
  useEffect(() => {
    if (pitchShiftNodeRef.current) {
      pitchShiftNodeRef.current.setPitch(pitch);
    }
  }, [pitch]);

  // Handle AudioContext resume on play (browsers require user interaction to resume)
  useEffect(() => {
    if (isPlaying && audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, [isPlaying]);

  useImperativeHandle(ref, () => ({
    play: () => {
      // FE-11 fix: don't use togglePlay() because it reads stale closure state
      // FE-10 fix: catch unhandled promise rejection if autoplay is blocked
      audioRef.current?.play().catch(err => {
        console.warn('Autoplay prevented:', err);
        setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
      });
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
    },
    pause: () => {
      audioRef.current?.pause();
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
    },
    getCurrentTime: () => audioRef.current ? audioRef.current.currentTime : 0,
    seek: (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
        if (onTimeUpdate) onTimeUpdate(time);
      }
    },
    getDuration: () => duration,
    setPlaybackRate: (rate: number) => {
      if (audioRef.current) {
        audioRef.current.playbackRate = rate;
      }
    },
    setVolume: (vol: number) => {
      if (audioRef.current) {
        audioRef.current.volume = vol;
      }
    }
  }));

  // Fetch the huge binary file ONLY when this component mounts, 
  // with a small delay so the page transition animation finishes first.
  useEffect(() => {
    let url = '';
    let isMounted = true;

    const loadAudio = async () => {
      try {
        if (karaoke.cloudUrl) {
          let fullUrl = karaoke.cloudUrl;
          if (fullUrl.startsWith('http')) {
            if (window.location.protocol === 'https:' && fullUrl.startsWith('http://')) {
              try {
                const urlObj = new URL(fullUrl);
                fullUrl = urlObj.pathname + urlObj.search;
              } catch (e) {}
            }
          } else {
            if (API_BASE_URL && window.location.protocol === 'https:' && API_BASE_URL.startsWith('http://')) {
              fullUrl = fullUrl.startsWith('/') ? fullUrl : `/${fullUrl}`;
            } else {
              fullUrl = `${API_BASE_URL}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
            }
          }
          
          if (isMounted) {
            setAudioUrl(fullUrl);
            setIsLoading(false);
          }
          return;
        }

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

  // Initialize Web Audio API and BungeePitchShift once the audioUrl is set and the audio element is ready
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;
    
    let isMounted = true;
    
    const initAudio = async () => {
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioCtxRef.current = new AudioContextClass();
        }
        
        if (!sourceNodeRef.current) {
          // createMediaElementSource can ONLY be called once per <audio> element instance
          sourceNodeRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current as HTMLMediaElement);
        }
        
        if (!pitchShiftNodeRef.current) {
          pitchShiftNodeRef.current = await BungeePitchShift.create(audioCtxRef.current, {
            workletPath: '/bungee-processor-bundled.js',
            initialPitch: pitch
          });
        }
        
        if (isMounted && sourceNodeRef.current && pitchShiftNodeRef.current && audioCtxRef.current) {
          // Connect nodes: source -> pitchShift -> destination
          sourceNodeRef.current.disconnect();
          pitchShiftNodeRef.current.disconnect();
          
          sourceNodeRef.current.connect(pitchShiftNodeRef.current.node);
          pitchShiftNodeRef.current.connect(audioCtxRef.current.destination);
        }
      } catch (e) {
        console.error("Failed to initialize BungeePitchShift", e);
        // Fallback to normal playback if pitch shift fails
        if (sourceNodeRef.current && audioCtxRef.current) {
           sourceNodeRef.current.connect(audioCtxRef.current.destination);
        }
      }
    };
    
    initAudio();
    
    return () => {
      isMounted = false;
    };
  }, [audioUrl]); // Run when audioUrl is loaded

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
      } else {
        // Play immediately
        // FE-10 fix: catch unhandled promise rejection
        audioRef.current?.play().catch(err => {
          console.warn('Autoplay prevented:', err);
          setIsPlaying(false);
          if (onPlayStateChange) onPlayStateChange(false);
        });
        setIsPlaying(true);
        if (onPlayStateChange) onPlayStateChange(true);
      }
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

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseFloat(e.target.value);
    setSpeed(s);
    if (audioRef.current) {
      audioRef.current.playbackRate = s;
    }
  };

  const resetSpeed = () => {
    setSpeed(1.0);
    if (audioRef.current) {
      audioRef.current.playbackRate = 1.0;
    }
  };

  if (isLoading) {
    if (hiddenUI) return null;
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-950/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 text-zinc-400">
        <Loader2 size={32} className="animate-spin mb-4" />
        <p className="font-bold">Cargando archivo de audio...</p>
      </div>
    );
  }

  if (!audioUrl) {
    if (hiddenUI) return null;
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-zinc-950/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 text-zinc-500">
        <p className="font-bold">Error: No se pudo cargar el archivo de audio.</p>
      </div>
    );
  }

  return (
    <div className={hiddenUI ? 'hidden' : 'relative w-full h-full bg-zinc-950 overflow-hidden group'}>
      {/* Audio Element Hidden */}
      <audio 
        ref={audioRef}
        src={audioUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          if (onPlayStateChange) onPlayStateChange(false);
        }}
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Si hiddenUI es true, no renderizamos la interfaz */}
      {!hiddenUI && (
        <>
          {/* Animated Vinyl Area */}
          <div className={`absolute inset-0 transition-opacity duration-700 ${compactMode ? 'opacity-0 lg:opacity-100 pointer-events-none lg:pointer-events-auto' : 'opacity-100'}`}>
            <VinylAnimation isPlaying={isPlaying} karaoke={karaoke} />
          </div>

          {/* Settings Pop-up Menu */}
          {showSettings && (
            <>
              {/* Overlay to close on click outside */}
              <div 
                className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" 
                onClick={() => setShowSettings(false)}
              >
                <div 
                  className="bg-zinc-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl relative"
                  onClick={e => e.stopPropagation()}
                >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-sm">Ajustes de Audio</h3>
                <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-white">✕</button>
              </div>
              
              <div className="flex flex-col gap-5">
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
            </div>
            </>
          )}

          {/* Control Bar Overlay */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-all duration-700 opacity-100 ${compactMode ? 'pt-6 pb-2 lg:pt-12 lg:pb-4' : 'pt-12 pb-4'} px-4 sm:px-8`}>
        
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
              className="text-white hover:text-primary-400 transition-colors relative"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>

            {/* Volume Control */}
            <div 
              className="flex items-center gap-2 relative" 
              onMouseEnter={() => setIsVolumeOpen(true)} 
              onMouseLeave={() => setIsVolumeOpen(false)}
            >
              <button onClick={() => {
                if (window.innerWidth < 640) {
                  setIsVolumeOpen(!isVolumeOpen);
                } else {
                  const newMute = !isMuted;
                  setIsMuted(newMute);
                  if (audioRef.current) audioRef.current.muted = newMute;
                }
              }} className="text-white hover:text-primary-400 transition-colors p-1">
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              
              {/* Vertical popup bubble for volume */}
              <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-zinc-900 border border-white/10 rounded-xl p-3 shadow-2xl transition-all origin-bottom flex items-center justify-center ${
                isVolumeOpen ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95 pointer-events-none'
              }`}>
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
                  className="w-24 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-white"
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
        </>
      )}
    </div>
  );
});
