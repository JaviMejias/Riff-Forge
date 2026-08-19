import { useState } from 'react';
import { Guitar } from 'lucide-react';

interface CollapsibleTabBlockProps {
  label: string;
  lines: string[];
  compact?: boolean;
}

export const CollapsibleTabBlock = ({ label, lines, compact = false }: CollapsibleTabBlockProps) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className={`${compact ? 'my-3' : 'my-5'} max-w-full overflow-hidden rounded-2xl border border-primary-500/15 bg-zinc-950/70 shadow-lg`}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-11 w-full items-center gap-2 border-b border-primary-500/10 bg-primary-500/5 px-3 text-left font-sans text-xs font-bold uppercase tracking-widest text-primary-400 sm:px-4"
        aria-expanded={isOpen}
      >
        <Guitar size={16} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-[10px] normal-case tracking-normal text-zinc-500">{isOpen ? 'Ocultar' : 'Mostrar tablatura'}</span>
      </button>
      {isOpen && (
        <div className="max-w-full overflow-x-auto p-3 pb-4 custom-scrollbar sm:p-4 sm:pb-5">
          <pre className="w-max min-w-full whitespace-pre font-mono text-[0.78em] leading-relaxed text-zinc-300 sm:text-[0.85em]">{lines.join('\n')}</pre>
        </div>
      )}
    </div>
  );
};
