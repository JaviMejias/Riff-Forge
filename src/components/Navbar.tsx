import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, ChevronLeft } from 'lucide-react';
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/80 backdrop-blur-xl p-4 md:px-6 md:py-4 rounded-2xl border border-white/5 shadow-lg shrink-0 w-full mb-6 relative overflow-hidden">
      {/* Brillo sutil de fondo */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />

      <div className="flex items-center gap-4 z-10 min-w-0">
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleToggle}
          className="flex p-2 text-zinc-400 hover:text-primary-400 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors border border-white/5"
          title={isDesktopSidebarOpen ? "Ocultar Menú" : "Mostrar Menú"}
        >
          {isDesktopSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </motion.button>

        {onBack && (
          <motion.button 
            whileHover={{ scale: 1.02, x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-primary-400 font-bold transition-colors bg-zinc-800/50 hover:bg-zinc-800 px-3 py-2 rounded-xl border border-white/5"
          >
            <ChevronLeft size={20} /> <span className="hidden sm:inline">Volver</span>
          </motion.button>
        )}

        <div className="flex flex-col min-w-0">
          {subtitle && <span className="text-[10px] md:text-xs font-bold text-primary-500 uppercase tracking-widest truncate block">{subtitle}</span>}
          <h1 className="text-base md:text-xl font-extrabold text-white truncate block">{title}</h1>
        </div>
      </div>

      {children && (
        <div className="flex items-center gap-3 z-10 shrink-0 w-full sm:w-auto justify-end sm:justify-start">
          {children}
        </div>
      )}
    </div>
  );
};
