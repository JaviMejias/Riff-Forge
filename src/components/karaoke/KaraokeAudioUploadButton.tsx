import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import Swal from 'sweetalert2';
import { db, type Karaoke } from '../../db';

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

  const selectFile = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    inputRef.current?.click();
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
      const data = new Uint8Array(await file.arrayBuffer());
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
        onClick={selectFile}
        disabled={isUploading}
        title="Añadir MP3"
      >
        {isUploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
        {!iconOnly && <span>{isUploading ? 'Añadiendo MP3...' : 'Añadir MP3'}</span>}
      </button>
    </>
  );
};
