import * as alphaTab from '@coderline/alphatab';
import { ArrowUp, ArrowDown, RotateCcw, Guitar, Volume2, Gauge, Bell, ListMusic, SkipBack, SkipForward, Upload, Download, FileText } from 'lucide-react';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
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
import { usePlayerStore } from '../store/playerStore';
import { sanitizeChordText } from '../utils/chordText';
import { chordProFilename, exportChordPro, importChordPro, normalizeChordPro, parseChordContent } from '../services/chordProService';
import Swal from 'sweetalert2';
import { ChordProEditor } from './chords/ChordProEditor';
import { importCifraClubPdf } from '../services/pdfChordImportService';
import { createPortal } from 'react-dom';

const CSJS = ChordSheetJS;
const METADATA_TAG_NAMES = new Set([
  'title', 'subtitle', 'artist', 'composer', 'lyricist', 'copyright', 'album', 'year',
  'key', 'capo', 'tempo', 'time', 'duration', 'tuning', 'strumming'
]);

interface ChordsViewProps {
  track: alphaTab.model.Track | null;
  songTitle: string;
  song?: Song;
  onEditChange?: (isEditing: boolean) => void;
  originalBpm: number;
  targetBpm: number;
  onBpmChange: (bpm: number) => void;
  isMetronomeActive: boolean;
  onToggleMetronome: () => void;
  includeChordDiagramsInPrint: boolean;
}

export const ChordsView = ({ track, songTitle, song, onEditChange, originalBpm, targetBpm, onBpmChange, isMetronomeActive, onToggleMetronome, includeChordDiagramsInPrint }: ChordsViewProps) => {
  const { cifraFontSize, setCifraFontSize } = usePlayerStore();
  const [localSongUpdate, setLocalSongUpdate] = useState<{ songId: number; values: Partial<Song> } | null>(null);
  const currentSong = useMemo(
    () => song && localSongUpdate && localSongUpdate.songId === song.id
      ? { ...song, ...localSongUpdate.values }
      : song,
    [localSongUpdate, song]
  );
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
  const [bpmInput, setBpmInput] = useState<string | null>(null);
  const chordProInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [performanceSelection, setPerformanceSelection] = useState<{ songId?: number; lineIndex: number } | null>(null);
  const lineRefs = useRef(new Map<number, HTMLDivElement>());
  const performanceLineRefs = useRef(new Map<number, HTMLDivElement>());
  const activeLineIndex = performanceSelection && performanceSelection.songId === currentSong?.id
    ? performanceSelection.lineIndex
    : null;

  const selectPerformanceLine = useCallback((lineIndex: number) => {
    setPerformanceSelection({ songId: currentSong?.id, lineIndex });
    lineRefs.current.get(lineIndex)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentSong?.id]);

  const movePerformanceLine = useCallback((direction: -1 | 1) => {
    const lineIndices = Array.from(performanceLineRefs.current.keys()).sort((left, right) => left - right);
    if (lineIndices.length === 0) return;
    const currentPosition = activeLineIndex === null ? -1 : lineIndices.indexOf(activeLineIndex);
    const fallbackPosition = direction === 1 ? 0 : lineIndices.length - 1;
    const nextPosition = currentPosition === -1
      ? fallbackPosition
      : Math.min(lineIndices.length - 1, Math.max(0, currentPosition + direction));
    selectPerformanceLine(lineIndices[nextPosition]);
  }, [activeLineIndex, selectPerformanceLine]);

  useEffect(() => {
    const handleGuideShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]')) return;

      event.preventDefault();
      movePerformanceLine(event.key === 'ArrowLeft' ? -1 : 1);
    };

    document.addEventListener('keydown', handleGuideShortcut);
    return () => document.removeEventListener('keydown', handleGuideShortcut);
  }, [movePerformanceLine]);

  const commitBpmInput = () => {
    const bpm = Number(bpmInput ?? targetBpm);
    if (Number.isFinite(bpm)) onBpmChange(bpm);
    setBpmInput(null);
  };

  const populateEditState = useCallback(() => {
    if (!currentSong) return;
    setEditContent(normalizeChordPro(currentSong.textContent || ''));
    setEditOriginalKey(currentSong.originalKey || '');
    setEditTuning(currentSong.tuning || '');
    setEditCapo(currentSong.capo || '');
    setEditStrummingPattern(currentSong.strummingPattern || '');
    setIsEditing(true);
    if (onEditChange) onEditChange(true);
  }, [currentSong, onEditChange]);

  // Auto-open editor if requested
  useEffect(() => {
    if (location.state?.autoEdit && song) {
      const editTimer = setTimeout(() => {
        populateEditState();
        window.history.replaceState({}, document.title);
      }, 0);

      return () => clearTimeout(editTimer);
    }
  }, [location.state, song, populateEditState]);

  const handleEditClick = () => {
    populateEditState();
  };

  const handleSaveEdit = async () => {
    if (currentSong?.id) {
      const sanitizedTextContent = sanitizeChordText(editContent);
      const updates = {
        textContent: sanitizedTextContent,
        originalKey: editOriginalKey.trim() || undefined,
        tuning: editTuning.trim() || undefined,
        capo: editCapo.trim() || undefined,
        strummingPattern: editStrummingPattern.trim() || undefined
      };
      
      await db.songs.update(currentSong.id, updates);
      setLocalSongUpdate({ songId: currentSong.id, values: updates });
      setEditContent(sanitizedTextContent);
      
      setIsEditing(false);
      if (onEditChange) onEditChange(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (onEditChange) onEditChange(false);
  };

  const handleChordProImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!/\.(?:cho|crd|chopro|pro)$/i.test(file.name)) {
      await Swal.fire({ icon: 'error', title: 'Archivo no compatible', text: 'Selecciona un archivo .cho, .crd, .chopro o .pro.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      await Swal.fire({ icon: 'error', title: 'Archivo demasiado grande', text: 'El archivo ChordPro no puede superar los 2 MB.' });
      return;
    }

    if (editContent.trim()) {
      const confirmation = await Swal.fire({
        icon: 'warning',
        title: '¿Reemplazar la cifra actual?',
        text: 'El contenido del archivo reemplazará el texto que está en el editor. Podrás cancelar la edición para recuperar la versión guardada.',
        showCancelButton: true,
        confirmButtonText: 'Importar y reemplazar',
        cancelButtonText: 'Cancelar'
      });
      if (!confirmation.isConfirmed) return;
    }

    try {
      const imported = importChordPro(await file.text());
      setEditContent(imported.content);
      if (imported.metadata.key) setEditOriginalKey(imported.metadata.key);
      if (imported.metadata.capo) setEditCapo(imported.metadata.capo);
      if (imported.metadata.tuning) setEditTuning(imported.metadata.tuning);
      if (imported.metadata.strummingPattern) setEditStrummingPattern(imported.metadata.strummingPattern);
      await Swal.fire({ icon: 'success', title: 'Cifra importada', text: 'Revisa el contenido y presiona Guardar cambios cuando estés conforme.', timer: 2200, showConfirmButton: false });
    } catch {
      await Swal.fire({ icon: 'error', title: 'No se pudo importar', text: 'El archivo está vacío o no contiene una cifra ChordPro válida.' });
    }
  };

  const handleChordProExport = async () => {
    try {
      const content = exportChordPro(editContent, {
        title: currentSong?.name || songTitle,
        artist: currentSong?.artist,
        key: editOriginalKey,
        capo: editCapo,
        tuning: editTuning,
        strummingPattern: editStrummingPattern
      });
      const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = chordProFilename(currentSong?.name || songTitle, currentSong?.artist);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      await Swal.fire({ icon: 'info', title: 'No hay contenido para exportar', text: 'Añade letra o acordes antes de exportar la cifra.' });
    }
  };

  const handlePdfImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      await Swal.fire({ icon: 'error', title: 'Archivo no compatible', text: 'Selecciona un documento PDF.' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      await Swal.fire({ icon: 'error', title: 'Archivo demasiado grande', text: 'El PDF no puede superar los 15 MB.' });
      return;
    }

    Swal.fire({ title: 'Leyendo la cifra…', text: 'El PDF se procesa localmente en este dispositivo.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const imported = await importCifraClubPdf(file);
      const details = [
        imported.metadata.title && `Título: ${imported.metadata.title}`,
        imported.metadata.artist && `Artista: ${imported.metadata.artist}`,
        imported.metadata.composer && `Compositor: ${imported.metadata.composer}`,
        imported.metadata.key && `Tono: ${imported.metadata.key}`,
        imported.metadata.tuning && `Afinación: ${imported.metadata.tuning}`
      ].filter(Boolean).join('\n');
      const confirmation = await Swal.fire({
        icon: 'question',
        title: 'Revisar importación PDF',
        text: `${details}\n\nSe importaron ${imported.importedPages} página(s) de contenido y se omitieron ${imported.skippedPages} página(s) vacías o de resumen.`,
        showCancelButton: true,
        confirmButtonText: editContent.trim() ? 'Importar y reemplazar' : 'Importar',
        cancelButtonText: 'Cancelar'
      });
      if (!confirmation.isConfirmed) return;

      setEditContent(imported.content);
      if (imported.metadata.key) setEditOriginalKey(imported.metadata.key);
      if (imported.metadata.tuning) setEditTuning(imported.metadata.tuning);
      await Swal.fire({ icon: 'success', title: 'PDF convertido', text: 'Revisa la alineación en la vista previa y guarda los cambios cuando estés conforme.', timer: 2600, showConfirmButton: false });
    } catch (error) {
      const isWithoutText = error instanceof Error && error.message === 'PDF_WITHOUT_TEXT';
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo leer la cifra',
        text: isWithoutText
          ? 'Este PDF parece ser una imagen escaneada. Por ahora se necesita un PDF con texto seleccionable.'
          : 'No se detectó una cifra compatible. Prueba con un PDF generado desde Imprimir en Cifra Club.'
      });
    }
  };

  const [isTransposeMenuOpen, setIsTransposeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const handleChordReplace = async (oldChord: string, newChord: string) => {
    if (!currentSong?.id || !currentSong.textContent) return;
    
    let newContent = currentSong.textContent;
    
    // Escape special chars in oldChord
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedOld = escapeRegExp(oldChord);
    
    // 1. Reemplazar [C] por [Cadd9]
    newContent = newContent.replace(new RegExp(`\\[${escapedOld}\\]`, 'g'), `[${newChord}]`);
    
    // 2. Reemplazar " C " por " Cadd9 " en lineas de acordes o al final/inicio, también con guiones o barras de compás
    const regex = new RegExp(`(^|[\\s\\-\\|])${escapedOld}(?=[\\s\\-\\|]|$)`, 'gm');
    newContent = newContent.replace(regex, `$1${newChord}`);
    
    await db.songs.update(currentSong.id, { textContent: newContent });
    setLocalSongUpdate({
      songId: currentSong.id,
      values: { ...localSongUpdate?.values, textContent: newContent }
    });
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
  const [showChordsSummary, setShowChordsSummary] = useState(false);

  // CHROMATIC LOGIC
  const CHROMATIC_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  const getOriginalRoot = () => {
    if (currentSong?.originalKey) {
      const match = currentSong.originalKey.match(/^[A-G][#b]?/);
      if (match) {
        const root = match[0];
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
      const tempSong = parseChordContent(sanitizeChordText(currentSong?.textContent || ''));
      if (tempSong && tempSong.lines) {
        for (const line of tempSong.lines) {
          for (const item of line.items) {
            if (item instanceof CSJS.ChordLyricsPair && item.chords) {
              const match = item.chords.match(/^[A-G][#b]?/);
              if (match) {
                const root = match[0];
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
    } catch {
      // Invalid chord text falls back to C.
    }
    return 'C';
  };

  const originalRoot = getOriginalRoot();
  const originalIndex = CHROMATIC_SCALE.indexOf(originalRoot) !== -1 ? CHROMATIC_SCALE.indexOf(originalRoot) : 0;
  
  let currentIndex = (originalIndex + transposeDelta) % 12;
  if (currentIndex < 0) currentIndex += 12;
  const currentRoot = CHROMATIC_SCALE[currentIndex];

  // DEBUGGING TEXT CONTENT
  if (currentSong && (currentSong.type === 'text' || currentSong.textContent)) {
    let parsedSong;
    try {
      parsedSong = parseChordContent(sanitizeChordText(currentSong.textContent || ''));
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
      displaySong.lines.forEach((line) => {
        // Pre-check if line is a Tab line
        const combinedText = line.items.map((item) => {
          if (item instanceof CSJS.ChordLyricsPair) return (item.chords || '') + (item.lyrics || '');
          if (item instanceof CSJS.Literal) return item.string;
          return '';
        }).join('');
        
        const isTabLine = /^[A-Ga-g][#b]?\|/.test(combinedText.trim()) || combinedText.includes('|--') || combinedText.includes('|-');
        if (isTabLine) return; // Skip tab lines completely

        line.items.forEach((item) => {
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

    const performanceLineIndices = displaySong.lines.reduce<number[]>((indices, line, index) => {
      const hasLyricsOrChords = line.items.some((item) => item instanceof CSJS.ChordLyricsPair && Boolean(item.chords || item.lyrics));
      if (hasLyricsOrChords) indices.push(index);
      return indices;
    }, []);
    const sections = displaySong.lines.reduce<Array<{ lineIndex: number; label: string }>>((items, line, lineIndex) => {
      const tags = line.items.filter((item) => item instanceof CSJS.Tag);
      if (tags.length === 0) return items;

      const sectionTags = tags.filter((item) => !METADATA_TAG_NAMES.has(item.name));
      if (sectionTags.length === 0) return items;

      const tagNames = sectionTags.map((item) => item.name || '').join(' ');
      if (tagNames.includes('end_of_') || tagNames.includes('eoc') || tagNames.includes('eob')) return items;

      const label = sectionTags.map((item) => {
        if (item.name?.startsWith('start_of_')) return item.name.replace('start_of_', '');
        if (item.name === 'soc') return 'Coro';
        if (item.name === 'sob') return 'Puente';
        return item.value || item.name;
      }).filter(Boolean).join(' ').trim();

      const targetLineIndex = performanceLineIndices.find((index) => index > lineIndex) ?? lineIndex;
      if (label) items.push({ lineIndex: targetLineIndex, label });
      return items;
    }, []);
    const firstMetadataValue = (name: string) => {
      const value = parsedSong.metadata.get(name);
      return Array.isArray(value) ? value[0] : value;
    };
    const printComposer = firstMetadataValue('composer');
    const printKey = transposeDelta === 0
      ? currentSong.originalKey || firstMetadataValue('key') || originalRoot
      : currentRoot;

    return (
      <div className="mt-2 flex w-full flex-col gap-3 sm:mt-6 sm:gap-6">
        {createPortal(<article className="print-sheet" aria-hidden="true">
          <header className="print-sheet-header">
            <h1>{currentSong.name || songTitle}</h1>
            {currentSong.artist && <p className="print-sheet-artist">{currentSong.artist}</p>}
            {printComposer && <p className="print-sheet-composer">Composición: {printComposer}</p>}
            <dl className="print-sheet-metadata">
              {printKey && <div><dt>Tono actual</dt><dd>{printKey}</dd></div>}
              {currentSong.tuning && <div><dt>Afinación</dt><dd>{currentSong.tuning}</dd></div>}
              {currentSong.capo && <div><dt>Capo</dt><dd>{currentSong.capo}</dd></div>}
              {currentSong.strummingPattern && <div><dt>Rasgueo</dt><dd>{currentSong.strummingPattern}</dd></div>}
              {targetBpm > 0 && <div><dt>BPM</dt><dd>{targetBpm}</dd></div>}
            </dl>
          </header>

          <section className="print-sheet-song">
            {displaySong.lines.map((line, lineIndex) => {
              if (line.items.length === 0) return <div key={lineIndex} className="print-sheet-spacer" />;
              const tags = line.items.filter((item) => item instanceof CSJS.Tag);
              if (tags.length > 0) {
                const visibleTags = tags.filter((tag) => !METADATA_TAG_NAMES.has(tag.name) && !tag.name.startsWith('end_of_'));
                if (visibleTags.length === 0) return null;
                const label = visibleTags.map((tag) => tag.value || tag.name.replace('start_of_', '')).join(' ');
                return <h2 key={lineIndex}>{label}</h2>;
              }
              const hasLyrics = line.items.some((item) => item instanceof CSJS.ChordLyricsPair && Boolean(item.lyrics?.trim()));
              if (!hasLyrics) {
                const chords = line.items
                  .filter((item) => item instanceof CSJS.ChordLyricsPair && item.chords)
                  .map((item) => item instanceof CSJS.ChordLyricsPair ? item.chords : '')
                  .join(' ');
                return <div key={lineIndex} className="print-sheet-chord-line">{chords}</div>;
              }
              return (
                <div key={lineIndex} className="print-sheet-line">
                  {line.items.map((item, itemIndex) => item instanceof CSJS.ChordLyricsPair ? (
                    <span key={itemIndex} className="print-sheet-pair">
                      <strong>{item.chords || '\u00a0'}</strong>
                      <span>{item.lyrics || '\u00a0'}</span>
                    </span>
                  ) : null)}
                </div>
              );
            })}
          </section>

          {includeChordDiagramsInPrint && uniqueChords.size > 0 && (
            <section className="print-sheet-chords">
              <h2>Acordes utilizados</h2>
              <div>
                {Array.from(uniqueChords).map((chordText) => {
                  const chord = getChord(chordText);
                  return chord ? (
                    <figure key={chordText}>
                      <ChordBox chord={chord} width={82} height={112} hideName={true} />
                      <figcaption>{chordText}</figcaption>
                    </figure>
                  ) : null;
                })}
              </div>
            </section>
          )}
        </article>, document.body)}
        {/* Botón de edición movido a la barra de metadatos inferior */}

        {isEditing && (
          <div className="flex w-full flex-col gap-4 rounded-2xl border border-primary-500/30 bg-zinc-900 p-3 shadow-xl sm:gap-6 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-primary-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                <Edit2 size={16} /> Modo Edición
              </h3>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <input ref={chordProInputRef} type="file" accept=".cho,.crd,.chopro,.pro,text/plain" className="hidden" onChange={handleChordProImport} />
                <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handlePdfImport} />
                <Button variant="ghost" className="flex-1 justify-center sm:flex-none" size="sm" icon={<Upload size={16} />} onClick={() => chordProInputRef.current?.click()}>
                  ChordPro
                </Button>
                <Button variant="ghost" className="flex-1 justify-center sm:flex-none" size="sm" icon={<FileText size={16} />} onClick={() => pdfInputRef.current?.click()}>
                  PDF
                </Button>
                <Button variant="ghost" className="flex-1 justify-center sm:flex-none" size="sm" icon={<Download size={16} />} onClick={handleChordProExport}>
                  Exportar
                </Button>
                <Button variant="ghost" className="flex-1 sm:flex-none justify-center" size="sm" icon={<X size={16} />} onClick={handleCancelEdit}>
                  Cancelar
                </Button>
                <Button variant="primary" className="flex-1 sm:flex-none justify-center" size="sm" icon={<CheckCircle2 size={16} />} onClick={handleSaveEdit}>
                  <span className="hidden sm:inline">Guardar Cambios</span>
                  <span className="sm:hidden">Guardar</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/5 bg-zinc-950/50 p-3 sm:grid-cols-4 sm:gap-4 sm:p-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Tono Original</label>
                <input type="text" className="min-h-11 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-primary-500/50 focus:outline-none" value={editOriginalKey} onChange={e => setEditOriginalKey(e.target.value)} placeholder="Ej: G, Am" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Afinación</label>
                <input type="text" className="min-h-11 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-primary-500/50 focus:outline-none" value={editTuning} onChange={e => setEditTuning(e.target.value)} placeholder="Ej: Drop D, Eb" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Capo</label>
                <input type="text" className="min-h-11 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-primary-500/50 focus:outline-none" value={editCapo} onChange={e => setEditCapo(e.target.value)} placeholder="Ej: Traste 2" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Rasgueo</label>
                <input type="text" className="min-h-11 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-primary-500/50 focus:outline-none" value={editStrummingPattern} onChange={e => setEditStrummingPattern(e.target.value)} placeholder="Ej: D DU U DU" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <ChordProEditor value={editContent} onChange={setEditContent} />
              <p className="text-zinc-500 text-xs">Asegúrate de encerrar los acordes entre corchetes [C] para que el sistema los detecte correctamente.</p>
            </div>
          </div>
        )}

        {!isEditing && uniqueChords.size > 0 && (
          <div className="relative rounded-2xl border border-white/5 bg-zinc-900/30 p-3 shadow-xl sm:rounded-3xl sm:p-6">
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
                  <div className="grid grid-cols-2 gap-2 pt-4 sm:grid-cols-3 sm:gap-4 sm:pt-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
                    {Array.from(uniqueChords).map(chordText => {
                       const chordDef = getChord(chordText);
                       return (
                         <div key={chordText} className="flex flex-col">
                           {chordDef ? (
                             <div className="group flex h-full flex-col items-center rounded-2xl border border-white/5 bg-zinc-900/60 p-2 transition-all hover:border-primary-500/30 hover:bg-zinc-800 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] sm:rounded-3xl sm:p-4">
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
          <div className="relative min-h-[360px] rounded-2xl border border-white/5 bg-zinc-900/30 p-3 font-sans text-zinc-100 shadow-xl sm:min-h-[500px] sm:rounded-3xl sm:p-6 lg:p-8">
          
          <div className="relative w-full lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-8">
            {(currentSong.originalKey || currentSong.tuning || currentSong.capo || currentSong.strummingPattern || !isEditing) && (
              <aside className="relative top-0 z-[60] -mx-2 -mt-1 mb-4 flex items-center gap-2 overflow-x-auto rounded-t-xl border-b border-white/10 bg-zinc-950/90 px-2 py-2.5 shadow-lg backdrop-blur-xl custom-scrollbar sm:sticky sm:-top-6 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6 sm:py-3 lg:top-4 lg:m-0 lg:flex lg:flex-col lg:items-stretch lg:gap-3 lg:overflow-visible lg:rounded-2xl lg:border lg:border-white/5 lg:bg-zinc-950/60 lg:p-3">
                {currentSong.originalKey && (
                  <div className="shrink-0"><TonalidadTooltip tonalidad={currentSong.originalKey} /></div>
                )}
                {currentSong.tuning && (
                  <div className="shrink-0"><AfinacionTooltip afinacion={currentSong.tuning} /></div>
                )}
                {currentSong.capo && (
                  <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/5 bg-zinc-900 px-3 py-2 text-sm shadow-sm">
                    <span className="text-zinc-500 font-bold">Capo:</span>
                    <span className="text-primary-400 font-bold">{currentSong.capo}</span>
                  </div>
                )}
                {currentSong.strummingPattern && (
                  <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/5 bg-zinc-900 px-3 py-2 text-sm shadow-sm">
                    <span className="text-zinc-500 font-bold">Rasgueo:</span>
                    <div className="flex items-center gap-0.5">
                      {currentSong.strummingPattern.split('').map((char, idx) => {
                        if (char.toUpperCase() === 'D') return <ArrowDown key={idx} size={16} className="text-primary-400" strokeWidth={3} />;
                        if (char.toUpperCase() === 'U') return <ArrowUp key={idx} size={16} className="text-primary-400" strokeWidth={3} />;
                        if (char.trim() === '') return <span key={idx} className="w-1.5"></span>;
                        return <span key={idx} className="text-primary-400 font-bold px-0.5">{char}</span>;
                      })}
                    </div>
                  </div>
                )}

                {performanceLineIndices.length > 0 && (
                  <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/5 bg-zinc-900 p-1 shadow-sm lg:flex-col lg:items-stretch">
                    <div className="hidden items-center gap-2 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 lg:flex">
                      <ListMusic size={13} className="text-primary-400" /> Modo guía
                      <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">← →</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => movePerformanceLine(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white" title="Línea anterior (flecha izquierda)" aria-label="Ir a la línea anterior"><SkipBack size={15} /></button>
                      <span className="min-w-12 text-center text-[10px] font-bold text-zinc-500">
                        {activeLineIndex === null ? 'Elegir' : `${performanceLineIndices.indexOf(activeLineIndex) + 1}/${performanceLineIndices.length}`}
                      </span>
                      <button type="button" onClick={() => movePerformanceLine(1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white" title="Línea siguiente (flecha derecha)" aria-label="Ir a la línea siguiente"><SkipForward size={15} /></button>
                    </div>
                  </div>
                )}

                {sections.length > 0 && (
                  <nav className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-white/5 bg-zinc-900 p-1 custom-scrollbar lg:max-h-52 lg:flex-col lg:items-stretch lg:overflow-y-auto" aria-label="Secciones de la canción">
                    {sections.map((section, sectionIndex) => (
                      <button
                        key={`${section.lineIndex}-${section.label}`}
                        type="button"
                        onClick={() => selectPerformanceLine(section.lineIndex)}
                        className={`min-h-9 shrink-0 rounded-lg px-3 text-left text-xs font-bold transition-colors ${activeLineIndex === section.lineIndex ? 'bg-primary-500/20 text-primary-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                      >
                        {section.label || `Sección ${sectionIndex + 1}`}
                      </button>
                    ))}
                  </nav>
                )}
                
                {!isEditing && (
                  <div className="ml-auto flex shrink-0 items-center justify-end gap-2 lg:ml-0 lg:flex-col lg:items-stretch lg:border-t lg:border-white/5 lg:pt-3">
                    <div className="flex items-center justify-center gap-1 rounded-xl border border-white/5 bg-zinc-900 p-0.5 shadow-sm">
                      <Gauge size={15} className="ml-1.5 shrink-0 text-sky-400" />
                      <button type="button" onClick={() => { setBpmInput(null); onBpmChange(targetBpm - 1); }} className="flex h-8 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white" aria-label="Disminuir un BPM">−</button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bpmInput ?? String(targetBpm)}
                        onChange={(event) => {
                          if (/^\d*$/.test(event.target.value)) setBpmInput(event.target.value);
                        }}
                        onBlur={commitBpmInput}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                          if (event.key === 'Escape') {
                            setBpmInput(null);
                            event.currentTarget.blur();
                          }
                        }}
                        className="w-10 bg-transparent text-center text-sm font-bold text-sky-300 outline-none"
                        aria-label="BPM del metrónomo"
                      />
                      <span className="mr-0.5 text-[9px] font-bold text-zinc-500">BPM</span>
                      <button type="button" onClick={() => { setBpmInput(null); onBpmChange(targetBpm + 1); }} className="flex h-8 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white" aria-label="Aumentar un BPM">+</button>
                      <button type="button" onClick={() => { setBpmInput(null); onBpmChange(originalBpm); }} disabled={targetBpm === originalBpm} className="flex h-8 w-7 items-center justify-center rounded-lg border-l border-white/5 text-zinc-500 transition-colors hover:text-sky-300 disabled:opacity-30" title={`Restaurar ${originalBpm} BPM`} aria-label="Restaurar BPM original"><RotateCcw size={13} /></button>
                    </div>

                    <button
                      type="button"
                      onClick={onToggleMetronome}
                      aria-pressed={isMetronomeActive}
                      className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all ${isMetronomeActive
                        ? 'border-primary-500/50 bg-primary-500/20 text-primary-300 shadow-[0_0_10px_var(--theme-glow)]'
                        : 'border-white/5 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                      }`}
                      title={isMetronomeActive ? 'Desactivar metrónomo' : 'Activar metrónomo'}
                    >
                      <Bell size={16} />
                      <span className="hidden lg:inline">{isMetronomeActive ? 'Metrónomo activo' : 'Metrónomo'}</span>
                    </button>

                    {/* CONTROLES DE ZOOM DE LETRA */}
                    <div className="flex items-center justify-center gap-1 rounded-xl border border-white/5 bg-zinc-900 p-0.5 text-sm shadow-sm">
                      <button onClick={() => setCifraFontSize(Math.max(10, cifraFontSize - 2))} className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors font-bold" title="Reducir letra">A-</button>
                      <span className="text-zinc-500 font-bold px-1 text-xs min-w-[32px] text-center">{cifraFontSize}</span>
                      <button onClick={() => setCifraFontSize(Math.min(48, cifraFontSize + 2))} className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors font-bold" title="Aumentar letra">A+</button>
                    </div>

                    {/* CONTROLES DE TRANSPOSICIÓN INTEGRADOs */}
                    <div className="relative flex items-center justify-center rounded-xl border border-white/5 bg-zinc-900 p-0.5 text-sm shadow-sm" ref={menuRef}>
                      <button 
                        onClick={() => setTransposeDelta(prev => prev - 1)}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                        title="Bajar 1/2 tono"
                      >
                        <ArrowDown size={14} />
                      </button>
                      
                      <button 
                        onClick={() => setIsTransposeMenuOpen(!isTransposeMenuOpen)}
                        className="px-2 sm:px-3 py-1 flex flex-col items-center justify-center min-w-[3rem] sm:min-w-[4rem] hover:bg-zinc-800 rounded-lg transition-colors"
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
                            className="absolute right-0 top-full z-[100] mt-2 w-[260px] rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl lg:left-full lg:right-auto lg:top-0 lg:ml-3 lg:mt-0"
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
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-zinc-900 text-sm font-medium text-zinc-300 shadow-sm transition-colors hover:border-white/20 hover:text-white sm:h-10 sm:w-auto sm:px-4 sm:py-2.5 lg:h-10 lg:w-full"
                      title="Editar Letra/Acordes"
                    >
                      <Edit2 size={16} className="text-primary-500" />
                      <span className="hidden sm:inline sm:ml-2">Editar Letra/Acordes</span>
                    </button>
                  </div>
                )}
              </aside>
            )}

          <div className="-mx-4 w-[calc(100%+2rem)] min-w-0 overflow-x-auto whitespace-pre-wrap px-4 pb-4 font-mono leading-snug tracking-wide custom-scrollbar sm:mx-0 sm:w-full sm:px-2 lg:border-l lg:border-white/5 lg:px-8 xl:px-12" style={{ fontSize: `${cifraFontSize}px` }}>
            {(!currentSong.textContent || currentSong.textContent.trim() === '') && (
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
            
            {displaySong.lines.map((line, i: number) => {
              if (line.items.length === 0) return <div key={i} className="h-4"></div>;

              const isCommentOrTag = line.items.some((item) => item instanceof CSJS.Tag);
              if (isCommentOrTag) {
                const tagNames = line.items.map((item) => item instanceof CSJS.Tag ? item.name : '').join(' ');
                if (line.items.every((item) => item instanceof CSJS.Tag && METADATA_TAG_NAMES.has(item.name))) return null;
                if (tagNames.includes('end_of_') || tagNames.includes('eoc') || tagNames.includes('eob')) {
                  return null;
                }

                const tagStr = line.items.map((item) => {
                  if (!(item instanceof CSJS.Tag)) return '';
                  if (item.name && item.name.startsWith('start_of_')) {
                    return item.name.replace('start_of_', '');
                  }
                  if (item.name === 'soc') return 'chorus';
                  if (item.name === 'sob') return 'bridge';
                  return item.value || item.name;
                }).join(' ').trim();

                if (!tagStr) return null;

                return (
                  <div
                    key={i}
                    ref={(element) => { if (element) lineRefs.current.set(i, element); else lineRefs.current.delete(i); }}
                    className={`mt-8 mb-4 scroll-mt-28 rounded-xl transition-colors ${activeLineIndex === i ? 'bg-primary-500/10 px-3 py-2' : ''}`}
                  >
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-zinc-800/80 text-primary-500/80 border border-primary-500/10 uppercase tracking-widest shadow-sm">
                      {tagStr}
                    </span>
                  </div>
                );
              }

              // Reconstruct raw text to detect Tab lines
              const combinedText = line.items.map((item) => {
                if (item instanceof CSJS.ChordLyricsPair) return (item.chords || '') + (item.lyrics || '');
                if (item instanceof CSJS.Literal) return item.string;
                return '';
              }).join('');
              
              const isTabLine = /^[A-Ga-g][#b]?\|/.test(combinedText.trim()) || combinedText.includes('|--') || combinedText.includes('|-');

              if (isTabLine) {
                return (
                  <div key={i} className="mb-0 whitespace-pre flex flex-col font-mono text-zinc-500 tracking-wide">
                    {line.items.some((item) => item instanceof CSJS.ChordLyricsPair && item.chords) && (
                      <div className="flex">
                        {line.items.map((item, idx: number) => {
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
                    {line.items.some((item) => item instanceof CSJS.ChordLyricsPair && item.lyrics) && (
                      <div className="flex">
                        {line.items.map((item, idx: number) => {
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
              const lineHasLyrics = line.items.some((item) => item instanceof CSJS.ChordLyricsPair && Boolean(item.lyrics?.trim()));
              return (
                <div
                  key={i}
                  ref={(element) => {
                    if (element) {
                      lineRefs.current.set(i, element);
                      performanceLineRefs.current.set(i, element);
                    } else {
                      lineRefs.current.delete(i);
                      performanceLineRefs.current.delete(i);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={activeLineIndex === i}
                  aria-label={`Seleccionar línea ${performanceLineIndices.indexOf(i) + 1}`}
                  onClick={() => selectPerformanceLine(i)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectPerformanceLine(i);
                    }
                  }}
                  className={`mb-2 scroll-mt-28 py-1 px-3 -mx-3 rounded-xl transition-all flex flex-wrap items-end gap-y-2 w-fit max-w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${activeLineIndex === i ? 'bg-primary-500/15 shadow-[inset_3px_0_0_var(--theme-primary)]' : 'hover:bg-white/[0.02]'}`}
                >
                  {line.items.map((item, idx: number) => {
                    if (item instanceof CSJS.ChordLyricsPair) {
                      const chordText = item.chords || ' ';
                      const lyricText = item.lyrics || ' ';
                      return (
                        <div key={idx} className={`flex flex-col ${!lineHasLyrics || (!item.lyrics?.trim() && item.chords) ? 'mr-5' : ''}`}>
                          <div className="whitespace-pre min-h-[1.5rem] flex items-end">
                            <InteractiveChord text={chordText} onClick={(c) => {
                              openEditChordModal(c, handleChordReplace);
                            }} />
                          </div>
                          {lineHasLyrics && (
                            <div className="text-zinc-200 whitespace-pre tracking-wide min-h-[1.5rem] flex items-start">
                              {lyricText}
                            </div>
                          )}
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
  if (!track) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-5 py-12 text-center text-zinc-400">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/5 bg-zinc-800/60 text-primary-400">
          <Guitar size={30} />
        </div>
        <h2 className="text-xl font-bold text-white">Esta cifra está vacía</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
          Añade la letra, los acordes y los datos de interpretación para verla en este modo.
        </p>
        {currentSong && (
          <button
            type="button"
            onClick={handleEditClick}
            className="mt-5 min-h-11 rounded-xl bg-primary-500 px-5 py-2.5 font-bold text-zinc-950 transition-colors hover:bg-primary-400"
          >
            Añadir letra y acordes
          </button>
        )}
      </div>
    );
  }

  const lines = extractChordsAndLyrics();
  const contentLines = lines.filter(l => l.type === 'content');

  return (
    <div className="relative min-h-full rounded-2xl border border-white/10 bg-zinc-50 p-4 font-sans text-zinc-900 shadow-2xl sm:min-h-screen sm:p-8 md:p-12">
      <div className="mx-auto">
        <h1 className="mb-5 inline-block border-b-2 border-primary-500 pb-3 text-2xl font-extrabold sm:mb-8 sm:pb-4 sm:text-4xl">{songTitle}</h1>

        {contentLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center text-zinc-400 sm:py-20">
            <Guitar size={64} className="mb-4 opacity-50" />
            <h2 className="text-xl font-bold mb-2">No se detectó letra ni acordes</h2>
            <p className="max-w-md text-sm sm:text-base">Este archivo de tablatura no contiene metadatos de acordes (Cifra) o letras.</p>
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
