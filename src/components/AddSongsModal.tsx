import { useState, useMemo } from 'react';
import { PlusCircle, Search, X } from 'lucide-react';
import { Modal } from './Modal';

interface SelectableLibraryItem {
  id?: number;
  name: string;
  artist?: string;
  album?: string;
}

interface AddSongsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (itemIds: number[]) => void;
  availableItems: SelectableLibraryItem[];
  title?: string;
  itemLabel?: string;
  renderItem?: (item: SelectableLibraryItem, isSelected: boolean, onSelect: () => void) => React.ReactNode;
}

export const AddSongsModal = ({ 
  isOpen, 
  onClose, 
  onAdd, 
  availableItems,
  title = "Añadir Canciones",
  itemLabel = "Canciones"
}: AddSongsModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(10);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return availableItems;
    const lowerQuery = searchQuery.toLowerCase();
    return availableItems.filter(s => 
      s.name?.toLowerCase().includes(lowerQuery) || 
      (s.artist && s.artist.toLowerCase().includes(lowerQuery)) ||
      (s.album && s.album.toLowerCase().includes(lowerQuery))
    );
  }, [availableItems, searchQuery]);

  const displayedItems = filteredItems.slice(0, visibleCount);

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleConfirm = () => {
    onAdd(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSearchQuery('');
    setVisibleCount(10);
    onClose();
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    setVisibleCount(10);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={`Busca y selecciona ${itemLabel.toLowerCase()} a incluir.`}
      icon={<PlusCircle size={24} />}
    >
      <div className="flex flex-col flex-1 min-h-0 sm:h-[60vh] sm:max-h-[600px]">
        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              aria-label="Buscar canciones para añadir"
              placeholder="Buscar por título, artista o álbum..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-11 bg-zinc-950/80 border border-white/10 rounded-xl py-3 pl-10 pr-11 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600"
            />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-zinc-500 hover:text-white" aria-label="Limpiar búsqueda"><X size={17} /></button>}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 flex flex-col gap-2 sm:gap-3">
          {displayedItems.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No hay {itemLabel.toLowerCase()} disponibles para añadir.</p>
          ) : (
            displayedItems.map((item) => (
              <div 
                key={item.id} 
                onClick={() => item.id !== undefined && toggleSelection(item.id)}
                className={`min-h-14 p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  item.id !== undefined && selectedIds.has(item.id)
                    ? 'bg-primary-500/20 border-primary-500 text-primary-400' 
                    : 'bg-zinc-900 border-white/5 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <div>
                  <h4 className="font-bold">{item.name}</h4>
                  <p className="text-xs opacity-70">{item.artist || 'Desconocido'}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  item.id !== undefined && selectedIds.has(item.id) ? 'border-primary-500 bg-primary-500' : 'border-zinc-500'
                }`}>
                  {item.id !== undefined && selectedIds.has(item.id) && <div className="w-2.5 h-2.5 rounded-full bg-zinc-950" />}
                </div>
              </div>
            ))
          )}

          {visibleCount < filteredItems.length && (
            <button
              onClick={() => setVisibleCount(v => v + 10)}
              className="mt-2 min-h-11 py-2 text-zinc-400 hover:text-primary-400 font-bold transition-colors text-sm"
            >
              Cargar más...
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-white/5 bg-zinc-900 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
          <span className="text-sm font-bold text-zinc-400 w-full sm:w-auto text-center sm:text-left">
            {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={handleClose}
              className="w-full sm:w-auto min-h-11 px-5 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="w-full sm:w-auto min-h-11 px-6 py-2.5 rounded-xl font-bold bg-primary-500 text-zinc-950 hover:bg-primary-400 transition-all shadow-[0_0_20px_var(--theme-glow)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Añadir a la lista
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
