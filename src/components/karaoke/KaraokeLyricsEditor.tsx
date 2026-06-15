import { useState, useRef, useEffect } from 'react';
import { Save, X, RotateCcw, Edit3, AlignLeft, MousePointerClick, Play, Pause, AlertCircle } from 'lucide-react';
import { buildLrc, hasLrcTags } from '../../utils/lrcParser';
import type { LrcLine } from '../../utils/lrcParser';

export interface KaraokeLyricsEditorProps {
  initialContent: string;
  currentTime: number;
  onSave: (content: string) => void;
  onCancel: () => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  isPlaying: boolean;
}

type EditorMode = 'text' | 'sync' | 'lrc';

export const KaraokeLyricsEditor = ({
  initialContent,
  currentTime,
  onSave,
  onCancel,
  onPlay,
  onPause,
  onSeek,
  isPlaying
}: KaraokeLyricsEditorProps) => {
  // Inicialmente determinamos el modo basado en si tiene tags
  const isInitialDynamic = hasLrcTags(initialContent);
  const [mode, setMode] = useState<EditorMode>(isInitialDynamic ? 'lrc' : 'text');
  
  // Text Content (for text/lrc modes)
  const [textContent, setTextContent] = useState(initialContent);
  
  // Sync Mode State
  const [syncLines, setSyncLines] = useState<LrcLine[]>([]);
  const [syncIndex, setSyncIndex] = useState(0); // Línea que espera ser sincronizada
  const syncScrollRef = useRef<HTMLDivElement>(null);
  const activeSyncRef = useRef<HTMLDivElement>(null);

  // Al entrar al modo Sync, preparamos las líneas
  useEffect(() => {
    if (mode === 'sync') {
      // Limpiamos los tiempos existentes y preparamos las líneas limpias
      const rawLines = textContent.split('\n').filter(l => l.trim().length > 0);
      // Extraemos el texto sin los tags si los tuviera
      const cleanLines = rawLines.map(line => {
        const match = line.match(/^\[\d{2}:\d{2}(?:\.\d{2,3})?\](.*)/);
        return match ? match[1].trim() : line.trim();
      });

      setSyncLines(cleanLines.map(text => ({ time: -1, text })));
      setSyncIndex(0);
      onSeek(0);
      onPause();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll en modo Sync
  useEffect(() => {
    if (mode === 'sync' && activeSyncRef.current && syncScrollRef.current) {
      activeSyncRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [syncIndex, mode]);

  // Tecla Espacio para Sincronizar en PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'sync' && e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        handleSyncLine();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, syncIndex, isPlaying, currentTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSyncLine = () => {
    if (syncIndex >= syncLines.length || !isPlaying) return;
    
    setSyncLines(prev => {
      const newLines = [...prev];
      newLines[syncIndex] = { ...newLines[syncIndex], time: currentTime };
      return newLines;
    });
    setSyncIndex(syncIndex + 1);
  };

  const undoSync = () => {
    if (syncIndex > 0) {
      const newIndex = syncIndex - 1;
      setSyncLines(prev => {
        const newLines = [...prev];
        newLines[newIndex] = { ...newLines[newIndex], time: -1 };
        return newLines;
      });
      setSyncIndex(newIndex);
      // Retroceder un poco la música para ayudar a cuadrar
      const prevTime = syncLines[newIndex - 1]?.time || 0;
      onSeek(Math.max(0, prevTime - 1)); 
    }
  };

  const handleSave = () => {
    if (mode === 'sync') {
      // Filtrar líneas sincronizadas y construir el LRC final
      const syncedOnly = syncLines.filter(l => l.time >= 0);
      onSave(buildLrc(syncedOnly));
    } else {
      onSave(textContent);
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-zinc-950 relative z-30">
      
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 bg-zinc-800/50 p-1 rounded-xl">
          <button
            onClick={() => setMode('text')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'text' ? 'bg-primary-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-white'}`}
          >
            <AlignLeft size={16} className="inline mr-2" />
            Texto Plano
          </button>
          <button
            onClick={() => setMode('sync')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'sync' ? 'bg-amber-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-white'}`}
            disabled={!textContent.trim()}
          >
            <MousePointerClick size={16} className="inline mr-2" />
            Sincronizador
          </button>
          <button
            onClick={() => setMode('lrc')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'lrc' ? 'bg-indigo-500 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
            disabled={!hasLrcTags(textContent) && mode !== 'lrc'}
          >
            <Edit3 size={16} className="inline mr-2" />
            Código LRC
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={onCancel}
            className="p-2.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Cancelar"
          >
            <X size={20} />
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-zinc-950 rounded-xl transition-colors font-black text-sm"
          >
            <Save size={18} />
            Guardar
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* MODO TEXTO PLANO o MODO LRC */}
        {(mode === 'text' || mode === 'lrc') && (
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            className="w-full h-full p-6 sm:p-8 bg-transparent text-zinc-200 font-mono text-sm sm:text-base resize-none focus:outline-none hide-scrollbar leading-relaxed"
            placeholder={mode === 'text' 
              ? "Pega aquí la letra normal de la canción...\n\nLuego ve a la pestaña 'Sincronizador' para cuadrarla con la música." 
              : "[00:15.50] Primera línea...\n[00:18.20] Segunda línea..."
            }
            spellCheck={false}
          />
        )}

        {/* MODO SINCRONIZADOR */}
        {mode === 'sync' && (
          <div className="w-full h-full flex flex-col">
            
            {/* BARRA DE CONTROLES COMPACTA */}
            <div className="p-3 bg-zinc-900/50 border-b border-white/5 flex items-center justify-between">
              <button
                onClick={undoSync}
                disabled={syncIndex === 0}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={14} />
                Deshacer
              </button>

              <div className="flex items-center gap-4">
                {/* Info Tooltip Icon */}
                <div className="group relative flex items-center">
                  <AlertCircle size={16} className="text-zinc-500 hover:text-amber-500 cursor-help transition-colors" />
                  <div className="absolute top-full mt-2 right-0 w-56 p-3 bg-zinc-800 text-xs text-zinc-300 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    <strong className="text-amber-400 block mb-1">💡 Consejo de Sincronización</strong>
                    Usa siempre la fuente MP3 para sincronizar. Los videos de YouTube pueden tener pausas que descuadren la letra.
                  </div>
                </div>

                <button
                  onClick={isPlaying ? onPause : onPlay}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-colors ${isPlaying ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-primary-500 text-zinc-950 hover:bg-primary-400'}`}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {isPlaying ? 'Pausar' : 'Reproducir'}
                </button>
              </div>
            </div>

            {/* LISTA DE LÍNEAS */}
            <div ref={syncScrollRef} className="flex-1 overflow-y-auto p-6 sm:p-10 pb-[250px] hide-scrollbar scroll-smooth">
              {syncLines.map((line, idx) => {
                const isActive = idx === syncIndex;
                const isDone = idx < syncIndex;

                return (
                  <div 
                    key={idx}
                    ref={isActive ? activeSyncRef : null}
                    className={`py-3 px-4 rounded-xl mb-2 flex items-center gap-4 transition-all duration-300 ${
                      isActive 
                        ? 'bg-amber-500/10 border border-amber-500/30 scale-105 origin-left' 
                        : isDone 
                          ? 'opacity-50' 
                          : 'opacity-30'
                    }`}
                  >
                    <div className="w-16 flex-shrink-0 text-xs font-mono text-zinc-500">
                      {isDone 
                        ? `${Math.floor(line.time / 60).toString().padStart(2, '0')}:${Math.floor(line.time % 60).toString().padStart(2, '0')}`
                        : '--:--'}
                    </div>
                    <p className={`font-sans text-xl sm:text-2xl font-black ${isActive ? 'text-amber-500' : isDone ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {line.text}
                    </p>
                  </div>
                );
              })}
              
              {syncIndex >= syncLines.length && (
                <div className="py-10 text-center">
                  <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Save size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">¡Sincronización Completada!</h3>
                  <p className="text-zinc-400">Guarda los cambios arriba a la derecha.</p>
                </div>
              )}
            </div>

            {/* BOTÓN GIGANTE FLOTANTE */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md">
              <button
                onClick={handleSyncLine}
                disabled={!isPlaying || syncIndex >= syncLines.length}
                className="w-full h-20 sm:h-24 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border-zinc-700 text-zinc-950 rounded-2xl shadow-[0_10px_40px_rgba(245,158,11,0.3)] disabled:shadow-none border-b-4 border-amber-600 disabled:translate-y-1 transition-all active:translate-y-1 active:border-b-0 flex flex-col items-center justify-center gap-1 group"
              >
                <MousePointerClick size={24} className="group-disabled:opacity-50 group-active:scale-90 transition-transform" />
                <span className="font-black text-lg sm:text-xl uppercase tracking-widest">Tap Aquí</span>
                <span className="text-[10px] font-bold opacity-80">Pulsa justo cuando empiece la frase</span>
              </button>
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
};
