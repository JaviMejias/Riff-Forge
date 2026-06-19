import { useState } from 'react';
import { Video, Music, User, Link, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { API_BASE_URL } from '../../config';
import { Modal } from '../Modal';

interface CreateKaraokeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { title: string; artist: string; url: string; cloudUrl?: string; textContent?: string }) => void;
}

export const CreateKaraokeModal = ({ isOpen, onClose, onSuccess }: CreateKaraokeModalProps) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [url, setUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }

    setError('');
    let cloudUrl = undefined;
    let fetchedLyrics = undefined;

    if (url.trim()) {
      setIsDownloading(true);
      try {
        const token = useAuthStore.getState().token;
        const res = await fetch(`${API_BASE_URL}/api/karaokes/download-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ url: url.trim() })
        });

        if (!res.ok) {
          throw new Error('No se pudo descargar el audio');
        }

        const data = await res.json();
        cloudUrl = data.cloudUrl;

        // Intentar descargar la letra automáticamente
        try {
          const params = new URLSearchParams({ title: title.trim(), artist: artist.trim() || '' });
          const lyricsRes = await fetch(`${API_BASE_URL}/api/karaokes/lyrics?${params}`, {
            headers: {
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
          });
          if (lyricsRes.ok) {
            const lyricsData = await lyricsRes.json();
            fetchedLyrics = lyricsData.lyrics;
          }
        } catch (e) {
          console.error('Error fetching lyrics during creation:', e);
        }

      } catch (err) {
        console.error(err);
        setError('Error al descargar el audio. Verifica el enlace.');
        setIsDownloading(false);
        return; // Don't save if the user wanted a download and it failed
      }
    }

    onSuccess({
      title: title.trim(),
      artist: artist.trim() || 'Desconocido',
      url: url.trim(),
      cloudUrl,
      textContent: fetchedLyrics
    });

    // Reset form
    setTitle('');
    setArtist('');
    setUrl('');
    setIsDownloading(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Añadir Karaoke"
      subtitle="Añade un enlace de YouTube para cantar tus canciones favoritas."
      icon={<Video size={24} />}
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
            <Music size={16} className="text-primary-500" /> Título de la canción *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isDownloading}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600 shadow-inner disabled:opacity-50"
            placeholder="Ej: Bohemian Rhapsody"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
            <User size={16} className="text-primary-500" /> Artista (Opcional)
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            disabled={isDownloading}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600 shadow-inner disabled:opacity-50"
            placeholder="Ej: Queen"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
            <Link size={16} className="text-primary-500" /> URL de YouTube (Opcional)
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isDownloading}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600 shadow-inner disabled:opacity-50"
            placeholder="Ej: https://www.youtube.com/watch?v=..."
          />
          <p className="text-xs text-zinc-500 mt-2">Si ingresas un enlace de YouTube, se descargará automáticamente el audio MP3.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2 border-t border-white/5 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl font-bold transition-all text-center disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isDownloading}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-zinc-950 font-black rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transform hover:-translate-y-0.5 text-center flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none disabled:shadow-none"
          >
            {isDownloading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Descargando audio...
              </>
            ) : (
              'Guardar Karaoke'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
