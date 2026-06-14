import { create } from 'zustand';

interface UiState {
  isMobileMenuOpen: boolean;
  isDesktopSidebarOpen: boolean;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
  toggleDesktopSidebar: () => void;
  setDesktopSidebarOpen: (isOpen: boolean) => void;
  isImmersiveMode: boolean;
  toggleImmersiveMode: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isMobileMenuOpen: false,
  isDesktopSidebarOpen: true,
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  setMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),
  toggleDesktopSidebar: () => set((state) => ({ isDesktopSidebarOpen: !state.isDesktopSidebarOpen })),
  setDesktopSidebarOpen: (isOpen) => set({ isDesktopSidebarOpen: isOpen }),
  isImmersiveMode: false,
  toggleImmersiveMode: () => set((state) => {
    const nextState = !state.isImmersiveMode;
    if (nextState) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
    return { isImmersiveMode: nextState };
  }),
}));
