import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Braces, Code2, Eye, ListPlus, Redo2, Rows3, Undo2 } from 'lucide-react';
import ChordSheetJS from 'chordsheetjs';
import { parseChordContent } from '../../services/chordProService';
import { ChordSearchInput } from './ChordSearchInput';
import { InsertionCombobox } from './InsertionCombobox';

const CSJS = ChordSheetJS;
const METADATA_TAG_NAMES = new Set([
  'title', 'subtitle', 'artist', 'composer', 'lyricist', 'copyright', 'album', 'year',
  'key', 'capo', 'tempo', 'time', 'duration', 'tuning', 'strumming'
]);

interface ChordProEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const SECTION_TYPES = [
  { label: 'Intro', name: 'intro' },
  { label: 'Estrofa', name: 'verse' },
  { label: 'Pre-coro', name: 'pre_chorus' },
  { label: 'Coro', name: 'chorus' },
  { label: 'Puente', name: 'bridge' },
  { label: 'Solo', name: 'solo' },
  { label: 'Outro', name: 'outro' }
];

const SECTION_INSERTION_ITEMS = SECTION_TYPES.map((section) => ({
  id: section.name,
  label: section.label,
  detail: 'Sección',
  icon: <Rows3 size={14} />
}));

interface ParserErrorLocation {
  offset: number;
  line: number;
  column: number;
}

const syncScrollProgress = (source: HTMLDivElement, target: HTMLDivElement | null) => {
  if (!target) return;
  const sourceRange = source.scrollHeight - source.clientHeight;
  const targetRange = target.scrollHeight - target.clientHeight;
  const progress = sourceRange > 0 ? source.scrollTop / sourceRange : 0;
  target.scrollTop = progress * Math.max(0, targetRange);
};

const updateHorizontalScrollControl = (textarea: HTMLTextAreaElement | null, control: HTMLInputElement | null) => {
  if (!textarea || !control) return;
  const horizontalRange = Math.max(0, textarea.scrollWidth - textarea.clientWidth);
  control.max = String(horizontalRange);
  control.value = String(Math.min(textarea.scrollLeft, horizontalRange));
  control.disabled = horizontalRange === 0;
};

export const ChordProEditor = ({ value, onChange }: ChordProEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const horizontalScrollControlRef = useRef<HTMLInputElement>(null);
  const keepScrollAtBottomRef = useRef(false);
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const lastValueRef = useRef(value);
  const lastTypingAtRef = useRef(0);
  const insertionRangeRef = useRef<{ start: number; end: number } | null>(null);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [mobileView, setMobileView] = useState<'code' | 'preview'>('code');
  const [hasInsertionPoint, setHasInsertionPoint] = useState(false);

  const parsedSong = useMemo(() => {
    try {
      return { song: parseChordContent(value), error: null, location: null };
    } catch (error) {
      const location = (error as { location?: { start?: ParserErrorLocation } }).location?.start || null;
      return { song: null, error: 'Hay una etiqueta o un acorde incompleto.', location };
    }
  }, [value]);

  useEffect(() => {
    if (value === lastValueRef.current) return;
    historyRef.current.past.push(lastValueRef.current);
    historyRef.current.past = historyRef.current.past.slice(-100);
    historyRef.current.future = [];
    lastValueRef.current = value;
    lastTypingAtRef.current = 0;
    setHistoryState({ canUndo: true, canRedo: false });
  }, [value]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || mobileView !== 'code' && window.innerWidth < 1024) return;
    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
    updateHorizontalScrollControl(textarea, horizontalScrollControlRef.current);
    if (keepScrollAtBottomRef.current && codeScrollRef.current) {
      codeScrollRef.current.scrollTop = codeScrollRef.current.scrollHeight;
      keepScrollAtBottomRef.current = false;
    }
    if (codeScrollRef.current) syncScrollProgress(codeScrollRef.current, previewScrollRef.current);
  }, [mobileView, value]);

  useEffect(() => {
    const codeContainer = codeScrollRef.current;
    if (!codeContainer) return;
    const resizeObserver = new ResizeObserver(() => {
      updateHorizontalScrollControl(textareaRef.current, horizontalScrollControlRef.current);
    });
    resizeObserver.observe(codeContainer);
    return () => resizeObserver.disconnect();
  }, []);

  const commitContentChange = (nextValue: string, typingTimestamp = 0) => {
    if (nextValue === value) return;
    const container = codeScrollRef.current;
    keepScrollAtBottomRef.current = Boolean(container && container.scrollHeight - container.scrollTop - container.clientHeight < 48);
    const continuesTyping = typingTimestamp > 0 && typingTimestamp - lastTypingAtRef.current < 800;
    if (!continuesTyping) {
      historyRef.current.past.push(value);
      historyRef.current.past = historyRef.current.past.slice(-100);
    }
    historyRef.current.future = [];
    lastTypingAtRef.current = typingTimestamp;
    lastValueRef.current = nextValue;
    setHistoryState({ canUndo: historyRef.current.past.length > 0, canRedo: false });
    onChange(nextValue);
  };

  const undo = () => {
    const previousValue = historyRef.current.past.pop();
    if (previousValue === undefined) return;
    historyRef.current.future.push(value);
    lastValueRef.current = previousValue;
    lastTypingAtRef.current = 0;
    setHistoryState({ canUndo: historyRef.current.past.length > 0, canRedo: true });
    onChange(previousValue);
  };

  const redo = () => {
    const nextValue = historyRef.current.future.pop();
    if (nextValue === undefined) return;
    historyRef.current.past.push(value);
    lastValueRef.current = nextValue;
    lastTypingAtRef.current = 0;
    setHistoryState({ canUndo: true, canRedo: historyRef.current.future.length > 0 });
    onChange(nextValue);
  };

  const handleEditorShortcut = (event: React.KeyboardEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if (key === 'y' || key === 'z' && event.shiftKey) {
      event.preventDefault();
      redo();
    }
  };

  const insertText = (before: string, after = '', fallbackSelection = '') => {
    const textarea = textareaRef.current;
    const insertionRange = insertionRangeRef.current;
    if (!textarea || !insertionRange) return;
    const selectionStart = insertionRange.start;
    const selectionEnd = insertionRange.end;
    const selectedText = value.slice(selectionStart, selectionEnd) || fallbackSelection;
    const nextValue = `${value.slice(0, selectionStart)}${before}${selectedText}${after}${value.slice(selectionEnd)}`;
    const nextCursor = selectionStart + before.length + selectedText.length;
    commitContentChange(nextValue);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      insertionRangeRef.current = { start: nextCursor, end: nextCursor };
    });
  };

  const captureInsertionRange = (textarea: HTMLTextAreaElement) => {
    insertionRangeRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
    if (!hasInsertionPoint) setHasInsertionPoint(true);
  };

  const insertSection = (name: string) => {
    const prefix = value && !value.endsWith('\n') ? '\n\n' : '';
    insertText(`${prefix}{start_of_${name}}\n`, `\n{end_of_${name}}\n`);
  };

  const insertChord = (chordName: string) => {
    insertText(`[${chordName}]`);
  };

  const focusError = () => {
    if (!parsedSong.location) return;
    setMobileView('code');
    const bracketOffset = value.lastIndexOf('[', parsedSong.location.offset);
    const braceOffset = value.lastIndexOf('{', parsedSong.location.offset);
    const lastDelimiterOffset = Math.max(bracketOffset, braceOffset);
    const closingDelimiter = value[lastDelimiterOffset] === '[' ? ']' : '}';
    const hasClosingDelimiter = lastDelimiterOffset >= 0 && value.slice(lastDelimiterOffset, parsedSong.location.offset).includes(closingDelimiter);
    const problemOffset = !hasClosingDelimiter && lastDelimiterOffset >= 0
      ? lastDelimiterOffset
      : Math.max(0, parsedSong.location.offset - 1);
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(problemOffset, Math.max(problemOffset + 1, parsedSong.location!.offset));
      const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 24;
      const container = codeScrollRef.current;
      if (container) container.scrollTop = Math.max(0, (parsedSong.location!.line - 3) * lineHeight);
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70" onKeyDown={handleEditorShortcut}>
      <div className="flex flex-col gap-2 border-b border-white/10 bg-zinc-900/80 p-2 sm:p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex shrink-0 items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500"><ListPlus size={14} /> Insertar</span>
          <InsertionCombobox
            items={SECTION_INSERTION_ITEMS}
            placeholder="Buscar sección…"
            emptyMessage="No existe ese tipo de sección."
            ariaLabel="Buscar e insertar sección"
            canInsert={hasInsertionPoint}
            onInsert={(item) => insertSection(item.id)}
          />
          <ChordSearchInput canInsert={hasInsertionPoint} onInsert={insertChord} />
          <button type="button" disabled={!hasInsertionPoint} onClick={() => insertText('{comment: ', '}', 'Nota')} className="flex min-h-9 items-center gap-1.5 rounded-lg border border-white/5 bg-zinc-800 px-3 text-xs font-bold text-zinc-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-30" title={hasInsertionPoint ? 'Insertar nota' : 'Primero ubica el cursor en el código'}><Braces size={14} /> Nota</button>

          <div className="flex rounded-lg border border-white/5 bg-zinc-950 p-0.5">
            <button type="button" onClick={undo} disabled={!historyState.canUndo} className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30" title="Deshacer (Ctrl/⌘ + Z)" aria-label="Deshacer"><Undo2 size={15} /></button>
            <button type="button" onClick={redo} disabled={!historyState.canRedo} className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30" title="Rehacer (Ctrl/⌘ + Shift + Z)" aria-label="Rehacer"><Redo2 size={15} /></button>
          </div>

          <div className="ml-auto flex rounded-lg border border-white/5 bg-zinc-950 p-0.5 lg:hidden">
            <button type="button" onClick={() => setMobileView('code')} className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-bold ${mobileView === 'code' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}><Code2 size={14} /> Código</button>
            <button type="button" onClick={() => setMobileView('preview')} className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-bold ${mobileView === 'preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}><Eye size={14} /> Vista previa</button>
          </div>
        </div>
      </div>

      {parsedSong.error && (
        <div className="flex items-center gap-3 border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">{parsedSong.error}{parsedSong.location ? ` Línea ${parsedSong.location.line}.` : ''}</span>
          {parsedSong.location && <button type="button" onClick={focusError} className="min-h-9 shrink-0 rounded-lg border border-red-400/20 px-3 text-xs font-bold transition-colors hover:bg-red-500/10">Ir al error</button>}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-2">
        <div className={`${mobileView === 'code' ? 'block' : 'hidden'} relative min-h-80 lg:block lg:border-r lg:border-white/10`}>
          <div className="hidden h-10 items-center gap-2 border-b border-white/5 px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 lg:flex"><Code2 size={14} /> Código ChordPro</div>
          <div ref={codeScrollRef} onScroll={(event) => syncScrollProgress(event.currentTarget, previewScrollRef.current)} className="h-[52dvh] min-h-80 overflow-y-auto custom-scrollbar lg:h-[560px]">
          <div className="flex min-w-0 bg-zinc-950">
          <div aria-hidden="true" className="min-h-[52dvh] shrink-0 select-none border-r border-white/5 bg-zinc-900/70 px-2 py-3 text-right font-mono text-sm leading-6 text-zinc-600 sm:min-w-12 sm:px-3 sm:py-5 sm:text-base lg:min-h-[600px]">
            {value.split('\n').map((_, lineIndex) => (
              <div key={lineIndex} className={parsedSong.location?.line === lineIndex + 1 ? 'font-bold text-red-400' : ''}>{lineIndex + 1}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="chords-source-editor min-h-[52dvh] min-w-0 flex-1 resize-none overflow-hidden whitespace-pre border-0 bg-zinc-950 p-3 pb-6 font-mono text-sm leading-6 text-zinc-100 outline-none focus:ring-1 focus:ring-inset focus:ring-primary-500/50 sm:p-5 sm:pb-7 sm:text-base lg:min-h-[600px]"
            value={value}
            onChange={(event) => commitContentChange(event.target.value, event.timeStamp)}
            onSelect={(event) => captureInsertionRange(event.currentTarget)}
            spellCheck={false}
            wrap="off"
          />
          </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 flex h-7 items-center gap-2 border-t border-white/10 bg-zinc-900 px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.25)]">
            <span aria-hidden="true" className="text-xs font-bold text-zinc-500">←</span>
            <input
              ref={horizontalScrollControlRef}
              type="range"
              min="0"
              max="0"
              defaultValue="0"
              onInput={(event) => {
                if (textareaRef.current) textareaRef.current.scrollLeft = Number(event.currentTarget.value);
              }}
              className="h-4 min-w-0 flex-1 cursor-ew-resize accent-primary-500 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Desplazamiento horizontal del código"
            />
            <span aria-hidden="true" className="text-xs font-bold text-zinc-500">→</span>
          </div>
        </div>

        <div className={`${mobileView === 'preview' ? 'block' : 'hidden'} min-h-80 bg-zinc-900/40 lg:block`}>
          <div className="hidden h-10 items-center gap-2 border-b border-white/5 px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 lg:flex"><Eye size={14} /> Vista previa</div>
          <div ref={previewScrollRef} className="h-[52dvh] min-h-80 overflow-y-auto p-4 font-mono custom-scrollbar sm:p-6 lg:h-[560px] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
            {!value.trim() && <p className="py-20 text-center font-sans text-sm text-zinc-500">Escribe una letra o añade una sección para comenzar.</p>}
            {parsedSong.song?.lines.map((line, lineIndex) => {
              const tags = line.items.filter((item) => item instanceof CSJS.Tag);
              if (tags.length > 0) {
                const visibleTags = tags.filter((tag) => !tag.name.startsWith('end_of_') && !METADATA_TAG_NAMES.has(tag.name));
                if (visibleTags.length === 0) return null;
                return <div key={lineIndex} className="mb-2 mt-3"><span className="rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-widest text-primary-300">{visibleTags.map((tag) => tag.value || tag.name.replace('start_of_', '')).join(' ')}</span></div>;
              }
              if (line.items.length === 0) return <div key={lineIndex} className="h-2" />;
              const hasLyrics = line.items.some((item) => item instanceof CSJS.ChordLyricsPair && Boolean(item.lyrics?.trim()));
              if (!hasLyrics) {
                const chordLine = line.items
                  .filter((item) => item instanceof CSJS.ChordLyricsPair && item.chords)
                  .map((item) => item instanceof CSJS.ChordLyricsPair ? item.chords : '')
                  .join(' ');
                return (
                  <div key={lineIndex} className="mb-1 whitespace-pre-wrap font-bold text-primary-400">{chordLine}</div>
                );
              }
              return (
                <div key={lineIndex} className="mb-1 flex flex-wrap items-end">
                  {line.items.map((item, itemIndex) => item instanceof CSJS.ChordLyricsPair ? (
                    <span key={itemIndex} className={`flex flex-col ${!item.lyrics && item.chords ? 'mr-5' : ''}`}>
                      <span className="min-h-6 whitespace-pre font-bold text-primary-400">{item.chords || ' '}</span>
                      <span className="min-h-6 whitespace-pre text-zinc-200">{item.lyrics || ' '}</span>
                    </span>
                  ) : null)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
