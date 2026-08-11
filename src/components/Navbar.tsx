import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, ChevronLeft, Menu } from 'lucide-react';
import { useUiStore } from '../store/uiStore';

interface NavbarProps {
  title: string;
  subtitle?: string;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onBack?: () => void;
  children?: ReactNode;
}

export const Navbar = ({ title, subtitle, onBack, children }: NavbarProps) => {
  const { isDesktopSidebarOpen, toggleDesktopSidebar, setMobileMenuOpen } = useUiStore();

  const handleToggle = () => {
    if (window.innerWidth < 768) {
      setMobileMenuOpen(true);
    } else {
      toggleDesktopSidebar();
    }
  };
  return (
    <header className="app-navbar flex min-h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-white/5 bg-zinc-950/80 px-3 py-2.5 backdrop-blur-xl sm:gap-4 sm:rounded-2xl sm:border sm:bg-zinc-900/80 sm:p-4 md:px-6 md:py-4 relative z-30">
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="flex min-w-0 items-center gap-2.5 sm:gap-4 z-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleToggle}
          aria-label={isDesktopSidebarOpen ? "Ocultar menú" : "Mostrar menú"}
          className="flex min-h-11 min-w-11 items-center justify-center text-zinc-400 hover:text-primary-400 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors border border-white/5"
          title={isDesktopSidebarOpen ? "Ocultar Menú" : "Mostrar Menú"}
        >
          <Menu size={21} className="md:hidden" />
          {isDesktopSidebarOpen
            ? <PanelLeftClose size={20} className="hidden md:block" />
            : <PanelLeftOpen size={20} className="hidden md:block" />}
        </motion.button>

        {onBack && (
          <motion.button
            whileHover={{ scale: 1.02, x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            aria-label="Volver"
            className="flex min-h-11 items-center gap-2 text-zinc-400 hover:text-primary-400 font-bold transition-colors bg-zinc-800/50 hover:bg-zinc-800 px-3 py-2 rounded-xl border border-white/5"
          >
            <ChevronLeft size={20} /> <span className="hidden sm:inline">Volver</span>
          </motion.button>
        )}

        <div className="flex flex-col min-w-0">
          {subtitle && <span className="hidden text-[10px] font-bold uppercase tracking-widest text-primary-500 truncate sm:block md:text-xs">{subtitle}</span>}
          <h1 className="block truncate bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-base font-extrabold text-transparent sm:text-lg md:text-xl">{title}</h1>
        </div>
      </div>

      {children && (
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 z-10">
          {children}
        </div>
      )}
    </header>
  );
};
