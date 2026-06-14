import { Navbar } from './Navbar';
import { ChordSelector } from './chords/ChordSelector';

interface ChordDictionaryViewProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const ChordDictionaryView = ({ isSidebarOpen, onToggleSidebar }: ChordDictionaryViewProps) => {

  return (
    <div className="flex flex-col h-full w-full p-8">
      <Navbar
        title="Diccionario de Acordes"
        subtitle="Acordes básicos para guitarra"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="flex-1 overflow-hidden mt-6">
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-4 sm:p-6 h-full flex flex-col">
          <ChordSelector mode="full" initialRoot="C" />
        </div>
      </div>
    </div>
  );
};
