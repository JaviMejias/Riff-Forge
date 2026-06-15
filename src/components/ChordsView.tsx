import * as alphaTab from '@coderline/alphatab';
import { ArrowUp, ArrowDown, RotateCcw, Guitar, Volume2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import ChordSheetJS from 'chordsheetjs';
import type { Song } from '../db';
import { openEditChordModal } from './EditChordModal';
import { db } from '../db';
import { getChord } from '../chords';
import { ChordBox } from './ChordBox';
import { playChordAudio } from '../audio';

import { InteractiveChord } from './chords/InteractiveChord';
import { TonalidadTooltip } from './chords/TonalidadTooltip';
import { AfinacionTooltip } from './chords/AfinacionTooltip';
import { Button } from './ui/Button';
import { Edit2, CheckCircle2, X } from 'lucide-react';

const CSJS = (ChordSheetJS as any).default || ChordSheetJS;

interface ChordsViewProps {
  track: alphaTab.model.Track | null;
  songTitle: string;
  song?: Song;
}

export const ChordsView = ({ track, songTitle, song }: ChordsViewProps) => {
  // Extraer letras y acordes del modelo de AlphaTab
  // Agruparemos por compases (bars) para mantener un flujo lógico.

  const extractChordsAndLyrics = () => {
    if (!track || !track.staves || track.staves.length === 0) return [];

    const lines: Array<{ chords: string[], lyrics: string[], type: 'content' | 'empty' }> = [];

    // AlphaTab puede tener múltiples estrofas (líneas de letras). Por simplicidad usaremos la línea 0.
    let currentChords: string[] = [];
    let currentLyrics: string[] = [];
    let hasContent = false;

    // Configuración para agrupar en líneas visuales (ej. cada 4 compases es una línea)
    const BARS_PER_LINE = 4;

    track.staves[0].bars.forEach((bar, index) => {
      let barHasContent = false;

      bar.voices.forEach(voice => {
        voice.beats.forEach(beat => {
          let chordStr = '';
          let lyricStr = '';

          if (beat.chord && beat.chord.name) {
            chordStr = beat.chord.name;
            barHasContent = true;
            hasContent = true;
          }

          if (beat.lyrics && beat.lyrics.length > 0 && beat.lyrics[0]) {
            lyricStr = beat.lyrics[0];
            barHasContent = true;
            hasContent = true;
          }

          if (chordStr || lyricStr) {
            // Sincronizar espacios: si hay acorde pero no letra, rellenar.
            currentChords.push(chordStr);
            currentLyrics.push(lyricStr);
          }
        });
      });

      // Añadir un separador de compás si hubo contenido
      if (barHasContent) {
        currentChords.push(' | ');
        currentLyrics.push('   ');
      }

      // Si llegamos al límite de compases por línea, guardamos la línea
      if ((index + 1) % BARS_PER_LINE === 0) {
        lines.push({
          chords: [...currentChords],
          lyrics: [...currentLyrics],
          type: hasContent ? 'content' : 'empty'
        });
        currentChords = [];
        currentLyrics = [];
        hasContent = false;
      }
    });

    // Añadir restos
    if (currentChords.length > 0 || currentLyrics.length > 0) {
      lines.push({
        chords: [...currentChords],
        lyrics: [...currentLyrics],
        type: hasContent ? 'content' : 'empty'
      });
    }

    return lines;
  };

  const location = useLocation();
  const [transposeDelta, setTransposeDelta] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editOriginalKey, setEditOriginalKey] = useState('');
  const [editTuning, setEditTuning] = useState('');
  const [editCapo, setEditCapo] = useState('');
  const [editStrummingPattern, setEditStrummingPattern] = useState('');

  const populateEditState = () => {
    if (!song) return;
    setEditContent(song.textContent || '');
    setEditOriginalKey(song.originalKey || '');
    setEditTuning(song.tuning || '');
    setEditCapo(song.capo || '');
    setEditStrummingPattern(song.strummingPattern || '');
    setIsEditing(true);
  };

  // Auto-open editor if requested
  useEffect(() => {
    if (location.state?.autoEdit && song) {
      populateEditState();
      // Clean up state so it doesn't trigger again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, song]);

  const handleEditClick = () => {
    populateEditState();
  };

  const handleSaveEdit = async () => {
    if (song && song.id) {
      const updates = {
        textContent: editContent,
        originalKey: editOriginalKey.trim() || undefined,
        tuning: editTuning.trim() || undefined,
        capo: editCapo.trim() || undefined,
        strummingPattern: editStrummingPattern.trim() || undefined
      };
      
      await db.songs.update(song.id, updates);
      
      // Update local object so UI reflects it immediately
      song.textContent = updates.textContent;
      song.originalKey = updates.originalKey;
      song.tuning = updates.tuning;
      song.capo = updates.capo;
      song.strummingPattern = updates.strummingPattern;
      
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const [isTransposeMenuOpen, setIsTransposeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const handleChordReplace = async (oldChord: string, newChord: string) => {
    if (!song || !song.id || !song.textContent) return;
    
    let newContent = song.textContent;
    
    // Escape special chars in oldChord
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedOld = escapeRegExp(oldChord);
    
    // 1. Reemplazar [C] por [Cadd9]
    newContent = newContent.replace(new RegExp(`\\[${escapedOld}\\]`, 'g'), `[${newChord}]`);
    
    // 2. Reemplazar " C " por " Cadd9 " en lineas de acordes o al final/inicio, también con guiones o barras de compás
    const regex = new RegExp(`(^|[\\s\\-\\|])${escapedOld}(?=[\\s\\-\\|]|$)`, 'gm');
    newContent = newContent.replace(regex, `$1${newChord}`);
    
    await db.songs.update(song.id, { textContent: newContent });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsTransposeMenuOpen(false);
      }
    };
    if (isTransposeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTransposeMenuOpen]);
  const [showChordsSummary, setShowChordsSummary] = useState(true);

  // CHROMATIC LOGIC
  const CHROMATIC_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  const getOriginalRoot = () => {
    if (song?.originalKey) {
      const match = song.originalKey.match(/^[A-G][#b]?/);
      if (match) {
        let root = match[0];
        if (root === 'C#') return 'Db';
        if (root === 'D#') return 'Eb';
        if (root === 'Gb') return 'F#';
        if (root === 'G#') return 'Ab';
        if (root === 'A#') return 'Bb';
        return root;
      }
    }
    
    // Guess from parsed text
    try {
      const parser = new CSJS.UltimateGuitarParser();
      const tempSong = parser.parse(song?.textContent || '');
      if (tempSong && tempSong.lines) {
        for (const line of tempSong.lines) {
          for (const item of line.items) {
            if (item instanceof CSJS.ChordLyricsPair && item.chords) {
              const match = item.chords.match(/^[A-G][#b]?/);
              if (match) {
                let root = match[0];
                if (root === 'C#') return 'Db';
                if (root === 'D#') return 'Eb';
                if (root === 'Gb') return 'F#';
                if (root === 'G#') return 'Ab';
                if (root === 'A#') return 'Bb';
                return root;
              }
            }
          }
        }
      }
    } catch(e) {}
    return 'C';
  };

  const originalRoot = getOriginalRoot();
  const originalIndex = CHROMATIC_SCALE.indexOf(originalRoot) !== -1 ? CHROMATIC_SCALE.indexOf(originalRoot) : 0;
  
  let currentIndex = (originalIndex + transposeDelta) % 12;
  if (currentIndex < 0) currentIndex += 12;
  const currentRoot = CHROMATIC_SCALE[currentIndex];

  // DEBUGGING TEXT CONTENT
  if (song && (song.type === 'text' || song.textContent)) {
    let parsedSong;
    try {
      const parser = new CSJS.UltimateGuitarParser();
      parsedSong = parser.parse(song.textContent || '');
    } catch (e) {
      return (
        <div className="bg-zinc-50 min-h-screen rounded-2xl p-8 md:p-12 shadow-2xl relative border border-white/10 text-zinc-900 font-sans flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error al procesar el texto</h2>
          <p className="text-zinc-600">{String(e)}</p>
        </div>
      );
    }

    let displaySong = parsedSong;
    if (transposeDelta !== 0 && parsedSong.transpose) {
      displaySong = parsedSong.transpose(transposeDelta);
    }

    const uniqueChords = new Set<string>();

    // GUITAR-FRIENDLY CHORD NORMALIZATION (Cifra Club Style)
    // Cifra Club fuerza *todos* los bemoles comunes a sostenidos para facilitar la lectura a guitarristas,
    // ¡incluso cuando la tonalidad de la canción se describe en bemoles (como Eb o Bb)!
    if (displaySong && displaySong.lines) {
      displaySong.lines.forEach((line: any) => {
        // Pre-check if line is a Tab line
        const combinedText = line.items.map((item: any) => {
          if (item instanceof CSJS.ChordLyricsPair) return (item.chords || '') + (item.lyrics || '');
          if (item instanceof CSJS.Literal) return item.string;
          return '';
        }).join('');
        
        const isTabLine = /^[A-Ga-g][#b]?\|/.test(combinedText.trim()) || combinedText.includes('|--') || combinedText.includes('|-');
        if (isTabLine) return; // Skip tab lines completely

        line.items.forEach((item: any) => {
          if (item instanceof CSJS.ChordLyricsPair && item.chords) {
            let c = item.chords;
            c = c.replace(/Gb/g, 'F#');
            c = c.replace(/Db/g, 'C#');
            c = c.replace(/Ab/g, 'G#');
            c = c.replace(/Eb/g, 'D#');
            c = c.replace(/Bb/g, 'A#');
            item.chords = c;

            const trimmed = c.trim();
            if (trimmed) {
              uniqueChords.add(trimmed);
            }
          }
        });
      });
    }

    return (
      <div className="flex flex-col gap-6 w-full mt-6">
        {/* Botón de edición movido a la barra de metadatos inferior */}

        {isEditing && (
          <div className="bg-zinc-900 border border-primary-500/30 rounded-3xl p-6 shadow-xl w-full flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-primary-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                <Edit2 size={16} /> Modo Edición
              </h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" icon={<X size={16} />} onClick={handleCancelEdit}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" icon={<CheckCircle2 size={16} />} onClick={handleSaveEdit}>
                  Guardar Cambios
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-zinc-950/50 p-4 rounded-2xl border border-white/5">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Tono Original</label>
                <input type="text" className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary-500/50" value={editOriginalKey} onChange={e => setEditOriginalKey(e.target.value)} placeholder="Ej: G, Am" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Afinación</label>
                <input type="text" className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary-500/50" value={editTuning} onChange={e => setEditTuning(e.target.value)} placeholder="Ej: Drop D, Eb" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Capo</label>
                <input type="text" className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary-500/50" value={editCapo} onChange={e => setEditCapo(e.target.value)} placeholder="Ej: Traste 2" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Rasgueo</label>
                <input type="text" className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary-500/50" value={editStrummingPattern} onChange={e => setEditStrummingPattern(e.target.value)} placeholder="Ej: D DU U DU" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <textarea
                className="w-full h-[600px] bg-zinc-950 text-zinc-100 font-mono text-sm sm:text-base p-6 rounded-xl border border-white/10 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 resize-y custom-scrollbar whitespace-pre"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                spellCheck={false}
              />
              <p className="text-zinc-500 text-xs">Asegúrate de encerrar los acordes entre corchetes [C] para que el sistema los detecte correctamente.</p>
            </div>
          </div>
        )}

        {!isEditing && uniqueChords.size > 0 && (
          <div className="bg-zinc-900/30 rounded-3xl p-6 border border-white/5 shadow-xl relative">
            <div className="flex items-center justify-between">
              <h3 className="text-zinc-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                <Guitar size={14} className="text-primary-500" />
                Acordes de la canción ({uniqueChords.size})
              </h3>
              <button 
                onClick={() => setShowChordsSummary(!showChordsSummary)}
                className="text-zinc-400 hover:text-primary-400 transition-colors text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 bg-zinc-800/80 rounded-full border border-white/5"
              >
                {showChordsSummary ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            
            <AnimatePresence>
              {showChordsSummary && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pt-6">
                    {Array.from(uniqueChords).map(chordText => {
                       const chordDef = getChord(chordText);
                       return (
                         <div key={chordText} className="flex flex-col">
                           {chordDef ? (
                             <div className="bg-zinc-900/60 border border-white/5 p-4 rounded-3xl flex flex-col items-center hover:bg-zinc-800 hover:border-primary-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] transition-all group h-full">
                               <ChordBox chord={chordDef} width={110} height={150} hideName={true} />
                               <div className="text-center mt-1 mb-2 text-white font-bold text-xl">{chordText}</div>
                               <button
                                 onClick={() => playChordAudio(chordDef.frets)}
                                 className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 bg-zinc-800 hover:bg-primary-500 hover:text-zinc-950 text-zinc-400 rounded-xl transition-all font-bold text-sm group-hover:bg-primary-500/10 group-hover:text-primary-500"
                               >
                                 <Volume2 size={16} className="group-hover:scale-110 transition-transform" />
                                 Sonar
                               </button>
                             </div>
                           ) : (
                             <div className="bg-zinc-900/60 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-center h-full min-h-[220px]">
                               <span className="text-zinc-500 font-bold text-xl">{chordText}</span>
                             </div>
                           )}
                         </div>
                       );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {!isEditing && (
          <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-6 sm:p-10 md:px-16 min-h-[500px] text-zinc-100 font-sans relative shadow-xl">
          
          <div className="w-full relative">
            {(song.originalKey || song.tuning || song.capo || song.strummingPattern || (!isEditing && song)) && (
              <div className="sticky -top-6 sm:-top-10 -mt-6 sm:-mt-10 -mx-6 sm:-mx-10 md:-mx-16 z-[60] flex flex-wrap items-center gap-4 mb-8 bg-zinc-950/80 backdrop-blur-xl py-4 px-6 sm:px-10 md:px-16 rounded-t-3xl border-b border-white/10 shadow-lg">
                {song.originalKey && (
                  <TonalidadTooltip tonalidad={song.originalKey} />
                )}
                {song.tuning && (
                  <AfinacionTooltip afinacion={song.tuning} />
                )}
                {song.capo && (
                  <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 px-4 py-2 rounded-xl shadow-sm text-sm">
                    <span className="text-zinc-500 font-bold">Capo:</span>
                    <span className="text-primary-400 font-bold">{song.capo}</span>
                  </div>
                )}
                {song.strummingPattern && (
                  <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 px-4 py-2 rounded-xl shadow-sm text-sm">
                    <span className="text-zinc-500 font-bold">Rasgueo:</span>
                    <div className="flex items-center gap-0.5">
                      {song.strummingPattern.split('').map((char, idx) => {
                        if (char.toUpperCase() === 'D') return <ArrowDown key={idx} size={16} className="text-primary-400" strokeWidth={3} />;
                        if (char.toUpperCase() === 'U') return <ArrowUp key={idx} size={16} className="text-primary-400" strokeWidth={3} />;
                        if (char.trim() === '') return <span key={idx} className="w-1.5"></span>;
                        return <span key={idx} className="text-primary-400 font-bold px-0.5">{char}</span>;
                      })}
                    </div>
                  </div>
                )}
                
                {song && !isEditing && (
                  <div className="ml-auto flex items-center gap-3">
                    {/* CONTROLES DE TRANSPOSICIÓN INTEGRADOs */}
                    <div className="relative flex items-center bg-zinc-900 border border-white/5 rounded-xl shadow-sm text-sm p-0.5" ref={menuRef}>
                      <button 
                        onClick={() => setTransposeDelta(prev => prev - 1)}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                        title="Bajar 1/2 tono"
                      >
                        <ArrowDown size={14} />
                      </button>
                      
                      <button 
                        onClick={() => setIsTransposeMenuOpen(!isTransposeMenuOpen)}
                        className="px-3 py-1 flex flex-col items-center justify-center min-w-[4rem] hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Elegir tono exacto"
                      >
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider leading-tight">Tono</span>
                        <span className="font-mono font-bold text-primary-400 text-sm leading-none">
                          {currentRoot}
                        </span>
                      </button>

                      <button 
                        onClick={() => setTransposeDelta(prev => prev + 1)}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                        title="Subir 1/2 tono"
                      >
                        <ArrowUp size={14} />
                      </button>

                      {transposeDelta !== 0 && (
                        <button 
                          onClick={() => setTransposeDelta(0)}
                          className="p-1.5 hover:bg-zinc-800 text-primary-500/80 hover:text-primary-500 rounded-lg transition-colors border-l border-white/5 ml-1"
                          title="Restaurar tono original"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}

                      {/* Menú de Transposición (Popover) */}
                      <AnimatePresence>
                        {isTransposeMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-[100] top-full right-0 mt-2 bg-zinc-900 border border-white/10 p-4 rounded-2xl shadow-2xl w-[260px]"
                          >
                            <div className="grid grid-cols-4 gap-2">
                              {CHROMATIC_SCALE.map((note, index) => {
                                let delta = index - originalIndex;
                                if (delta > 6) delta -= 12;
                                if (delta < -5) delta += 12;

                                const isSelected = index === currentIndex;

                                return (
                                  <button
                                    key={note}
                                    onClick={() => {
                                      setTransposeDelta(delta);
                                      setIsTransposeMenuOpen(false);
                                    }}
                                    className={`py-2 rounded-xl font-bold text-sm transition-all ${
                                      isSelected 
                                        ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                                        : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-white/5'
                                    }`}
                                  >
                                    {note}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button 
                      onClick={handleEditClick}
                      className="flex items-center gap-2 bg-zinc-900 border border-white/5 hover:border-white/20 px-4 py-2.5 rounded-xl shadow-sm text-sm text-zinc-300 hover:text-white transition-colors font-medium"
                    >
                      <Edit2 size={16} className="text-primary-500" />
                      Editar Letra/Acordes
                    </button>
                  </div>
                )}
              </div>
            )}

          <div className="font-mono text-[13px] sm:text-sm md:text-base lg:text-lg leading-snug tracking-wide whitespace-pre-wrap overflow-x-auto custom-scrollbar pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 lg:px-12 xl:px-24 w-[calc(100%+2rem)] sm:w-full">
            {(!song.textContent || song.textContent.trim() === '') && (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-70">
                <div className="bg-zinc-800/50 p-6 rounded-full mb-6 border border-white/5">
                  <Edit2 size={48} className="text-primary-500/50" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-300 mb-2">Lienzo en Blanco</h3>
                <p className="text-zinc-500 max-w-sm mb-8">
                  Esta canción aún no tiene letra ni acordes. Dale al botón de editar para empezar a escribir tu obra maestra.
                </p>
                <button 
                  onClick={handleEditClick}
                  className="px-6 py-3 bg-primary-500 hover:bg-primary-400 text-zinc-950 font-bold rounded-xl transition-all shadow-[0_0_15px_var(--theme-glow)]"
                >
                  Empezar a Editar
                </button>
              </div>
            )}
            
            {displaySong.lines.map((line: any, i: number) => {
              if (line.items.length === 0) return <div key={i} className="h-4"></div>;

              const isCommentOrTag = line.items.some((item: any) => item instanceof CSJS.Tag);
              if (isCommentOrTag) {
                const tagNames = line.items.map((item: any) => item.name || '').join(' ');
                if (tagNames.includes('end_of_') || tagNames.includes('eoc') || tagNames.includes('eob')) {
                  return null;
                }

                let tagStr = line.items.map((item: any) => {
                  if (item.name && item.name.startsWith('start_of_')) {
                    return item.name.replace('start_of_', '');
                  }
                  if (item.name === 'soc') return 'chorus';
                  if (item.name === 'sob') return 'bridge';
                  return item.value || item.name;
                }).join(' ').trim();

                if (!tagStr) return null;

                return (
                  <div key={i} className="mt-8 mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-zinc-800/80 text-primary-500/80 border border-primary-500/10 uppercase tracking-widest shadow-sm">
                      {tagStr}
                    </span>
                  </div>
                );
              }

              // Reconstruct raw text to detect Tab lines
              const combinedText = line.items.map((item: any) => {
                if (item instanceof CSJS.ChordLyricsPair) return (item.chords || '') + (item.lyrics || '');
                if (item instanceof CSJS.Literal) return item.string;
                return '';
              }).join('');
              
              const isTabLine = /^[A-Ga-g][#b]?\|/.test(combinedText.trim()) || combinedText.includes('|--') || combinedText.includes('|-');

              if (isTabLine) {
                return (
                  <div key={i} className="mb-0 whitespace-pre flex flex-col font-mono text-zinc-500 tracking-wide">
                    {line.items.some((item: any) => item instanceof CSJS.ChordLyricsPair && item.chords) && (
                      <div className="flex">
                        {line.items.map((item: any, idx: number) => {
                          if (item instanceof CSJS.ChordLyricsPair) {
                            const chordText = item.chords || '';
                            const len = Math.max(chordText.length, (item.lyrics || '').length);
                            return <span key={idx}>{chordText.padEnd(len, ' ')}</span>;
                          }
                          if (item instanceof CSJS.Literal) return <span key={idx}>{item.string}</span>;
                          return null;
                        })}
                      </div>
                    )}
                    {line.items.some((item: any) => item instanceof CSJS.ChordLyricsPair && item.lyrics) && (
                      <div className="flex">
                        {line.items.map((item: any, idx: number) => {
                          if (item instanceof CSJS.ChordLyricsPair) {
                            const chordText = item.chords || '';
                            const len = Math.max(chordText.length, (item.lyrics || '').length);
                            return <span key={idx}>{(item.lyrics || '').padEnd(len, ' ')}</span>;
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Normal lyric/chord line
              return (
                <div key={i} className="mb-2 hover:bg-white/[0.02] py-1 px-3 -mx-3 rounded-xl transition-colors flex flex-wrap items-end gap-y-2 w-fit max-w-full">
                  {line.items.map((item: any, idx: number) => {
                    if (item instanceof CSJS.ChordLyricsPair) {
                      const chordText = item.chords || ' ';
                      const lyricText = item.lyrics || ' ';
                      return (
                        <div key={idx} className="flex flex-col">
                          <div className="whitespace-pre min-h-[1.5rem] flex items-end">
                            <InteractiveChord text={chordText} onClick={(c) => {
                              openEditChordModal(c, handleChordReplace);
                            }} />
                          </div>
                          <div className="text-zinc-200 whitespace-pre tracking-wide min-h-[1.5rem] flex items-start">
                            {lyricText}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            })}
          </div>
        </div>
        </div>
        )}
      </div>
    );
  }

  // RENDERING PARA PARTITURAS ALPHATAB
  if (!track) return null;

  const lines = extractChordsAndLyrics();
  const contentLines = lines.filter(l => l.type === 'content');

  return (
    <div className="bg-zinc-50 min-h-screen rounded-2xl p-8 md:p-12 shadow-2xl relative border border-white/10 text-zinc-900 font-sans">
      <div className="mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 border-b-2 border-primary-500 pb-4 inline-block">{songTitle}</h1>

        {contentLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-zinc-400 py-20">
            <Guitar size={64} className="mb-4 opacity-50" />
            <h2 className="text-xl font-bold mb-2">No se detectó letra ni acordes</h2>
            <p>Este archivo de tablatura no contiene meta-datos de acordes (Cifra) o letras.</p>
          </div>
        ) : (
          <div className="font-mono text-base leading-relaxed tracking-wide whitespace-pre-wrap">
            {contentLines.map((line, i) => {
              const chordItems = line.chords.map(c => c.padEnd(8, ' '));
              const lyricLine = line.lyrics.map(l => {
                return l ? l.replace(/-/g, '').padEnd(8, ' ') : '        ';
              }).join('');

              return (
                <div key={i} className="mb-8 hover:bg-primary-50/50 p-2 rounded-lg transition-colors">
                  <div className="mb-1 whitespace-pre">
                    {chordItems.map((cText, idx) => (
                      <InteractiveChord key={idx} text={cText} onClick={(c) => {
                        openEditChordModal(c, handleChordReplace);
                      }} />
                    ))}
                  </div>
                  <div className="text-zinc-800 whitespace-pre">{lyricLine}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>


    </div>
  );
};
