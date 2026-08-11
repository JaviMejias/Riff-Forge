import { Navbar } from './Navbar';
import { ChordSelector } from './chords/ChordSelector';

interface ChordDictionaryViewProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const ChordDictionaryView = ({ isSidebarOpen, onToggleSidebar }: ChordDictionaryViewProps) => {

  return (
    <div className="flex h-full w-full flex-col px-3 py-2 sm:p-4 lg:p-6">
      <Navbar
        title="Diccionario de Acordes"
        subtitle="Acordes básicos para guitarra"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="flex-1 min-h-0 overflow-hidden mt-2 sm:mt-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl sm:rounded-3xl h-full flex flex-col overflow-hidden">
          <ChordSelector mode="full" initialRoot="C" />
        </div>
      </div>
    </div>
  );
};
