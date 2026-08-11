import { useId, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  disabled?: boolean;
  className?: string;
  theme?: 'amber' | 'sky';
  dropup?: boolean;
}

export const CustomSelect = ({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  theme = 'amber',
  dropup = false
}: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => optionRefs.current[focusedIndex]?.focus());
  }, [focusedIndex, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const toggleSelect = () => {
    if (disabled) return;
    if (!isOpen) {
      const selectedIndex = options.findIndex((option) => String(option.value) === String(value));
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
    setIsOpen((open) => !open);
  };

  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (options.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (focusedIndex + direction + options.length) % options.length;
      setFocusedIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0 : options.length - 1;
      setFocusedIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(focusedIndex);
    }
  };

  const colorStyles = theme === 'amber' 
    ? {
        borderHover: 'hover:border-primary-500/50',
        focusRing: 'focus:ring-primary-500/50',
        textHighlight: 'text-primary-400',
        bgHover: 'hover:bg-primary-500/10 hover:text-primary-300',
        bgSelected: 'bg-primary-500/20 text-primary-200 border-l-2 border-primary-500'
      }
    : {
        borderHover: 'hover:border-sky-500/50',
        focusRing: 'focus:ring-sky-500/50',
        textHighlight: 'text-sky-400',
        bgHover: 'hover:bg-sky-500/10 hover:text-sky-300',
        bgSelected: 'bg-sky-500/20 text-sky-200 border-l-2 border-sky-500'
      };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleSelect}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        className={`min-h-10 flex items-center justify-between w-full bg-zinc-950/80 border ${isOpen ? colorStyles.borderHover : 'border-white/10'} text-zinc-200 font-medium text-sm rounded-xl px-4 py-2 outline-none cursor-pointer disabled:opacity-50 transition-colors ${colorStyles.borderHover}`}
      >
        <span className="truncate pr-2">{selectedOption?.label ?? 'Seleccionar'}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={16} className={isOpen ? colorStyles.textHighlight : 'text-zinc-500'} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropup ? 10 : -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropup ? 10 : -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            id={listboxId}
            className={`custom-select-listbox fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[110] max-h-[min(55dvh,22rem)] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/98 shadow-2xl shadow-black/60 backdrop-blur-xl custom-scrollbar sm:absolute sm:inset-x-auto sm:z-50 sm:w-full sm:max-h-60 sm:rounded-xl ${dropup ? 'sm:bottom-full sm:mb-2 sm:origin-bottom' : 'sm:top-full sm:mt-2 sm:origin-top'}`}
            role="listbox"
            onKeyDown={handleListKeyDown}
          >
            <div className="flex flex-col p-1 gap-0.5">
              {options.map((option, index) => {
                const isSelected = String(option.value) === String(value);
                return (
                  <button
                    key={option.value}
                    ref={(element) => { optionRefs.current[index] = element; }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={focusedIndex === index ? 0 : -1}
                    onFocus={() => setFocusedIndex(index)}
                    onClick={() => selectOption(index)}
                    className={`min-h-11 text-left px-3 py-2 text-sm rounded-lg transition-colors truncate sm:min-h-10 ${
                      isSelected 
                        ? colorStyles.bgSelected
                        : `text-zinc-300 ${colorStyles.bgHover}`
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
