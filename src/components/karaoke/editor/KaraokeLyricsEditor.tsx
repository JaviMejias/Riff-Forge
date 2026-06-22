import { useState, useRef, useEffect, Fragment } from 'react';
import { Save, MousePointerClick, Music, RotateCcw, Plus, Text, Wand2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { API_BASE_URL } from '../../../config';
import { motion } from 'framer-motion';
import { buildLrc, hasLrcTags, parseLrc, injectInstrumentals } from '../../../utils/lrcParser';
import type { LrcLine } from '../../../utils/lrcParser';
import { EditorToolbar } from './EditorToolbar';
import { SyncLineItem } from './SyncLineItem';
import Swal from 'sweetalert2';

import type { Karaoke } from '../../../db';

export interface KaraokeLyricsEditorProps {
  karaoke: Karaoke;
  initialContent: string;
  currentTime: number;
  duration?: number;
  onSave: (content: string) => void;
  onCancel: () => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange?: (speed: number) => void;
  isPlaying: boolean;
}

export type EditorMode = 'text' | 'sync';

// Estado para el insertor inline de línea nueva entre separadores
interface InlineInsertState {
  afterIndex: number; // insertar después de esta posición
  value: string;
}

export const KaraokeLyricsEditor = ({
  karaoke,
  initialContent,
  currentTime,
  onSave,
  onCancel,
  onPlay,
  onPause,
  onSeek,
  isPlaying,
  duration
}: KaraokeLyricsEditorProps) => {
  // Si ya tiene LRC, entramos directo al sincronizador para no mostrar el código crudo
  const isInitialDynamic = hasLrcTags(initialContent);
  const [mode, setMode] = useState<EditorMode>(isInitialDynamic ? 'sync' : 'text');
  
  // Text Content (for text/lrc modes)
  const [textContent, setTextContent] = useState(initialContent);
  
  // Sync Mode State
  const [syncLines, setSyncLines] = useState<LrcLine[]>(() => {
    return isInitialDynamic ? parseLrc(initialContent) : [];
  });
  const [syncIndex, setSyncIndex] = useState(0);
  const syncScrollRef = useRef<HTMLDivElement>(null);
  const activeSyncRef = useRef<HTMLDivElement>(null);

  // Magic Lyrics fetch state
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);

  const handleFetchLyrics = async () => {
    setIsFetchingLyrics(true);
    try {
      const token = useAuthStore.getState().token;
      const cleanTitle = karaoke.name.replace(/\s*\(por\s+[^)]+\)$/i, '').trim();
      const params = new URLSearchParams({ title: cleanTitle, artist: karaoke.artist || '' });
      const res = await fetch(`${API_BASE_URL}/api/karaokes/lyrics?${params}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error('Failed to fetch lyrics');
      const data = await res.json();
      
      // Procesar la letra para inyectar automáticamente [Instrumental] en pausas de >= 3.5s
      let finalLyrics = data.lyrics;
      if (hasLrcTags(finalLyrics)) {
        finalLyrics = injectInstrumentals(finalLyrics, 3.5);
      }
      
      setTextContent(finalLyrics);
    } catch (e) {
      console.error(e);
      // Fallback manual error msg
      setTextContent(textContent + (textContent ? '\n\n' : '') + 'No se pudo encontrar la letra. Ingresa manualmente.');
    } finally {
      setIsFetchingLyrics(false);
    }
  };

  // Estado del insertor inline de nueva línea
  const [inlineInsert, setInlineInsert] = useState<InlineInsertState | null>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Loop de edición: reproduce desde el inicio de la línea hasta el inicio de la siguiente
  const [editLoopStart, setEditLoopStart] = useState<number | null>(null);
  const [editLoopEnd, setEditLoopEnd] = useState<number | null>(null);

  // Mantener el bucle mientras esté activo
  useEffect(() => {
    if (editLoopStart === null || editLoopEnd === null) return;
    if (currentTime >= editLoopEnd || currentTime < editLoopStart - 0.3) {
      onSeek(editLoopStart);
    }
  }, [currentTime, editLoopStart, editLoopEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnterEditMode = (idx: number, lineTime: number) => {
    // Fin del bucle = inicio de la siguiente línea sincronizada, o la duración total
    const nextSynced = syncLines.slice(idx + 1).find(l => l.time >= 0);
    // Asegurar que loopEnd sea SIEMPRE estrictamente mayor que lineTime
    let loopEnd = nextSynced ? nextSynced.time : (duration ?? lineTime + 8);
    if (loopEnd <= lineTime) {
      loopEnd = lineTime + 5; // Fallback seguro de 5 segundos
    }
    setEditLoopStart(lineTime);
    setEditLoopEnd(loopEnd);
    onSeek(lineTime);
    onPlay();
  };

  const handleExitEditMode = () => {
    setEditLoopStart(null);
    setEditLoopEnd(null);
    onPause();
  };

  // Al entrar al modo Sync, preparamos las líneas
  // El auto-tracker fue removido para dar 100% de control manual al usuario.

  // Scroll en modo Sync
  useEffect(() => {
    if (mode === 'sync' && activeSyncRef.current && syncScrollRef.current) {
      activeSyncRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [syncIndex, mode]);

  // Focus al input inline cuando se abre
  useEffect(() => {
    if (inlineInsert !== null && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [inlineInsert]);

  // Tecla Espacio para Sincronizar en PC (solo cuando no hay input activo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
      if (mode === 'sync' && e.code === 'Space' && !isInput) {
        e.preventDefault();
        handleSyncLine();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, syncIndex, isPlaying, currentTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cálculo de progreso de sincronización
  const syncProgress = {
    done: syncLines.filter(l => l.time > 0).length,
    total: syncLines.length,
  };

  const handleSyncLine = () => {
    if (syncIndex >= syncLines.length || !isPlaying) return;
    
    setSyncLines(prev => {
      const newLines = [...prev];
      // Si currentTime es exactamente 0, forzamos a 0.01 para que pase la validación time > 0
      newLines[syncIndex] = { ...newLines[syncIndex], time: Math.max(0.01, currentTime) };
      return newLines;
    });
    setSyncIndex(syncIndex + 1);
  };

  const handleInsertInstrumental = () => {
    if (syncIndex > syncLines.length || !isPlaying) return;
    
    // Si la línea activa ya está sincronizada (el usuario saltó hacia atrás para revisarla),
    // el interludio se inserta DESPUÉS de ella. Si no está sincronizada, se inserta ANTES (en su lugar).
    const currentLineIsDone = syncLines[syncIndex]?.time >= 0;
    const insertAt = currentLineIsDone ? syncIndex + 1 : syncIndex;
    
    setSyncLines(prev => {
      const newLines = [...prev];
      newLines.splice(insertAt, 0, { time: currentTime, text: '[Instrumental]' });
      return newLines;
    });
    setSyncIndex(insertAt + 1);
  };

  const undoSync = () => {
    if (syncIndex > 0) {
      const newIndex = syncIndex - 1;
      
      setSyncLines(prev => {
        const newLines = [...prev];
        const lineToUndo = newLines[newIndex];
        
        // Si la línea a deshacer es un instrumental, la eliminamos por completo
        // para evitar que se acumulen múltiples "Instrumental" vacíos.
        if (lineToUndo.text === '[Instrumental]') {
          newLines.splice(newIndex, 1);
        } else {
          newLines[newIndex] = { ...lineToUndo, time: -1 };
        }
        return newLines;
      });
      
      setSyncIndex(newIndex);
      
      // Buscar el tiempo de la línea anterior válida para dar contexto
      let prevValidTime = 0;
      for (let i = newIndex - 1; i >= 0; i--) {
        if (syncLines[i] && syncLines[i].time >= 0) {
          prevValidTime = syncLines[i].time;
          break;
        }
      }
      
      if (newIndex > 0) {
        onSeek(Math.max(0, prevValidTime)); 
      } else {
        onSeek(0);
      }
    }
  };

  const handleDeleteLine = (targetIndex: number) => {
    setSyncLines(prev => {
      const newLines = [...prev];
      newLines.splice(targetIndex, 1);
      return newLines;
    });
    if (syncIndex > targetIndex) {
      setSyncIndex(prev => prev - 1);
    }
  };

  // MEJORA 1: Actualizar texto de una línea sin salir del modo sync
  const handleUpdateLineText = (targetIndex: number, newText: string) => {
    setSyncLines(prev =>
      prev.map((l, i) => (i === targetIndex ? { ...l, text: newText } : l))
    );
  };

  const handleJumpToLine = (targetIndex: number) => {
    // No permitir saltar más allá de la primera línea vacía
    const firstUnsynced = syncLines.findIndex(l => l.time === -1);
    const maxAllowed = firstUnsynced === -1 ? syncLines.length - 1 : firstUnsynced;
    if (targetIndex > maxAllowed) return;

    if (isPlaying) onPause();
    setSyncIndex(targetIndex);

    // Si la línea seleccionada ya tiene un tiempo, saltar 2 segundos antes
    if (syncLines[targetIndex].time >= 0) {
      onSeek(Math.max(0, syncLines[targetIndex].time - 2));
      return;
    }

    // Si la línea no tiene tiempo, buscar la anterior válida para dar contexto
    let prevValidTime = 0;
    for (let i = targetIndex - 1; i >= 0; i--) {
      if (syncLines[i].time >= 0) {
        prevValidTime = syncLines[i].time;
        break;
      }
    }
    
    if (targetIndex > 0) {
      onSeek(Math.max(0, prevValidTime - 2));
    } else {
      onSeek(0);
    }
  };

  const handleInsertInstrumentalAt = (index: number) => {
    setSyncLines(prev => {
      const newLines = [...prev];
      newLines.splice(index, 0, { time: -1, text: '[Instrumental]' });
      return newLines;
    });
    if (syncIndex >= index) {
      setSyncIndex(prev => prev + 1);
    }
  };

  // MEJORA 3: Insertar línea de letra normal desde el modo sync
  const handleInsertLineAt = (afterIndex: number) => {
    setInlineInsert({ afterIndex, value: '' });
  };

  const commitInlineInsert = () => {
    if (!inlineInsert) return;
    const trimmed = inlineInsert.value.trim();
    if (trimmed) {
      const insertAt = inlineInsert.afterIndex;
      setSyncLines(prev => {
        const newLines = [...prev];
        newLines.splice(insertAt, 0, { time: -1, text: trimmed });
        return newLines;
      });
      if (syncIndex >= insertAt) {
        setSyncIndex(prev => prev + 1);
      }
    }
    setInlineInsert(null);
  };

  const handleManualTimeChange = (idx: number, newTime: number) => {
    setSyncLines(prev => {
      const oldTime = prev[idx].time;
      const newLines = [...prev];
      
      const firstSyncedIndex = prev.findIndex(l => l.time > 0);

      // Si estamos modificando la PRIMERA línea sincronizada, aplicamos el delta a todo el resto
      if (idx === firstSyncedIndex && oldTime > 0) {
        const delta = newTime - oldTime;
        if (delta !== 0) {
          let linesShifted = 0;
          for (let i = idx; i < newLines.length; i++) {
            if (newLines[i].time > 0) {
              newLines[i] = { ...newLines[i], time: Math.max(0.01, newLines[i].time + delta) };
              linesShifted++;
            }
          }
          
          if (Math.abs(delta) >= 0.5 && linesShifted > 1) {
            Swal.fire({
              toast: true,
              position: 'bottom-end',
              icon: 'success',
              title: `Desplazamiento global aplicado: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}s`,
              showConfirmButton: false,
              timer: 3000,
              background: '#18181b',
              color: '#fff'
            });
          }
          return newLines;
        }
      }
      
      // Si no es la primera línea, solo modificamos esa línea en específico
      newLines[idx] = { ...newLines[idx], time: newTime };
      return newLines;
    });
  };

  const handleModeChange = (newMode: EditorMode) => {
    if (newMode === 'text' && mode === 'sync') {
      // Al salir de sync, pasamos los tiempos visuales al texto plano
      setTextContent(buildLrc(syncLines));
    } else if (newMode === 'sync' && mode === 'text') {
      // Al entrar a sync, parseamos lo que haya en texto plano
      const parsed = parseLrc(textContent);
      setSyncLines(parsed);
      
      let firstUnsynced = parsed.findIndex(l => l.time === -1);
      if (firstUnsynced === -1) firstUnsynced = parsed.length;
      setSyncIndex(firstUnsynced);
      
      if (firstUnsynced > 0) {
        onSeek(parsed[firstUnsynced - 1].time);
      } else {
        onSeek(0);
      }
      onPause();
    }
    setMode(newMode);
  };

  const handleSave = () => {
    if (mode === 'sync') {
      const newContent = buildLrc(syncLines);
      setTextContent(newContent);
      onSave(newContent);
    } else {
      onSave(textContent);
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-zinc-950 relative z-30">
      
      {/* HEADER */}
      <EditorToolbar 
        mode={mode} 
        setMode={handleModeChange} 
        textContent={textContent} 
        onCancel={onCancel} 
        handleSave={handleSave}
        syncProgress={mode === 'sync' ? syncProgress : undefined}
      />

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* MODO TEXTO PLANO */}
        {mode === 'text' && (
          <div className="w-full h-full relative">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full h-full p-6 sm:p-8 bg-transparent text-zinc-200 font-mono text-sm sm:text-base resize-none focus:outline-none hide-scrollbar leading-relaxed"
              placeholder={"Pega aquí la letra normal de la canción...\n\n💡 Tip: Si hay un solo de guitarra o silencio largo, escribe [Música] o [Instrumental] en una línea sola.\n\nLuego ve a 'Sincronizador' para cuadrarla con el audio."}
              spellCheck={false}
            />
            <button
              onClick={handleFetchLyrics}
              disabled={isFetchingLyrics}
              className="absolute top-4 right-4 bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/40 disabled:opacity-50 rounded-xl px-4 py-2 font-bold text-sm flex items-center gap-2 transition-all shadow-lg"
              title="Buscar letra en internet"
            >
              {isFetchingLyrics ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              <span>{isFetchingLyrics ? 'Buscando...' : 'Buscar Letra Mágica'}</span>
            </button>
          </div>
        )}

        {/* MODO SINCRONIZADOR */}
        {mode === 'sync' && (
          <div className="w-full h-full flex flex-col relative">

            {/* LISTA DE LÍNEAS */}
            <div ref={syncScrollRef} className="flex-1 overflow-y-auto p-6 sm:p-10 pb-10 hide-scrollbar scroll-smooth">
              
              {(() => {
                // Determine currently playing line index
                let currentlyPlayingIndex = -1;
                for (let i = syncLines.length - 1; i >= 0; i--) {
                  if (syncLines[i].time > 0 && currentTime >= syncLines[i].time) {
                    currentlyPlayingIndex = i;
                    break;
                  }
                }

                return syncLines.map((line, idx) => {
                  const isActive = idx === syncIndex;
                  const isDone = line.time > 0;
                  const isCurrentlyPlaying = idx === currentlyPlayingIndex;

                  return (
                    <Fragment key={idx}>
                      <SyncLineItem 
                        line={line}
                        idx={idx}
                        isActive={isActive}
                        isDone={isDone}
                        isCurrentlyPlaying={isCurrentlyPlaying}
                        activeSyncRef={isActive ? activeSyncRef : null}
                        handleJumpToLine={handleJumpToLine}
                        handleManualTimeChange={handleManualTimeChange}
                        handleDeleteLine={handleDeleteLine}
                        handleUpdateLineText={handleUpdateLineText}
                        onEnterEditMode={handleEnterEditMode}
                        onExitEditMode={handleExitEditMode}
                      />
                      
                      {/* Separador con botones de inserción */}
                      <div className="relative group/insert w-full my-1">
                        {/* Línea divisoria */}
                        <div className="h-2 sm:h-4 flex justify-center items-center">
                          <div className="w-full h-px bg-primary-500/0 lg:group-hover/insert:bg-primary-500/20 transition-all" />
                        </div>

                        {/* Insertor inline de nueva línea */}
                        {inlineInsert?.afterIndex === idx + 1 ? (
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800/80 border border-primary-500/30 rounded-xl mb-1">
                            <Text size={14} className="text-primary-400 flex-shrink-0" />
                            <input
                              ref={inlineInputRef}
                              value={inlineInsert.value}
                              onChange={(e) =>
                                setInlineInsert(prev => prev ? { ...prev, value: e.target.value } : null)
                              }
                              onBlur={commitInlineInsert}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitInlineInsert();
                                if (e.key === 'Escape') setInlineInsert(null);
                                e.stopPropagation();
                              }}
                              placeholder="Escribe la nueva línea..."
                              className="flex-1 bg-transparent text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600"
                              spellCheck={false}
                            />
                            <button
                              onMouseDown={(e) => { e.preventDefault(); commitInlineInsert(); }}
                              className="text-[10px] font-black text-primary-400 bg-primary-500/20 px-2 py-0.5 rounded-lg hover:bg-primary-500/30 transition-all"
                            >
                              OK
                            </button>
                          </div>
                        ) : (
                          /* Botones flotantes en hover */
                          <div className="opacity-0 lg:group-hover/insert:opacity-100 absolute left-1/2 -translate-x-1/2 -top-2.5 flex gap-2 z-10 transition-all">
                            <button 
                              onClick={() => handleInsertInstrumentalAt(idx + 1)}
                              className="bg-primary-500/20 text-primary-400 text-[10px] font-bold px-3 py-1 rounded-full border border-primary-500/30 hover:bg-primary-500/40 transition-all whitespace-nowrap flex items-center gap-1"
                            >
                              <Music size={10} />
                              Interludio
                            </button>
                            <button
                              onClick={() => handleInsertLineAt(idx + 1)}
                              className="bg-zinc-700/60 text-zinc-300 text-[10px] font-bold px-3 py-1 rounded-full border border-zinc-600/40 hover:bg-zinc-600/60 transition-all whitespace-nowrap flex items-center gap-1"
                            >
                              <Plus size={10} />
                              Línea
                            </button>
                          </div>
                        )}
                      </div>
                    </Fragment>
                  );
                });
              })()}
              
              {syncIndex >= syncLines.length && (
                <div className="py-10 text-center">
                  <div className="w-16 h-16 bg-primary-500/20 text-primary-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_var(--theme-glow)]">
                    <Save size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">¡Sincronización Completada!</h3>
                  <p className="text-zinc-400">Guarda los cambios arriba a la derecha.</p>
                </div>
              )}
              
              {/* Spacer invisible para que el último elemento pueda subir por encima del botón gigante */}
              <div className="h-48 sm:h-56 w-full flex-shrink-0" />
            </div>

            {/* PANEL DE CONTROL FLOTANTE PREMIUM */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-10 flex bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-1.5 gap-1.5">
              
              <button
                onClick={undoSync}
                disabled={syncIndex === 0}
                className="flex-1 h-16 bg-black/40 hover:bg-white/10 disabled:opacity-40 text-zinc-400 hover:text-white rounded-xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1 group"
                title="Deshacer la última frase sincronizada"
              >
                <RotateCcw size={20} className="group-hover:-rotate-45 transition-transform duration-300" />
                <span className="text-[10px] font-bold">Deshacer</span>
              </button>

              <button
                onClick={handleInsertInstrumental}
                disabled={!isPlaying || syncIndex >= syncLines.length}
                className="flex-1 h-16 bg-black/40 hover:bg-primary-500/10 disabled:opacity-40 text-primary-400 hover:text-primary-300 rounded-xl transition-all active:scale-95 flex flex-col items-center justify-center gap-1 group"
                title="Añadir pausa musical (Interludio)"
              >
                <Music size={20} className="group-hover:scale-110 transition-transform duration-300" />
                <span className="text-[10px] font-bold">Interludio</span>
              </button>

              <button
                onClick={handleSyncLine}
                disabled={!isPlaying || syncIndex >= syncLines.length}
                className="flex-1 h-16 bg-primary-500 hover:bg-primary-400 disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 rounded-xl shadow-[0_0_15px_var(--theme-glow)] transition-all active:scale-95 flex flex-col items-center justify-center gap-1 group relative overflow-hidden"
                title="Sincronizar la frase actual"
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="group-disabled:animate-none relative z-10"
                >
                  <MousePointerClick size={20} />
                </motion.div>
                <span className="text-[10px] font-bold relative z-10">Añadir</span>
              </button>
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
};
