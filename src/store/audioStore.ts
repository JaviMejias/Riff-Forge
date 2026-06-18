import { create } from 'zustand';

interface AudioStore {
  globalIsPlaying: boolean;
  setGlobalIsPlaying: (playing: boolean) => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  globalIsPlaying: false,
  setGlobalIsPlaying: (playing) => set({ globalIsPlaying: playing }),
}));
