import { useEffect, useRef, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { usePlayerStore } from '../store/playerStore';
import type { Song } from '../db';

export function useAlphaTab(song: Song | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<alphaTab.model.Track[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);
  const [transposition, setTransposition] = useState<number>(0);
  const [tuning, setTuning] = useState<{ stringNumber: number; note: string }[]>([]);
  
  const [songTitle, setSongTitle] = useState<string>('');
  const [songArtist, setSongArtist] = useState<string>('');
  const [songAlbum, setSongAlbum] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Cargando...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [trackVolumes, setTrackVolumes] = useState<Record<number, number>>({});
  const [trackMutes, setTrackMutes] = useState<Record<number, boolean>>({});
  const [trackSolos, setTrackSolos] = useState<Record<number, boolean>>({});

  const { masterVolume, setPlaybackSpeed, setIsLooping, setMainViewMode } = usePlayerStore();

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
  };

  useEffect(() => {
    if (!containerRef.current) return;

    apiRef.current = new alphaTab.AlphaTabApi(containerRef.current, {
      core: {
        fontDirectory: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/',
        useWorkers: false
      },
      player: {
        enablePlayer: true,
        enableCursor: true,
        scrollMode: alphaTab.ScrollMode.Off,
        scrollElement: containerRef.current,
        soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2'
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
        ]) as any
      }
    });

    apiRef.current.masterVolume = masterVolume;

    apiRef.current.soundFontLoaded.on(() => {
        setLoadingMsg('Banco de sonidos cargado...');
    });

    apiRef.current.scoreLoaded.on((score: any) => {
      setLoadingMsg('Dibujando partituras...');
      setSongTitle(score.title || 'Canción sin título');
      setSongArtist(score.artist || '');
      setSongAlbum(score.album || '');
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
      
      score.tracks.forEach((track: any, index: number) => {
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

    apiRef.current.beatMouseDown.on((beat) => {
      if (apiRef.current) {
        apiRef.current.tickPosition = beat.playbackStart;
      }
    });

    apiRef.current.playedBeatChanged.on(() => {
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

    apiRef.current.renderFinished.on(() => {
      setIsLoading(false);
    });

    apiRef.current.error.on(() => {
      setIsLoading(false);
      setErrorMsg("No se pudo leer el archivo. Es posible que esté corrupto o en un formato muy nuevo.");
    });

    apiRef.current.playerStateChanged.on((e) => {
      setIsPlaying(e.state === alphaTab.synth.PlayerState.Playing);
    });

    return () => {
      apiRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!song) return;

    if (song.type === 'text') {
      setMainViewMode('cifra');
      setSongTitle(song.name);
      setSongArtist(song.artist || '');
      setSongAlbum(song.album || '');
      return;
    }

    if (song.data && apiRef.current) {
      setTracks([]); 
      setErrorMsg(null);
      setIsLoading(true);
      setLoadingMsg('Descargando audios y leyendo archivo (Esto puede tardar en tu primera canción)...');
      
      try {
        const buffer = song.data instanceof Uint8Array ? song.data : new Uint8Array(song.data);
        apiRef.current.load(buffer);
      } catch (e) {
        setIsLoading(false);
        setErrorMsg("Error crítico al intentar cargar el archivo desde tu biblioteca.");
      }
    }
  }, [song]);

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
    songTitle,
    songArtist,
    songAlbum,
    isLoading,
    setIsLoading,
    loadingMsg,
    setLoadingMsg,
    errorMsg,
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
