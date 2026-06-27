import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, CheckCircle, XCircle, Loader2, Upload, AlertTriangle, SkipForward } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../../db';
import { useAuthStore } from '../../store/authStore';
import { API_BASE_URL } from '../../config';

interface ImportRow {
  artist: string;
  name: string;
  youtubeUrl: string;
}

type ImportStatus = 'pending' | 'downloading' | 'success' | 'skipped' | 'error';

interface ImportResult {
  row: ImportRow;
  status: ImportStatus;
  reason?: string; // for skipped or error
}

interface BulkImportKaraokeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const isValidYoutubeUrl = (url: string) => {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/.test(url.trim());
};

type Step = 'upload' | 'preview' | 'importing' | 'done';

export const BulkImportKaraokeModal = ({ isOpen, onClose }: BulkImportKaraokeModalProps) => {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [parseError, setParseError] = useState('');
  const [doneTab, setDoneTab] = useState<'success' | 'skipped' | 'error'>('success');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Skip header row if the third column doesn't look like a YouTube URL
        const startIndex = isValidYoutubeUrl(String(rawRows[0]?.[2] || '')) ? 0 : 1;

        const parsed: ImportRow[] = rawRows
          .slice(startIndex)
          .filter((r) => (r[0] || r[1] || r[2])) // skip fully empty rows
          .map((r) => ({
            artist: String(r[0] || '').trim(),
            name: String(r[1] || '').trim(),
            youtubeUrl: String(r[2] || '').trim(),
          }))
          .filter((r) => r.name); // must have a song name at minimum

        if (parsed.length === 0) {
          setParseError('No se encontraron filas válidas. Verifica que las columnas sean: A=Artista, B=Canción, C=Link YouTube.');
          return;
        }

        setRows(parsed);
        setResults(parsed.map((row) => ({ row, status: 'pending' })));
        setStep('preview');
      } catch {
        setParseError('Error al leer el archivo. Asegúrate de que sea un Excel válido (.xlsx o .xls).');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setStep('importing');
    setIsImporting(true);
    abortRef.current = false;
    const token = useAuthStore.getState().token;

    for (let i = 0; i < results.length; i++) {
      if (abortRef.current) break;

      const item = results[i];

      // --- SKIP: no YouTube link ---
      if (!item.row.youtubeUrl || !isValidYoutubeUrl(item.row.youtubeUrl)) {
        setResults((prev) => {
          const next = [...prev];
          next[i] = { ...item, status: 'skipped', reason: 'Sin link de YouTube' };
          return next;
        });
        continue;
      }

      setResults((prev) => {
        const next = [...prev];
        next[i] = { ...item, status: 'downloading' };
        return next;
      });

      try {
        // --- SKIP: exact duplicate (same name + same artist) ---
        const existing = await db.karaokes
          .filter((k) =>
            k.name.toLowerCase() === item.row.name.toLowerCase() &&
            (k.artist || '').toLowerCase() === (item.row.artist || 'desconocido').toLowerCase()
          )
          .first();

        if (existing) {
          setResults((prev) => {
            const next = [...prev];
            next[i] = { ...item, status: 'skipped', reason: 'Ya existe con ese nombre y artista' };
            return next;
          });
          continue;
        }

        // --- DOWNLOAD audio from YouTube ---
        const res = await fetch(`${API_BASE_URL}/api/karaokes/download-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ url: item.row.youtubeUrl }),
        });

        if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
        const data = await res.json();

        // --- SAVE to local DB ---
        await db.karaokes.add({
          name: item.row.name,
          artist: item.row.artist || 'Desconocido',
          youtubeUrl: item.row.youtubeUrl,
          cloudUrl: data.cloudUrl,
          hasLocalAudio: !!data.cloudUrl,
          localFileDirty: false,
          dateAdded: Date.now(),
        }) as number;

        setResults((prev) => {
          const next = [...prev];
          next[i] = { ...item, status: 'success' };
          return next;
        });
      } catch (err: any) {
        setResults((prev) => {
          const next = [...prev];
          next[i] = {
            ...item,
            status: 'error',
            reason: err?.message || 'Error desconocido',
          };
          return next;
        });
      }

      // Small delay between requests to avoid hammering the server
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsImporting(false);
    setStep('done');
    // Default to the tab with content
    const finalResults = results;
    if (finalResults.some(r => r.status === 'error')) setDoneTab('error');
    else if (finalResults.some(r => r.status === 'skipped')) setDoneTab('skipped');
    else setDoneTab('success');
  };

  const handleClose = () => {
    if (isImporting) abortRef.current = true;
    setStep('upload');
    setRows([]);
    setResults([]);
    setParseError('');
    setDoneTab('success');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const successCount = results.filter((r) => r.status === 'success').length;
  const skippedCount = results.filter((r) => r.status === 'skipped').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const doneCount = successCount + skippedCount + errorCount;
  const noLinkCount = rows.filter((r) => !r.youtubeUrl || !isValidYoutubeUrl(r.youtubeUrl)).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget && !isImporting) handleClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <FileSpreadsheet size={20} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Importar desde Excel</h2>
                <p className="text-xs text-zinc-400">Columnas: A=Artista · B=Canción · C=Link YouTube</p>
              </div>
            </div>
            {!isImporting && (
              <button onClick={handleClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                <X size={20} className="text-zinc-400" />
              </button>
            )}
          </div>

          {/* ── STEP 1: UPLOAD ── */}
          {step === 'upload' && (
            <div className="flex-1 flex flex-col gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all group"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  <Upload size={32} className="text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white mb-1">Haz clic para subir tu Excel</p>
                  <p className="text-sm text-zinc-400">Formatos: .xlsx o .xls</p>
                </div>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              <div className="bg-zinc-800/50 rounded-xl p-4 text-xs text-zinc-400 space-y-2">
                <p className="font-bold text-zinc-300">📋 Formato esperado:</p>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <span className="bg-zinc-800 rounded px-2 py-1.5 text-center">A: Artista</span>
                  <span className="bg-zinc-800 rounded px-2 py-1.5 text-center">B: Canción</span>
                  <span className="bg-zinc-800 rounded px-2 py-1.5 text-center">C: Link YouTube</span>
                </div>
                <ul className="text-zinc-500 space-y-0.5 pt-1 list-disc list-inside">
                  <li>La primera fila con encabezados se ignora automáticamente.</li>
                  <li>Artista vacío → se guarda como "Desconocido".</li>
                  <li>Sin link de YouTube → la fila se <strong className="text-yellow-400">omite</strong> (no se crea un karaoke vacío).</li>
                </ul>
              </div>

              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {/* ── STEP 2: PREVIEW ── */}
          {step === 'preview' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-3 mb-3">
                <p className="text-sm text-zinc-400 flex-1">
                  <span className="text-white font-bold">{rows.length} canciones</span> encontradas
                  {noLinkCount > 0 && (
                    <span className="ml-2 text-yellow-400 font-medium">· {noLinkCount} sin link (serán omitidas)</span>
                  )}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 max-h-[42vh]">
                {rows.map((row, i) => {
                  const noLink = !row.youtubeUrl || !isValidYoutubeUrl(row.youtubeUrl);
                  return (
                    <div key={i} className={`rounded-xl px-4 py-2.5 flex items-center gap-3 ${noLink ? 'bg-yellow-500/5 border border-yellow-500/10' : 'bg-zinc-800/50'}`}>
                      <span className="text-zinc-500 text-xs font-mono w-5 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{row.name}</p>
                        <p className="text-xs text-zinc-400 truncate">{row.artist || <em className="text-zinc-600">Sin artista → Desconocido</em>}</p>
                      </div>
                      {noLink
                        ? <span className="text-xs bg-yellow-500/20 text-yellow-400 rounded-lg px-2 py-0.5 shrink-0">Se omitirá</span>
                        : <span className="text-xs bg-red-500/20 text-red-400 rounded-lg px-2 py-0.5 shrink-0">YT</span>
                      }
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 mt-4 pt-4 border-t border-white/5">
                <button onClick={() => setStep('upload')} className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm transition-all">
                  Cambiar archivo
                </button>
                <button onClick={handleImport} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  Importar {rows.length - noLinkCount} canciones
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: IMPORTING (live progress) ── */}
          {step === 'importing' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-emerald-500/10 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-bold text-emerald-400">{successCount}</p>
                  <p className="text-xs text-zinc-400">Importadas</p>
                </div>
                <div className="bg-yellow-500/10 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-bold text-yellow-400">{skippedCount}</p>
                  <p className="text-xs text-zinc-400">Omitidas</p>
                </div>
                <div className="bg-red-500/10 rounded-xl p-2.5 text-center">
                  <p className="text-xl font-bold text-red-400">{errorCount}</p>
                  <p className="text-xs text-zinc-400">Fallidas</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-3">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(doneCount / results.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mb-3 text-right">{doneCount} / {results.length}</p>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 max-h-[38vh]">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      r.status === 'success'    ? 'bg-emerald-500/10' :
                      r.status === 'error'      ? 'bg-red-500/10'     :
                      r.status === 'skipped'    ? 'bg-yellow-500/5'   :
                      r.status === 'downloading'? 'bg-primary-500/10' :
                      'bg-zinc-800/30'
                    }`}
                  >
                    <div className="shrink-0 w-4">
                      {r.status === 'success'    && <CheckCircle  size={16} className="text-emerald-400" />}
                      {r.status === 'error'      && <XCircle      size={16} className="text-red-400" />}
                      {r.status === 'skipped'    && <SkipForward  size={16} className="text-yellow-400" />}
                      {r.status === 'downloading'&& <Loader2      size={16} className="text-primary-400 animate-spin" />}
                      {r.status === 'pending'    && <div className="w-4 h-4 rounded-full border border-zinc-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{r.row.name}</p>
                      {r.reason && <p className="text-xs text-zinc-400 truncate">{r.reason}</p>}
                    </div>
                    <span className="text-xs text-zinc-500 shrink-0 max-w-[100px] truncate">{r.row.artist || 'Desconocido'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 4: DONE (summary tabs) ── */}
          {step === 'done' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Summary grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => setDoneTab('success')}
                  className={`rounded-xl p-3 text-center transition-all border ${doneTab === 'success' ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-emerald-500/5 border-transparent hover:border-emerald-500/20'}`}
                >
                  <p className="text-2xl font-bold text-emerald-400">{successCount}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Importadas ✅</p>
                </button>
                <button
                  onClick={() => setDoneTab('skipped')}
                  className={`rounded-xl p-3 text-center transition-all border ${doneTab === 'skipped' ? 'bg-yellow-500/20 border-yellow-500/40' : 'bg-yellow-500/5 border-transparent hover:border-yellow-500/20'}`}
                >
                  <p className="text-2xl font-bold text-yellow-400">{skippedCount}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Omitidas ⚠️</p>
                </button>
                <button
                  onClick={() => setDoneTab('error')}
                  className={`rounded-xl p-3 text-center transition-all border ${doneTab === 'error' ? 'bg-red-500/20 border-red-500/40' : 'bg-red-500/5 border-transparent hover:border-red-500/20'}`}
                >
                  <p className="text-2xl font-bold text-red-400">{errorCount}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Fallidas ❌</p>
                </button>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0 max-h-[36vh]">
                {results
                  .filter((r) => r.status === doneTab)
                  .map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                        doneTab === 'success' ? 'bg-emerald-500/10' :
                        doneTab === 'skipped' ? 'bg-yellow-500/5 border border-yellow-500/10' :
                        'bg-red-500/10'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{r.row.name}</p>
                        <p className="text-xs text-zinc-400 truncate">
                          {r.row.artist || 'Desconocido'}
                          {r.reason && <span className="text-zinc-500"> · {r.reason}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                {results.filter((r) => r.status === doneTab).length === 0 && (
                  <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">
                    No hay elementos en esta categoría.
                  </div>
                )}
              </div>

              <button onClick={handleClose} className="mt-4 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                Listo — Ver mis Karaokes
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
