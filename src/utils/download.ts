import { db } from '../db';
import type { Karaoke } from '../db';
import { API_BASE_URL } from '../config';

type LegacyKaraoke = Karaoke & {
  localFile?: BlobPart;
};

export const downloadKaraokeMp3 = async (karaoke: Karaoke) => {
  try {
    let url = '';
    let blob: Blob | null = null;
    
    if (karaoke.cloudUrl) {
      const fullUrl = karaoke.cloudUrl;
      if (fullUrl.startsWith('http')) {
        url = fullUrl;
      } else {
        url = `${API_BASE_URL}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
      }
      const response = await fetch(url);
      blob = await response.blob();
    } else {
      const fileRecord = await db.karaokeFiles.get(karaoke.id!);
      const data: BlobPart | undefined = fileRecord
        ? new Uint8Array(fileRecord.data)
        : (karaoke as LegacyKaraoke).localFile;
      if (data) {
        blob = new Blob([data], { type: 'audio/mpeg' });
      }
    }
    
    if (blob) {
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${karaoke.artist} - ${karaoke.name}.mp3`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      }, 100);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error downloading MP3', error);
    return false;
  }
};
