import { AlignLeft, MousePointerClick, Save } from 'lucide-react';
import type { EditorMode } from './KaraokeLyricsEditor';

interface SyncProgress {
  done: number;
  total: number;
}

interface EditorToolbarProps {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  textContent: string;
  onCancel: () => void;
  handleSave: () => void;
  syncProgress?: SyncProgress;
}

export const EditorToolbar = ({
  mode,
  setMode,
  textContent,
  handleSave,
  syncProgress,
}: EditorToolbarProps) => {
  const progressPercent =
    syncProgress && syncProgress.total > 0
      ? Math.round((syncProgress.done / syncProgress.total) * 100)
      : 0;

  return (
    <div className="flex items-center justify-between p-3 border-b border-white/5 bg-zinc-900/50 backdrop-blur-sm gap-2">

      {/* PESTAÑAS — solo 2 ahora */}
      <div className="flex items-center gap-1 bg-zinc-900/60 backdrop-blur-md border border-white/5 p-1 rounded-2xl flex-shrink-0">
        <button
          onClick={() => setMode('text')}
          title="Texto Plano"
          className={`px-2 xl:px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center justify-center gap-1.5 ${
            mode === 'text'
              ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-[0_0_15px_var(--theme-glow)]'
              : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
          }`}
        >
          <AlignLeft size={15} />
          <span className="hidden xl:inline whitespace-nowrap">Texto Plano</span>
        </button>
        <button
          onClick={() => setMode('sync')}
          disabled={!textContent.trim()}
          title="Sincronizador"
          className={`px-2 xl:px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === 'sync'
              ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-[0_0_15px_var(--theme-glow)]'
              : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200 border border-transparent'
          }`}
        >
          <MousePointerClick size={15} />
          <span className="hidden xl:inline whitespace-nowrap">Sincronizador</span>
        </button>
      </div>

      {/* CENTRO: CONTADOR DE PROGRESO (solo modo sync) */}
      {mode === 'sync' && syncProgress && syncProgress.total > 0 && (
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0 px-1">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-xs font-bold">
              <span className="text-primary-400">{syncProgress.done}</span>
              <span className="text-zinc-600">/{syncProgress.total}</span>
            </span>
            {syncProgress.done === syncProgress.total && (
              <span className="text-[10px] font-black text-primary-400 animate-pulse">✓</span>
            )}
          </div>
          {/* Mini barra de progreso */}
          <div className="w-full max-w-[80px] h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* DERECHA: GUARDAR */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 rounded-xl transition-all font-black text-xs shadow-[0_0_15px_var(--theme-glow)] hover:shadow-[0_0_25px_var(--theme-glow-strong)] hover:-translate-y-0.5 active:scale-95"
        >
          <Save size={15} />
          <span className="hidden sm:inline">Guardar</span>
        </button>
      </div>
    </div>
  );
};
