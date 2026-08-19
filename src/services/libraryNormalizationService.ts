import type { Song } from '../db';
import { synchronizeChordProMetadata } from './chordProService';
import { normalizeSongMetadata } from './songMetadataService';

export interface SongNormalizationChange {
  song: Song;
  updates: Partial<Song>;
  changedFields: Array<'title' | 'artist' | 'key' | 'tuning' | 'chordPro'>;
}

export const buildLibraryNormalizationPlan = (songs: Song[]): SongNormalizationChange[] => songs.flatMap((song) => {
  const normalized = normalizeSongMetadata({
    title: song.name,
    artist: song.artist,
    key: song.originalKey,
    tuning: song.tuning
  });
  const updates: Partial<Song> = {};
  const changedFields: SongNormalizationChange['changedFields'] = [];
  const title = normalized.title || song.name;
  const artist = normalized.artist || 'Desconocido';

  if (title !== song.name) {
    updates.name = title;
    changedFields.push('title');
  }
  if (artist !== song.artist) {
    updates.artist = artist;
    changedFields.push('artist');
  }
  if (normalized.key !== song.originalKey) {
    updates.originalKey = normalized.key;
    changedFields.push('key');
  }
  if (normalized.tuning !== song.tuning) {
    updates.tuning = normalized.tuning;
    changedFields.push('tuning');
  }

  if (song.textContent?.trim()) {
    try {
      const synchronizedContent = synchronizeChordProMetadata(song.textContent, {
        title,
        artist,
        key: normalized.key,
        tuning: normalized.tuning,
        capo: song.capo,
        strummingPattern: song.strummingPattern
      });
      if (synchronizedContent !== song.textContent) {
        updates.textContent = synchronizedContent;
        changedFields.push('chordPro');
      }
    } catch {
      // Keep malformed legacy content unchanged so metadata cleanup can still continue.
    }
  }

  return changedFields.length ? [{ song, updates, changedFields }] : [];
});
