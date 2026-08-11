import { useEffect, useRef } from 'react';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

export const useMetronome = (bpm: number, isActive: boolean) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextBeatAtRef = useRef(0);
  const beatRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }

    const audioWindow = window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;
    context.resume().catch(console.error);
    nextBeatAtRef.current = context.currentTime + 0.05;
    beatRef.current = 0;

    const scheduleClick = (time: number, isAccent: boolean) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = isAccent ? 1200 : 800;
      gain.gain.setValueAtTime(0.18, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + 0.05);
    };

    const scheduler = () => {
      const secondsPerBeat = 60 / bpm;
      while (nextBeatAtRef.current < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
        scheduleClick(nextBeatAtRef.current, beatRef.current % 4 === 0);
        nextBeatAtRef.current += secondsPerBeat;
        beatRef.current += 1;
      }
      timerRef.current = setTimeout(scheduler, LOOKAHEAD_MS);
    };

    scheduler();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [bpm, isActive]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);
};
