import type { ChordDef } from '../chords';
import { db } from '../db';
import type { Karaoke, KaraokeFile, KaraokePlaylist, Playlist, Song } from '../db';

export const BACKUP_VERSION = 3;
const SAFE_SETTING_KEYS = ['ui-storage', 'riff-forge-player-storage'];
const DELETION_BACKUP_KEY = 'sync_v2_pending_deletions';
const SYNC_CURSOR_KEY = 'sync_v2_cursor';

type EncodedSong = Song & { dataBase64?: string };
type EncodedKaraokeFile = KaraokeFile & { dataBase64?: string };

interface BackupData {
  songs: EncodedSong[];
  playlists: Playlist[];
  customChords: ChordDef[];
  karaokes: Karaoke[];
  karaokePlaylists: KaraokePlaylist[];
  karaokeFiles: EncodedKaraokeFile[];
  settings: Record<string, unknown>;
}

interface BackupFile {
  version: number;
  timestamp?: number;
  ownerId?: string | null;
  data?: Partial<BackupData>;
}

export interface ParsedBackup extends Omit<BackupData, 'songs' | 'karaokeFiles' | 'settings'> {
  songs: Song[];
  karaokeFiles: KaraokeFile[];
  settings: Record<string, string>;
}

export interface CreatedBackup {
  json: string;
  missingFileCount: number;
}

export type RestoreMode = 'replace' | 'merge';

export class BackupAccountMismatchError extends Error {}

const withoutLocalId = <T extends { id?: number }>(record: T): Omit<T, 'id'> => {
  const copy = { ...record };
  delete copy.id;
  return copy as Omit<T, 'id'>;
};

const validCollection = (value: unknown) => Array.isArray(value) && value.every(item => item && typeof item === 'object' && !Array.isArray(item));

export const uint8ToBase64 = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(''));
};

export const base64ToUint8 = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index++) bytes[index] = binaryString.charCodeAt(index);
  return bytes;
};

export const createLibraryBackup = async (ownerId: string | null): Promise<CreatedBackup> => {
  const songs = (await db.songs.toArray()).filter(song => !song.isTemporary && !song.deletedAt);
  const songIds = new Set(songs.map(song => song.id).filter((id): id is number => typeof id === 'number'));
  const playlists = (await db.playlists.toArray()).filter(playlist => !playlist.deletedAt).map(playlist => ({
    ...playlist,
    songIds: playlist.songIds.filter(id => songIds.has(id))
  }));
  const customChords = (await db.customChords.toArray()).filter(chord => !chord.deletedAt);
  const karaokes = (await db.karaokes.toArray()).filter(karaoke => !karaoke.deletedAt);
  const karaokeIds = new Set(karaokes.map(karaoke => karaoke.id).filter((id): id is number => typeof id === 'number'));
  const karaokePlaylists = (await db.karaokePlaylists.toArray()).filter(playlist => !playlist.deletedAt).map(playlist => ({
    ...playlist,
    karaokeIds: playlist.karaokeIds.filter(id => karaokeIds.has(id))
  }));
  const karaokeFiles = (await db.karaokeFiles.toArray()).filter(file => karaokeIds.has(file.karaokeId));
  const settings: Record<string, string> = {};
  for (const key of SAFE_SETTING_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) settings[key] = value;
  }

  const optimizedSongs = songs.map(song => song.data
    ? { ...song, dataBase64: uint8ToBase64(song.data), data: undefined }
    : song);
  const optimizedKaraokeFiles = karaokeFiles.map(file => file.data
    ? { ...file, dataBase64: uint8ToBase64(file.data), data: undefined }
    : file);
  const missingSongFiles = songs.filter(song => song.type !== 'text' && !song.data).length;
  const missingKaraokeFiles = karaokes.length - karaokeFiles.length;

  return {
    json: JSON.stringify({
      version: BACKUP_VERSION,
      timestamp: Date.now(),
      ownerId,
      manifest: {
        songs: songs.length,
        songFiles: songs.filter(song => !!song.data).length,
        karaokes: karaokes.length,
        karaokeFiles: karaokeFiles.length
      },
      data: { songs: optimizedSongs, playlists, customChords, karaokes, karaokePlaylists, karaokeFiles: optimizedKaraokeFiles, settings }
    }),
    missingFileCount: missingSongFiles + missingKaraokeFiles
  };
};

export const parseLibraryBackup = (json: string, currentUserId: string | null): ParsedBackup => {
  const backup = JSON.parse(json) as BackupFile;
  if (![2, BACKUP_VERSION].includes(backup.version) || !backup.data) throw new Error('invalid_backup');
  const { songs = [], playlists = [], customChords = [], karaokes = [], karaokePlaylists = [], karaokeFiles = [], settings = {} } = backup.data;
  if (![songs, playlists, customChords, karaokes, karaokePlaylists, karaokeFiles].every(validCollection) || !settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('invalid_backup');
  }
  if (backup.version === BACKUP_VERSION && backup.ownerId && currentUserId && backup.ownerId !== currentUserId) {
    throw new BackupAccountMismatchError('backup_account_mismatch');
  }

  const restoredSongs = songs.map(song => song.dataBase64
    ? { ...song, dataBase64: undefined, data: base64ToUint8(song.dataBase64) }
    : song);
  const restoredKaraokeFiles = karaokeFiles.map(file => file.dataBase64
    ? { ...file, dataBase64: undefined, data: base64ToUint8(file.dataBase64) }
    : file);
  const safeSettings = Object.fromEntries(
    SAFE_SETTING_KEYS.filter(key => typeof settings[key] === 'string').map(key => [key, settings[key]])
  ) as Record<string, string>;
  return { songs: restoredSongs, playlists, customChords, karaokes, karaokePlaylists, karaokeFiles: restoredKaraokeFiles, settings: safeSettings };
};

const replaceLibrary = async (backup: ParsedBackup) => {
  await db.transaction('rw', [db.songs, db.playlists, db.customChords, db.karaokes, db.karaokePlaylists, db.karaokeFiles, db.syncOperations], async () => {
    await Promise.all([
      db.songs.clear(), db.playlists.clear(), db.customChords.clear(), db.karaokes.clear(),
      db.karaokePlaylists.clear(), db.karaokeFiles.clear(), db.syncOperations.clear()
    ]);
    if (backup.songs.length) await db.songs.bulkAdd(backup.songs);
    if (backup.playlists.length) await db.playlists.bulkAdd(backup.playlists);
    if (backup.customChords.length) await db.customChords.bulkAdd(backup.customChords);
    if (backup.karaokes.length) await db.karaokes.bulkAdd(backup.karaokes);
    if (backup.karaokePlaylists.length) await db.karaokePlaylists.bulkAdd(backup.karaokePlaylists);
    if (backup.karaokeFiles.length) await db.karaokeFiles.bulkAdd(backup.karaokeFiles);
  });
  localStorage.removeItem(DELETION_BACKUP_KEY);
};

const mergeLibrary = async (backup: ParsedBackup) => {
  await db.transaction('rw', [db.songs, db.playlists, db.customChords, db.karaokes, db.karaokePlaylists, db.karaokeFiles], async () => {
    const songIds = new Map<number, number>();
    const existingSongs = await db.songs.toArray();
    const songsByCloudId = new Map(existingSongs.filter(song => song.cloudId).map(song => [song.cloudId, song.id!]));
    for (const song of backup.songs) {
      const newId = song.cloudId && songsByCloudId.get(song.cloudId) || await db.songs.add(withoutLocalId(song)) as number;
      if (song.id) songIds.set(song.id, newId);
    }
    for (const playlist of backup.playlists) {
      const existing = playlist.cloudId ? await db.playlists.where('cloudId').equals(playlist.cloudId).first() : undefined;
      if (!existing) await db.playlists.add({ ...withoutLocalId(playlist), songIds: playlist.songIds.map(id => songIds.get(id)).filter((id): id is number => typeof id === 'number') });
    }
    const existingChords = await db.customChords.toArray();
    const chordCloudIds = new Set(existingChords.map(chord => chord.cloudId).filter(Boolean));
    for (const chord of backup.customChords) {
      if (!chord.cloudId || !chordCloudIds.has(chord.cloudId)) await db.customChords.add(withoutLocalId(chord));
    }

    const karaokeIds = new Map<number, number>();
    const existingKaraokes = await db.karaokes.toArray();
    const karaokesByCloudId = new Map(existingKaraokes.filter(karaoke => karaoke.cloudId).map(karaoke => [karaoke.cloudId, karaoke.id!]));
    for (const karaoke of backup.karaokes) {
      const newId = karaoke.cloudId && karaokesByCloudId.get(karaoke.cloudId) || await db.karaokes.add(withoutLocalId(karaoke)) as number;
      if (karaoke.id) karaokeIds.set(karaoke.id, newId);
    }
    for (const playlist of backup.karaokePlaylists) {
      const existing = playlist.cloudId ? await db.karaokePlaylists.where('cloudId').equals(playlist.cloudId).first() : undefined;
      if (!existing) await db.karaokePlaylists.add({ ...withoutLocalId(playlist), karaokeIds: playlist.karaokeIds.map(id => karaokeIds.get(id)).filter((id): id is number => typeof id === 'number') });
    }
    for (const file of backup.karaokeFiles) {
      const karaokeId = karaokeIds.get(file.karaokeId);
      if (karaokeId) await db.karaokeFiles.put({ ...file, karaokeId });
    }
  });
};

export const restoreLibraryBackup = async (backup: ParsedBackup, mode: RestoreMode) => {
  const syncAwareWindow = window as typeof window & { __isSyncing?: boolean };
  syncAwareWindow.__isSyncing = true;
  try {
    if (mode === 'replace') await replaceLibrary(backup);
    else await mergeLibrary(backup);
  } finally {
    syncAwareWindow.__isSyncing = false;
  }
  localStorage.removeItem(SYNC_CURSOR_KEY);
  Object.entries(backup.settings).forEach(([key, value]) => localStorage.setItem(key, value));
};
