import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleHelp, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { db } from '../db';
import type { PdfChordImportResult } from '../services/pdfChordImportService';
import { sanitizeChordText } from '../utils/chordText';
import { assessSongMetadata, normalizeMusicalKey, normalizeSongMetadata, normalizeTuning } from '../services/songMetadataService';
import { ChordProEditor } from './chords/ChordProEditor';
import { Modal } from './Modal';
import { synchronizeChordProMetadata } from '../services/chordProService';
import { findDuplicateSong } from '../services/songDuplicateService';

interface ImportPdfSongModalProps {
  imported: PdfChordImportResult;
  onClose: () => void;
  onSuccess: (songId: number) => void;
}

export const ImportPdfSongModal = ({ imported, onClose, onSuccess }: ImportPdfSongModalProps) => {
  const [title, setTitle] = useState(imported.metadata.title || '');
  const [artist, setArtist] = useState(imported.metadata.artist || '');
  const [originalKey, setOriginalKey] = useState(imported.metadata.key || '');
  const [tuning, setTuning] = useState(imported.metadata.tuning || '');
  const [content, setContent] = useState(imported.content);
  const [isSaving, setIsSaving] = useState(false);
  const [showMobileMetadata, setShowMobileMetadata] = useState(false);
  const metadataAssessment = useMemo(
    () => assessSongMetadata({ title, artist, key: originalKey, tuning }),
    [artist, originalKey, title, tuning]
  );

  const normalizeTextFields = () => {
    const normalized = normalizeSongMetadata({ title, artist });
    setTitle(normalized.title || '');
    setArtist(normalized.artist || '');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      await Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Revisa el título y el contenido de la cifra.' });
      return;
    }

    setIsSaving(true);
    try {
      const normalized = normalizeSongMetadata({ title, artist, key: originalKey, tuning });
      const finalTitle = normalized.title || '';
      const finalArtist = normalized.artist || 'Desconocido';
      const synchronizedContent = sanitizeChordText(synchronizeChordProMetadata(content, {
        title: finalTitle,
        artist: finalArtist,
        key: normalized.key,
        tuning: normalized.tuning
      }));
      const duplicate = findDuplicateSong(await db.songs.toArray(), finalTitle, finalArtist);

      if (duplicate) {
        const confirmation = await Swal.fire({
          icon: 'warning',
          title: 'Encontramos una canción similar',
          text: `Ya existe “${duplicate.name}” de ${duplicate.artist || 'Desconocido'}.`,
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: 'Reemplazar',
          denyButtonText: 'Guardar otra versión',
          cancelButtonText: 'Cancelar'
        });
        if (confirmation.isDismissed) return;
        if (confirmation.isConfirmed && duplicate.id) {
          await db.songs.update(duplicate.id, {
            type: duplicate.data ? duplicate.type : 'text',
            textContent: synchronizedContent,
            originalKey: normalized.key,
            tuning: normalized.tuning,
            updatedAt: Date.now(),
            syncDirty: true
          });
          onSuccess(duplicate.id);
          onClose();
          return;
        }
      }

      const songId = await db.songs.add({
        name: finalTitle,
        artist: finalArtist,
        type: 'text',
        textContent: synchronizedContent,
        originalKey: normalized.key,
        tuning: normalized.tuning,
        dateAdded: Date.now(),
        updatedAt: Date.now(),
        syncDirty: true
      });
      onSuccess(songId as number);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Revisar PDF importado"
      subtitle="Corrige los datos o la alineación antes de añadir la canción."
      icon={<FileText size={24} />}
      size="wide"
    >
      <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4 custom-scrollbar sm:p-6">
        <button
          type="button"
          onClick={() => setShowMobileMetadata((isVisible) => !isVisible)}
          className="mb-2 flex min-h-10 items-center justify-between rounded-xl border border-white/10 bg-zinc-950/60 px-3 text-left text-sm font-bold text-zinc-300 sm:hidden"
          aria-expanded={showMobileMetadata}
        >
          <span className="min-w-0 truncate">Datos: {title || 'Sin título'} · {originalKey || 'Tono sin definir'}</span>
          <ChevronDown size={16} className={`shrink-0 transition-transform ${showMobileMetadata ? 'rotate-180' : ''}`} />
        </button>

        <div className="mb-2 flex flex-wrap gap-1.5 sm:mb-3" aria-label="Estado de los metadatos detectados">
          {metadataAssessment.map((item) => {
            const isDetected = item.status === 'detected';
            const isReview = item.status === 'review';
            const Icon = isDetected ? CheckCircle2 : isReview ? AlertTriangle : CircleHelp;
            const detail = isDetected ? 'detectado' : isReview ? 'revisar' : 'no detectado';
            return (
              <span
                key={item.field}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold sm:text-xs ${
                  isDetected
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                }`}
                title={`${item.label}: ${detail}`}
              >
                <Icon size={12} /> {item.label} <span className="font-normal opacity-75">{detail}</span>
              </span>
            );
          })}
        </div>

        <div className={`mb-3 grid-cols-2 gap-2 sm:mb-4 sm:grid sm:gap-4 ${showMobileMetadata ? 'grid' : 'hidden'}`}>
          <label className="text-sm font-bold text-zinc-300">
            Título *
            <input value={title} onChange={(event) => setTitle(event.target.value)} onBlur={normalizeTextFields} className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 font-normal text-zinc-200 outline-none focus:border-primary-500/50 sm:mt-2 sm:px-4 sm:py-3" />
          </label>
          <label className="text-sm font-bold text-zinc-300">
            Artista
            <input value={artist} onChange={(event) => setArtist(event.target.value)} onBlur={normalizeTextFields} className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 font-normal text-zinc-200 outline-none focus:border-primary-500/50 sm:mt-2 sm:px-4 sm:py-3" />
          </label>
          <label className="text-sm font-bold text-zinc-300">
            Tonalidad original
            <input value={originalKey} onChange={(event) => setOriginalKey(event.target.value)} onBlur={() => setOriginalKey(normalizeMusicalKey(originalKey) || '')} className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 font-normal text-zinc-200 outline-none focus:border-primary-500/50 sm:mt-2 sm:px-4 sm:py-3" />
          </label>
          <label className="text-sm font-bold text-zinc-300">
            Afinación
            <input value={tuning} onChange={(event) => setTuning(event.target.value)} onBlur={() => setTuning(normalizeTuning(tuning) || '')} className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 font-normal text-zinc-200 outline-none focus:border-primary-500/50 sm:mt-2 sm:px-4 sm:py-3" />
          </label>
        </div>

        <div className="mb-2 rounded-xl border border-sky-500/15 bg-sky-500/5 px-3 py-1.5 text-xs text-sky-200 sm:mb-3 sm:py-2">
          Se procesaron {imported.importedPages} página(s) musicales y se omitieron {imported.skippedPages} página(s) vacías o de resumen.
        </div>
        <ChordProEditor value={content} onChange={setContent} />

        <div className="sticky bottom-0 -mx-4 -mb-4 mt-5 flex flex-col-reverse justify-end gap-2 border-t border-white/10 bg-zinc-900/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:-mb-6 sm:flex-row sm:px-6 sm:py-4">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-6 font-bold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">Cancelar</button>
          <button type="submit" disabled={isSaving} className="min-h-11 rounded-xl bg-primary-500 px-6 font-bold text-zinc-950 transition-colors hover:bg-primary-400 disabled:opacity-50">
            {isSaving ? 'Guardando…' : 'Guardar canción'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
