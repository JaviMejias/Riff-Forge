import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  isMobileMenuOpen: boolean;
  isDesktopSidebarOpen: boolean;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
  toggleDesktopSidebar: () => void;
  setDesktopSidebarOpen: (isOpen: boolean) => void;
  isImmersiveMode: boolean;
  toggleImmersiveMode: () => void;
  theme: string;
  setTheme: (theme: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
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
          document.documentElement.requestFullscreen().then(() => {
            // Intentar bloquear la pantalla en horizontal
            if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
              window.screen.orientation.lock('landscape').catch(() => {
                console.warn('La API de orientación no está soportada o fue bloqueada por el navegador.');
              });
            }
          }).catch(() => {});
        } else {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
            window.screen.orientation.unlock();
          }
        }
        return { isImmersiveMode: nextState };
      }),
      theme: 'amber',
      setTheme: (theme) => set(() => {
        // Remove existing theme classes from html
        const html = document.documentElement;
        html.classList.forEach(className => {
          if (className.startsWith('theme-')) {
            html.classList.remove(className);
          }
        });
        
        // Add new theme class if not default (amber doesn't need class as it's the root default, but we can add theme-amber for consistency if needed, wait, root default is fine without class, but let's just add it if it's not amber)
        if (theme !== 'amber') {
          html.classList.add(`theme-${theme}`);
        }
        
        setTimeout(() => window.dispatchEvent(new Event('trigger-auto-sync')), 100);
        return { theme };
      }),
    }),
    {
      name: 'ui-storage', // name of the item in the storage (must be unique)
      partialize: (state) => ({ theme: state.theme }), // Only save the theme
    }
  )
);
