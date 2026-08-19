import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { db } from '../db';
import type { PdfChordImportResult } from '../services/pdfChordImportService';
import { sanitizeChordText } from '../utils/chordText';
import { ChordProEditor } from './chords/ChordProEditor';
import { Modal } from './Modal';

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      await Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Revisa el título y el contenido de la cifra.' });
      return;
    }

    setIsSaving(true);
    try {
      const finalTitle = title.trim();
      const finalArtist = artist.trim() || 'Desconocido';
      const duplicate = await db.songs
        .filter((song) => song.name.toLowerCase() === finalTitle.toLowerCase()
          && (song.artist || 'Desconocido').toLowerCase() === finalArtist.toLowerCase())
        .first();

      if (duplicate) {
        const confirmation = await Swal.fire({
          icon: 'warning',
          title: 'La canción ya existe',
          text: '¿Quieres reemplazar su letra y acordes con el contenido del PDF?',
          showCancelButton: true,
          confirmButtonText: 'Reemplazar',
          cancelButtonText: 'Cancelar'
        });
        if (!confirmation.isConfirmed || !duplicate.id) return;
        await db.songs.update(duplicate.id, {
          type: duplicate.data ? duplicate.type : 'text',
          textContent: sanitizeChordText(content),
          originalKey: originalKey.trim() || undefined,
          tuning: tuning.trim() || undefined,
          updatedAt: Date.now(),
          syncDirty: true
        });
        onSuccess(duplicate.id);
        onClose();
        return;
      }

      const songId = await db.songs.add({
        name: finalTitle,
        artist: finalArtist,
        type: 'text',
        textContent: sanitizeChordText(content),
        originalKey: originalKey.trim() || undefined,
        tuning: tuning.trim() || undefined,
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

        <div className={`mb-3 grid-cols-2 gap-2 sm:mb-4 sm:grid sm:gap-4 ${showMobileMetadata ? 'grid' : 'hidden'}`}>
          <label className="text-sm font-bold text-zinc-300">
            Título *
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 font-normal text-zinc-200 outline-none focus:border-primary-500/50 sm:mt-2 sm:px-4 sm:py-3" />
          </label>
          <label className="text-sm font-bold text-zinc-300">
            Artista
            <input value={artist} onChange={(event) => setArtist(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 font-normal text-zinc-200 outline-none focus:border-primary-500/50 sm:mt-2 sm:px-4 sm:py-3" />
          </label>
          <label className="text-sm font-bold text-zinc-300">
            Tonalidad original
            <input value={originalKey} onChange={(event) => setOriginalKey(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 font-normal text-zinc-200 outline-none focus:border-primary-500/50 sm:mt-2 sm:px-4 sm:py-3" />
          </label>
          <label className="text-sm font-bold text-zinc-300">
            Afinación
            <input value={tuning} onChange={(event) => setTuning(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2.5 font-normal text-zinc-200 outline-none focus:border-primary-500/50 sm:mt-2 sm:px-4 sm:py-3" />
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
