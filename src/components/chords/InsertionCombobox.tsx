import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Plus, Search } from 'lucide-react';

export interface InsertionItem {
  id: string;
  label: string;
  detail?: string;
  icon?: ReactNode;
}

interface InsertionComboboxProps {
  items: InsertionItem[];
  placeholder: string;
  emptyMessage: string;
  ariaLabel: string;
  canInsert?: boolean;
  onInsert: (item: InsertionItem) => void;
}

const getSearchRelevance = (label: string, query: string) => (
  label === query ? 0 : label.startsWith(query) ? 1 : 2
);

export const InsertionCombobox = ({ items, placeholder, emptyMessage, ariaLabel, canInsert = true, onInsert }: InsertionComboboxProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InsertionItem | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => items
    .filter((item) => !normalizedQuery || item.label.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => {
      const leftLabel = left.label.toLowerCase();
      const rightLabel = right.label.toLowerCase();
      return getSearchRelevance(leftLabel, normalizedQuery) - getSearchRelevance(rightLabel, normalizedQuery)
        || leftLabel.length - rightLabel.length
        || leftLabel.localeCompare(rightLabel);
    })
    .slice(0, 12), [items, normalizedQuery]);
  const exactMatch = items.find((item) => item.label.toLowerCase() === normalizedQuery);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectItem = (item: InsertionItem) => {
    setQuery(item.label);
    setSelectedItem(item);
    setIsOpen(false);
  };

  const itemToInsert = selectedItem?.label.toLowerCase() === normalizedQuery ? selectedItem : exactMatch;

  return (
    <div ref={containerRef} className="relative min-w-48 flex-1 sm:max-w-xs">
      <div className="flex h-10 items-center rounded-xl border border-white/10 bg-zinc-950 focus-within:border-primary-500/50">
        <Search size={15} className="ml-3 shrink-0 text-zinc-500" />
        <input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedItem(null); setIsOpen(true); }} onFocus={() => setIsOpen(true)} onKeyDown={(event) => {
          if (event.key === 'Enter' && (exactMatch || matches[0])) {
            event.preventDefault();
            selectItem(exactMatch || matches[0]);
          }
          if (event.key === 'Escape') setIsOpen(false);
        }} className="min-w-0 flex-1 bg-transparent px-2 text-sm font-bold text-primary-300 outline-none placeholder:font-normal placeholder:text-zinc-600" placeholder={placeholder} role="combobox" aria-label={ariaLabel} aria-expanded={isOpen} />
        <button type="button" disabled={!itemToInsert || !canInsert} onClick={() => itemToInsert && onInsert(itemToInsert)} className="flex h-9 w-10 items-center justify-center border-l border-white/5 text-zinc-500 transition-colors hover:text-primary-300 disabled:opacity-30" title={canInsert ? 'Insertar selección' : 'Primero ubica el cursor en el código'} aria-label="Insertar selección"><Plus size={15} /></button>
      </div>

      {isOpen && (
        <div role="listbox" className="absolute left-0 right-0 top-full z-[120] mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 p-1.5 shadow-2xl custom-scrollbar">
          {matches.map((item) => (
            <button key={item.id} type="button" role="option" aria-selected={itemToInsert?.id === item.id} onClick={() => selectItem(item)} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-zinc-800">
              <span className="text-primary-400">{item.icon}</span>
              <span className="text-sm font-bold text-zinc-100">{item.label}</span>
              {item.detail && <span className="ml-auto text-[10px] text-zinc-500">{item.detail}</span>}
              {itemToInsert?.id === item.id && <Check size={14} className="text-primary-400" />}
            </button>
          ))}
          {matches.length === 0 && <p className="px-3 py-5 text-center text-xs text-zinc-500">{emptyMessage}</p>}
        </div>
      )}
    </div>
  );
};
