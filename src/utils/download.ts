import { db, Karaoke } from '../db';
import { API_BASE_URL } from '../config';

export const downloadKaraokeMp3 = async (karaoke: Karaoke) => {
  try {
    let url = '';
    let blob: Blob | null = null;
    
    if (karaoke.cloudUrl) {
      let fullUrl = karaoke.cloudUrl;
      if (fullUrl.startsWith('http')) {
        url = fullUrl;
      } else {
        url = `${API_BASE_URL}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
      }
      const response = await fetch(url);
      blob = await response.blob();
    } else {
      const fileRecord = await db.karaokeFiles.get(karaoke.id!);
      const data = fileRecord ? fileRecord.data : (karaoke as any).localFile;
      if (data) {
        blob = new Blob([data as any], { type: 'audio/mpeg' });
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
