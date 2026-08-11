import { useEffect, useRef } from 'react';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

export type MetronomeSound = 'classic' | 'wood' | 'digital';

const soundSettings: Record<MetronomeSound, { accent: number; beat: number; duration: number; wave: OscillatorType }> = {
  classic: { accent: 1200, beat: 800, duration: 0.05, wave: 'sine' },
  wood: { accent: 650, beat: 480, duration: 0.035, wave: 'triangle' },
  digital: { accent: 1800, beat: 1350, duration: 0.025, wave: 'square' },
};

export const useMetronome = (bpm: number, isActive: boolean, sound: MetronomeSound = 'classic', volume = 0.6) => {
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
      const settings = soundSettings[sound];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = settings.wave;
      oscillator.frequency.value = isAccent ? settings.accent : settings.beat;
      gain.gain.setValueAtTime(Math.max(0.001, volume * 0.3), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + settings.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + settings.duration + 0.01);
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
  }, [bpm, isActive, sound, volume]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);
};
