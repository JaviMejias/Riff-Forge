import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'pro' | 'cifra';

interface PlayerState {
  mainViewMode: ViewMode;
  setMainViewMode: (mode: ViewMode) => void;
  masterVolume: number;
  setMasterVolume: (vol: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  isMetronomeActive: boolean;
  setIsMetronomeActive: (active: boolean) => void;
  isLooping: boolean;
  setIsLooping: (loop: boolean) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      mainViewMode: 'pro',
      setMainViewMode: (mode) => set({ mainViewMode: mode }),
      masterVolume: 1,
      setMasterVolume: (vol) => set({ masterVolume: vol }),
      playbackSpeed: 1,
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      isMetronomeActive: false,
      setIsMetronomeActive: (active) => set({ isMetronomeActive: active }),
      isLooping: false,
      setIsLooping: (loop) => set({ isLooping: loop }),
    }),
    {
      name: 'riff-forge-player-storage',
      // Only persist these specific fields
      partialize: (state) => ({ 
        mainViewMode: state.mainViewMode,
        masterVolume: state.masterVolume 
      }),
    }
  )
);
