import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import Swal from 'sweetalert2';
import { db, type Karaoke } from '../../db';
import { API_BASE_URL } from '../../config';
import { useAuthStore } from '../../store/authStore';

interface KaraokeAudioUploadButtonProps {
  karaoke: Karaoke;
  className: string;
  iconOnly?: boolean;
  onUploaded?: () => void;
}

export const KaraokeAudioUploadButton = ({
  karaoke,
  className,
  iconOnly = false,
  onUploaded,
}: KaraokeAudioUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const saveAudio = async (data: Uint8Array) => {
    if (karaoke.id === undefined) throw new Error('Karaoke has no local ID');
    await db.transaction('rw', [db.karaokes, db.karaokeFiles], async () => {
      await db.karaokeFiles.put({ karaokeId: karaoke.id!, data });
      await db.karaokes.update(karaoke.id!, {
        hasLocalAudio: true,
        localFileDirty: true,
        updatedAt: Date.now(),
      });
    });
    onUploaded?.();
    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'MP3 añadido y pendiente de sincronización',
      showConfirmButton: false,
      timer: 2200,
      background: '#18181b',
      color: '#f4f4f5',
    });
  };

  const downloadFromYoutube = async () => {
    if (!karaoke.youtubeUrl) {
      inputRef.current?.click();
      return;
    }

    setIsUploading(true);
    Swal.fire({
      title: 'Descargando desde YouTube...',
      text: 'Esto puede tardar un momento.',
      allowOutsideClick: false,
      showConfirmButton: false,
      background: '#18181b',
      color: '#f4f4f5',
      didOpen: () => Swal.showLoading(),
    });

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`${API_BASE_URL}/api/karaokes/download-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: karaoke.youtubeUrl }),
      });
      if (!response.ok) throw new Error(`YouTube download failed: ${response.status}`);

      const result = await response.json() as { cloudUrl?: string };
      if (!result.cloudUrl) throw new Error('YouTube download returned no file');
      const fileUrl = /^https?:\/\//.test(result.cloudUrl)
        ? result.cloudUrl
        : `${API_BASE_URL}${result.cloudUrl.startsWith('/') ? '' : '/'}${result.cloudUrl}`;
      const fileResponse = await fetch(fileUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      if (!fileResponse.ok) throw new Error(`Downloaded MP3 could not be read: ${fileResponse.status}`);

      Swal.close();
      await saveAudio(new Uint8Array(await fileResponse.arrayBuffer()));
    } catch (error) {
      console.warn('Failed to download karaoke MP3 from YouTube:', error);
      const fallback = await Swal.fire({
        icon: 'warning',
        title: 'YouTube no permitió la descarga',
        text: 'El karaoke sigue intacto. Puedes añadir un MP3 guardado en este dispositivo.',
        confirmButtonText: 'Subir MP3',
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
        background: '#18181b',
        color: '#f4f4f5',
      });
      if (fallback.isConfirmed) inputRef.current?.click();
    } finally {
      setIsUploading(false);
    }
  };

  const chooseSource = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!karaoke.youtubeUrl) {
      inputRef.current?.click();
      return;
    }

    const choice = await Swal.fire({
      icon: 'question',
      title: 'Añadir MP3',
      text: '¿De dónde quieres obtener el audio?',
      confirmButtonText: 'Descargar desde YouTube',
      denyButtonText: 'Subir desde dispositivo',
      showDenyButton: true,
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5',
    });
    if (choice.isConfirmed) await downloadFromYoutube();
    if (choice.isDenied) inputRef.current?.click();
  };

  const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || karaoke.id === undefined) return;

    if (!file.name.toLowerCase().endsWith('.mp3')) {
      await Swal.fire({
        icon: 'error',
        title: 'Archivo no compatible',
        text: 'Selecciona un archivo MP3.',
        background: '#18181b',
        color: '#f4f4f5',
      });
      return;
    }

    setIsUploading(true);
    try {
      await saveAudio(new Uint8Array(await file.arrayBuffer()));
    } catch (error) {
      console.error('Failed to attach karaoke MP3:', error);
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo añadir el MP3',
        text: 'El archivo original no fue modificado. Intenta nuevamente.',
        background: '#18181b',
        color: '#f4f4f5',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,audio/mpeg"
        className="hidden"
        onChange={uploadFile}
      />
      <button
        type="button"
        className={className}
        onClick={chooseSource}
        disabled={isUploading}
        title="Añadir MP3"
      >
        {isUploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
        {!iconOnly && <span>{isUploading ? 'Añadiendo MP3...' : 'Añadir MP3'}</span>}
      </button>
    </>
  );
};
