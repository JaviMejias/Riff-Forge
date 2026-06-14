import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Modal } from './Modal';
import { db } from '../db';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

interface PasteChordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSongId: number) => void;
}

export const PasteChordsModal = ({ isOpen, onClose, onSuccess }: PasteChordsModalProps) => {
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [originalKey, setOriginalKey] = useState('');
  const [tuning, setTuning] = useState('');
  const [capo, setCapo] = useState('');
  const [strummingPattern, setStrummingPattern] = useState('');
  const [textContent, setTextContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !textContent.trim()) {
      MySwal.fire({
        title: 'Faltan datos',
        text: 'Debes introducir al menos un Título y el texto de la canción.',
        icon: 'warning',
        background: '#18181b',
        color: '#f4f4f5',
        confirmButtonColor: '#f59e0b'
      });
      return;
    }

    const finalName = name.trim();
    const finalArtist = artist.trim() || 'Desconocido';

    const existingSongs = await db.songs.toArray();
    const existingSong = existingSongs.find(s => 
      s.name.toLowerCase() === finalName.toLowerCase() && 
      (s.artist || 'Desconocido').toLowerCase() === finalArtist.toLowerCase()
    );

    let newId: number;

    if (existingSong && existingSong.id) {
      await db.songs.update(existingSong.id, {
        textContent: textContent,
        originalKey: originalKey.trim() || existingSong.originalKey,
        tuning: tuning.trim() || existingSong.tuning,
        capo: capo.trim() || existingSong.capo,
        strummingPattern: strummingPattern.toUpperCase().trim() || existingSong.strummingPattern,
        // Mantener type actual, o cambiarlo a 'text' si no tenía data. Lo dejamos intacto.
      });
      newId = existingSong.id;
    } else {
      newId = await db.songs.add({
        name: finalName,
        artist: finalArtist,
        type: 'text',
        textContent: textContent,
        originalKey: originalKey.trim() || undefined,
        tuning: tuning.trim() || undefined,
        capo: capo.trim() || undefined,
        strummingPattern: strummingPattern.toUpperCase().trim() || undefined,
        dateAdded: Date.now()
      }) as number;
    }

    // Reset form
    setName('');
    setArtist('');
    setOriginalKey('');
    setTuning('');
    setCapo('');
    setStrummingPattern('');
    setTextContent('');
    
    onSuccess(newId as number);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pegar Acordes"
      subtitle="Pega letras y acordes desde Cifra Club o Ultimate Guitar."
      icon={<FileText size={24} />}
    >
      <form onSubmit={handleSubmit} className="p-6 flex flex-col h-[70vh] max-h-[600px]">
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-zinc-300 mb-2">Título *</label>
            <input
              type="text"
              placeholder="Ej: Wonderwall"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl py-3 px-4 text-zinc-200 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold text-zinc-300 mb-2">Artista</label>
            <input
              type="text"
              placeholder="Ej: Oasis"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl py-3 px-4 text-zinc-200 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-zinc-300 mb-2">Tonalidad Original</label>
            <select
              value={originalKey}
              onChange={(e) => setOriginalKey(e.target.value)}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl py-3 px-4 text-zinc-200 focus:outline-none focus:border-amber-500/50 cursor-pointer appearance-none"
            >
              <option value="">Desconocida / No especificada</option>
              <optgroup label="Mayores">
                {['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'].map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </optgroup>
              <optgroup label="Menores">
                {['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'].map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold text-zinc-300 mb-2">Afinación</label>
            <input
              type="text"
              placeholder="Ej: Estándar, Drop D (Opcional)"
              value={tuning}
              onChange={(e) => setTuning(e.target.value)}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl py-3 px-4 text-zinc-200 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-zinc-300 mb-2">Capotraste</label>
            <input
              type="text"
              placeholder="Ej: Traste 2, Capo 5 (Opcional)"
              value={capo}
              onChange={(e) => setCapo(e.target.value)}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl py-3 px-4 text-zinc-200 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold text-zinc-300 mb-2">Patrón de Rasgueo</label>
            <input
              type="text"
              placeholder="Ej: D D U U D U (Opcional)"
              value={strummingPattern}
              onChange={(e) => setStrummingPattern(e.target.value)}
              className="w-full bg-zinc-950/80 border border-white/10 rounded-xl py-3 px-4 text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono"
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 mb-6">
          <label className="block text-sm font-bold text-zinc-300 mb-2">Letra y Acordes *</label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="[C]Today is [Em]gonna be the day..."
            className="flex-1 w-full bg-zinc-950/80 border border-white/10 rounded-xl py-3 px-4 text-zinc-200 focus:outline-none focus:border-amber-500/50 resize-none font-mono text-sm leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)]"
          >
            Guardar Canción
          </button>
        </div>
      </form>
    </Modal>
  );
};
