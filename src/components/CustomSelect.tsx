import { useState, useRef, useEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const colorStyles = theme === 'amber' 
    ? {
        borderHover: 'hover:border-amber-500/50',
        focusRing: 'focus:ring-amber-500/50',
        textHighlight: 'text-amber-400',
        bgHover: 'hover:bg-amber-500/10 hover:text-amber-300',
        bgSelected: 'bg-amber-500/20 text-amber-200 border-l-2 border-amber-500'
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
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full bg-zinc-950/80 border ${isOpen ? colorStyles.borderHover : 'border-white/10'} text-zinc-200 font-medium text-sm rounded-xl px-4 py-2 outline-none cursor-pointer disabled:opacity-50 transition-colors ${colorStyles.borderHover}`}
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
            className={`absolute z-50 w-full ${dropup ? 'bottom-full mb-2 origin-bottom' : 'mt-2 origin-top'} bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar`}
          >
            <div className="flex flex-col p-1 gap-0.5">
              {options.map((option) => {
                const isSelected = String(option.value) === String(value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`text-left px-3 py-2 text-sm rounded-lg transition-colors truncate ${
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
