import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  size?: 'default' | 'wide';
}

export const Modal = ({ isOpen, onClose, title, subtitle, icon, children, size = 'default' }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusModal = window.requestAnimationFrame(() => {
      const modal = modalRef.current;
      if (!modal || modal.contains(document.activeElement)) return;
      const firstFocusable = modal.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      (firstFocusable || modal).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = modalRef.current;
      if (!modal) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusModal);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          onClick={onClose}
            aria-hidden="true"
            className="absolute inset-0 bg-zinc-950/70 backdrop-blur-md"
          />

        {/* Modal Container */}
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`app-modal relative w-full ${size === 'wide' ? 'h-[calc(100dvh-0.75rem)] max-w-6xl sm:h-[92vh]' : 'max-w-md'} bg-zinc-900 border border-white/10 border-t-primary-500/30 rounded-t-3xl sm:rounded-3xl shadow-[0_10px_40px_var(--theme-glow)] overflow-hidden flex flex-col max-h-[calc(100dvh-0.75rem)] sm:max-h-[92vh] pb-[env(safe-area-inset-bottom)] sm:pb-0`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 p-4 sm:p-6 sm:pb-4 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="bg-primary-500/20 p-2 rounded-xl text-primary-500">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2 id={titleId} className="text-xl sm:text-2xl font-black text-white leading-tight">{title}</h2>
                {subtitle && <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 line-clamp-2">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 shrink-0 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-all"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          {children}
        </motion.div>
      </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
