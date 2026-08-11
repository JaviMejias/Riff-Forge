import { useEffect, useMemo, useRef, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { usePlayerStore } from '../store/playerStore';
import type { Song } from '../db';

export function useAlphaTab(song: Song | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<alphaTab.model.Track[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);
  const [transposition, setTransposition] = useState<number>(0);
  const [tuning, setTuning] = useState<{ stringNumber: number; note: string }[]>([]);
  
  const [songTitle, setSongTitle] = useState<string>('');
  const [songArtist, setSongArtist] = useState<string>('');
  const [songAlbum, setSongAlbum] = useState<string>('');
  const [originalTempo, setOriginalTempo] = useState<number>(120);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Cargando...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [trackVolumes, setTrackVolumes] = useState<Record<number, number>>({});
  const [trackMutes, setTrackMutes] = useState<Record<number, boolean>>({});
  const [trackSolos, setTrackSolos] = useState<Record<number, boolean>>({});

  const { masterVolume, setPlaybackSpeed, setIsLooping, setMainViewMode } = usePlayerStore();
  const songType = song?.type;
  const songData = useMemo(() => {
    if (!song?.data) return null;
    return song.data instanceof Uint8Array ? song.data : new Uint8Array(song.data);
    // File identity is intentionally stable across metadata-only IndexedDB updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, song?.fileVersion, song?.data?.byteLength]);
  const songLoadKey = song && songType !== 'text' && songData
    ? `${song.id || 'temp'}:${song.fileVersion ?? 0}:${songData.byteLength}`
    : null;

  const getNoteName = (midiValue: number): string => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return noteNames[midiValue % 12];
  };

  const changeTrack = (track: alphaTab.model.Track, index: number) => {
    if (apiRef.current && isPlaying) {
      apiRef.current.playPause();
    }

    setActiveTrackIndex(index);
    setTransposition(0);
    if (track.staves.length > 0 && track.staves[0].stringTuning) {
      const tuningArray = track.staves[0].stringTuning.tunings.map((midi: number, i: number) => ({
        stringNumber: i + 1,
        note: getNoteName(midi)
      }));
      setTuning(tuningArray);
    } else {
      setTuning([]);
    }

    setIsLoading(true);
    setLoadingMsg(`Renderizando pista: ${track.name}...`);
    apiRef.current?.renderTracks([track]);

    // Safety timeout in case alphaTab hangs during render
    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    renderTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      renderTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const api = new alphaTab.AlphaTabApi(containerRef.current, {
      core: {
        fontDirectory: '/alphatab/font/',
        useWorkers: true,
      },
      player: {
        enablePlayer: true,
        enableCursor: true,
        scrollMode: alphaTab.ScrollMode.Off,
        scrollElement: containerRef.current,
        soundFont: '/alphatab/soundfont/sonivox.sf2'
      },
      display: {
        layoutMode: alphaTab.LayoutMode.Page,
        staveProfile: alphaTab.StaveProfile.Tab
      },
      notation: {
        elements: new Map([
          [alphaTab.NotationElement.ScoreTitle, false],
          [alphaTab.NotationElement.ScoreSubTitle, false],
          [alphaTab.NotationElement.ScoreArtist, false],
          [alphaTab.NotationElement.ScoreAlbum, false],
          [alphaTab.NotationElement.ScoreWords, false],
          [alphaTab.NotationElement.ScoreMusic, false],
          [alphaTab.NotationElement.ScoreWordsAndMusic, false],
          [alphaTab.NotationElement.ScoreCopyright, false]
        ])
      }
    });
    apiRef.current = api;

    api.masterVolume = masterVolume;

    api.soundFontLoaded.on(() => {
        setLoadingMsg('Banco de sonidos cargado...');
    });

    api.scoreLoaded.on((score) => {
      if (scoreLoadTimeoutRef.current) {
        clearTimeout(scoreLoadTimeoutRef.current);
        scoreLoadTimeoutRef.current = null;
      }
      setLoadingMsg('Dibujando partituras...');
      setSongTitle(score.title || 'Canción sin título');
      setSongArtist(score.artist || '');
      setSongAlbum(score.album || '');
      setOriginalTempo(Math.round(score.tempo || 120));
      setTracks(score.tracks);

      if (score.tracks.length > 0) {
        const firstValidIndex = score.tracks.findIndex((t: alphaTab.model.Track) => !t.isPercussion);
        const indexToLoad = firstValidIndex !== -1 ? firstValidIndex : 0;
        changeTrack(score.tracks[indexToLoad], indexToLoad);
      }
      
      setPlaybackSpeed(1);
      setIsLooping(false);
      if (apiRef.current) {
        apiRef.current.playbackSpeed = 1;
        apiRef.current.isLooping = false;
      }

      const initialVolumes: Record<number, number> = {};
      const initialMutes: Record<number, boolean> = {};
      const initialSolos: Record<number, boolean> = {};
      
      score.tracks.forEach((track, index: number) => {
        initialVolumes[index] = track.playbackInfo.volume;
        initialMutes[index] = track.playbackInfo.isMute;
        initialSolos[index] = track.playbackInfo.isSolo;
      });
      
      setTrackVolumes(initialVolumes);
      setTrackMutes(initialMutes);
      setTrackSolos(initialSolos);
      
      if (apiRef.current) {
        apiRef.current.masterVolume = masterVolume;
      }
    });

    api.beatMouseDown.on((beat) => {
      api.tickPosition = beat.playbackStart;
    });

    api.playedBeatChanged.on(() => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const cursor = container.querySelector('.at-cursor-beat') as HTMLElement;
      if (!cursor) return;

      requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const cursorRect = cursor.getBoundingClientRect();

        if (container.classList.contains('custom-scrollbar')) {
          const offset = (cursorRect.left + (cursorRect.width / 2)) - (containerRect.left + (containerRect.width / 2));
          if (Math.abs(offset) > 2) {
            container.scrollLeft += offset;
          }
        } else {
          const margin = 100;
          if (cursorRect.bottom > containerRect.bottom - margin || cursorRect.top < containerRect.top + margin) {
            cursor.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });

    api.renderFinished.on(() => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
        renderTimeoutRef.current = null;
      }
      setIsLoading(false);
    });

    api.error.on(() => {
      if (scoreLoadTimeoutRef.current) {
        clearTimeout(scoreLoadTimeoutRef.current);
        scoreLoadTimeoutRef.current = null;
      }
      setIsLoading(false);
      setErrorMsg("No se pudo leer el archivo. Es posible que esté corrupto o en un formato muy nuevo.");
    });

    api.playerStateChanged.on((e) => {
      setIsPlaying(e.state === alphaTab.synth.PlayerState.Playing);
    });

    api.playerReady.on(() => {
      api.masterVolume = usePlayerStore.getState().masterVolume;
    });

    return () => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (scoreLoadTimeoutRef.current) clearTimeout(scoreLoadTimeoutRef.current);
      api.destroy();
      if (apiRef.current === api) apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }

    if (!songType && !songLoadKey) {
      apiRef.current?.stop();
      return;
    }

    if (songType === 'text') {
      apiRef.current?.stop();
      setMainViewMode('cifra');
      return;
    }

    if (songLoadKey && songData && apiRef.current) {
      setTracks([]);
      setErrorMsg(null);
      setIsLoading(true);
      setLoadingMsg('Descargando audios y leyendo archivo (Esto puede tardar en tu primera canción)...');

      if (scoreLoadTimeoutRef.current) clearTimeout(scoreLoadTimeoutRef.current);
      scoreLoadTimeoutRef.current = setTimeout(() => {
        scoreLoadTimeoutRef.current = null;
        setIsLoading(false);
        setErrorMsg('El archivo está tardando demasiado en abrirse. Intenta volver a entrar o verifica que el archivo no esté dañado.');
      }, 20000);

      const buffer = songData;

      // Wait a tick for the DOM to paint so AlphaTab reads correct container dimensions
      const targetApi = apiRef.current;
      loadTimeoutRef.current = setTimeout(() => {
        loadTimeoutRef.current = null;
        if (apiRef.current === targetApi) {
          try {
            targetApi.load(buffer);
          } catch (innerError) {
            console.error("AlphaTab load error:", innerError);
            setIsLoading(false);
            setErrorMsg("No se pudo leer el archivo. Formato no compatible o corrupto.");
          }
        }
      }, 100);
    }
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      if (scoreLoadTimeoutRef.current) {
        clearTimeout(scoreLoadTimeoutRef.current);
        scoreLoadTimeoutRef.current = null;
      }
    };
  }, [setMainViewMode, songData, songLoadKey, songType]);

  return {
    containerRef,
    apiRef,
    isPlaying,
    setIsPlaying,
    tracks,
    activeTrackIndex,
    transposition,
    setTransposition,
    tuning,
    songTitle: song?.type === 'text' ? song.name : songTitle,
    songArtist: song?.type === 'text' ? song.artist || '' : songArtist,
    songAlbum: song?.type === 'text' ? song.album || '' : songAlbum,
    originalTempo,
    isLoading: song?.type === 'text' ? false : isLoading,
    setIsLoading,
    loadingMsg,
    setLoadingMsg,
    errorMsg: song?.type === 'text' ? null : errorMsg,
    setErrorMsg,
    trackVolumes,
    setTrackVolumes,
    trackMutes,
    setTrackMutes,
    trackSolos,
    setTrackSolos,
    changeTrack
  };
}
