/* eslint-disable @typescript-eslint/no-explicit-any */
import Dexie, { type EntityTable } from 'dexie';
import type { ChordDef } from './chords';
import { v4 as uuidv4 } from 'uuid';

export interface Karaoke {
  id?: number;
  cloudId?: string;
  updatedAt?: number;
  createdAt?: number;
  deletedAt?: number | null;
  version?: number;
  name: string;
  artist?: string;
  youtubeUrl?: string;
  cloudUrl?: string; // For streaming the downloaded MP3 from backend
  hasLocalAudio?: boolean; // Replaces localFile blob for lightweight metadata
  pitchShift?: number; // In semitones
  textContent?: string;
  isPublic?: boolean;
  localFileDirty?: boolean; // True if the user modified the local binary file
  fileVersion?: number;
  fileHash?: string;
  fileSize?: number;
  fileMimeType?: string;
  syncDirty?: boolean;
  dateAdded: number;
}

export interface KaraokeFile {
  karaokeId: number;
  cloudUrl?: string; // URL for download
  data: Uint8Array;
}

export interface KaraokePlaylist {
  id?: number;
  cloudId?: string;
  updatedAt?: number;
  deletedAt?: number | null;
  version?: number;
  syncDirty?: boolean;
  name: string;
  karaokeIds: number[]; // LOCAL ids
  isPublic?: boolean;
  createdAt: number;
}

export interface Song {
  id?: number;
  cloudId?: string;
  updatedAt?: number;
  createdAt?: number;
  deletedAt?: number | null;
  version?: number;
  name: string;
  artist?: string;
  album?: string;
  type?: 'gp' | 'text';
  data?: Uint8Array | null;
  cloudUrl?: string; // For data backup
  textContent?: string | null;
  originalKey?: string;
  tuning?: string;
  strummingPattern?: string;
  capo?: string;
  isPublic?: boolean;
  isTemporary?: boolean; // Used for catalog streaming without polluting the library
  catalogSourceId?: string; // Original catalog ID for re-downloading permanently
  localFileDirty?: boolean; // True if the user modified the local binary file
  fileVersion?: number;
  fileHash?: string;
  fileSize?: number;
  fileMimeType?: string;
  syncDirty?: boolean;
  dateAdded: number;
}

export interface Playlist {
  id?: number;
  cloudId?: string;
  updatedAt?: number;
  deletedAt?: number | null;
  version?: number;
  syncDirty?: boolean;
  name: string;
  songIds: number[]; // LOCAL ids
  isPublic?: boolean;
  createdAt: number;
}

export type SyncEntityType = 'song' | 'karaoke' | 'custom_chord' | 'playlist' | 'karaoke_playlist';

export interface PendingSyncOperation {
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  action: 'upsert' | 'delete';
  baseVersion: number;
  clientUpdatedAt: number;
  data?: Record<string, unknown>;
  attempts?: number;
  lastError?: string;
}

export class MiRiffPlayerDB extends Dexie {
  songs!: EntityTable<Song, 'id'>;
  playlists!: EntityTable<Playlist, 'id'>;
  customChords!: EntityTable<ChordDef, 'id'>;
  karaokes!: EntityTable<Karaoke, 'id'>;
  karaokePlaylists!: EntityTable<KaraokePlaylist, 'id'>;
  karaokeFiles!: EntityTable<KaraokeFile, 'karaokeId'>;
  syncOperations!: EntityTable<PendingSyncOperation, 'operationId'>;

  constructor() {
    super('MiRiffPlayerDB');
    
    // Version 1
    this.version(1).stores({
      songs: '++id, name, dateAdded'
    });

    // Version 2: Added 'artist' to songs, added 'playlists' table
    this.version(2).stores({
      songs: '++id, name, artist, dateAdded',
      playlists: '++id, name, createdAt'
    }).upgrade(tx => {
      // Add empty artist to all existing songs so they match the new schema
      return tx.table('songs').toCollection().modify(song => {
        if (!song.artist) song.artist = 'Desconocido';
      });
    });

    // Version 3: Added customChords table
    this.version(3).stores({
      customChords: '++id, name, root'
    });

    // Version 4: Added karaoke tables
    this.version(4).stores({
      karaokes: '++id, name, artist, dateAdded',
      karaokePlaylists: '++id, name, createdAt'
    });

    // Version 5: Separate huge localFile blobs into karaokeFiles to fix UI lag
    this.version(5).stores({
      karaokes: '++id, name, artist, dateAdded',
      karaokeFiles: 'karaokeId'
    });

    // Version 6: Fix V5 migration (modify callback async issue)
    this.version(6).stores({
      karaokes: '++id, name, artist, dateAdded',
      karaokeFiles: 'karaokeId'
    }).upgrade(async tx => {
      const allKaraokes = await tx.table('karaokes').toArray();
      for (const karaoke of allKaraokes) {
        if (karaoke.localFile) {
          await tx.table('karaokeFiles').put({ 
            karaokeId: karaoke.id, 
            data: karaoke.localFile 
          });
          karaoke.hasLocalAudio = true;
          delete karaoke.localFile;
          await tx.table('karaokes').put(karaoke); // Complete overwrite to drop localFile
        }
      }
    });

    // Version 7: Add cloudId indexes for Firebase Sync
    this.version(7).stores({
      songs: '++id, name, artist, dateAdded, cloudId',
      playlists: '++id, name, createdAt, cloudId',
      customChords: '++id, name, root, cloudId',
      karaokes: '++id, name, artist, dateAdded, cloudId',
      karaokePlaylists: '++id, name, createdAt, cloudId',
      karaokeFiles: 'karaokeId'
    });

    // Version 8: Add isPublic indexes for Community sharing
    this.version(8).stores({
      songs: '++id, name, artist, dateAdded, cloudId, isPublic',
      playlists: '++id, name, createdAt, cloudId, isPublic',
      customChords: '++id, name, root, cloudId, isPublic',
      karaokes: '++id, name, artist, dateAdded, cloudId, isPublic',
      karaokePlaylists: '++id, name, createdAt, cloudId, isPublic',
      karaokeFiles: 'karaokeId'
    });

    // Version 9: Add isTemporary index for filtering temporary catalog songs
    this.version(9).stores({
      songs: '++id, name, artist, dateAdded, cloudId, isPublic, isTemporary',
    });

    this.version(10).stores({
      songs: '++id, name, artist, dateAdded, cloudId, isPublic, isTemporary',
      playlists: '++id, name, createdAt, cloudId, isPublic',
      customChords: '++id, name, root, cloudId, isPublic',
      karaokes: '++id, name, artist, dateAdded, cloudId, isPublic',
      karaokePlaylists: '++id, name, createdAt, cloudId, isPublic',
      karaokeFiles: 'karaokeId',
      syncOperations: 'operationId, entityId, entityType, clientUpdatedAt'
    });
  }
}

export const db = new MiRiffPlayerDB();

// --- Auto-Sync Hooks ---
const tables = ['songs', 'playlists', 'customChords', 'karaokes', 'karaokePlaylists', 'karaokeFiles'];
const DELETION_BACKUP_KEY = 'sync_v2_pending_deletions';

const entityTypes: Record<string, SyncEntityType> = {
  songs: 'song',
  playlists: 'playlist',
  customChords: 'custom_chord',
  karaokes: 'karaoke',
  karaokePlaylists: 'karaoke_playlist'
};

const enqueueUpsert = async (tableName: string, cloudId: string) => {
  const entityType = entityTypes[tableName];
  if (!entityType) return;

  const record = await db.table(tableName).where('cloudId').equals(cloudId).first();
  if (!record || (tableName === 'songs' && record.isTemporary)) return;

  const existingOperations = await db.syncOperations.where('entityId').equals(cloudId).toArray();
  const baseVersion = existingOperations.length > 0
    ? Math.min(...existingOperations.map(operation => operation.baseVersion))
    : (record.version || 0);
  await db.syncOperations.bulkDelete(existingOperations.map(operation => operation.operationId));

  let data: Record<string, unknown>;
  if (tableName === 'playlists') {
    const songs = await db.songs.bulkGet(record.songIds || []);
    data = {
      name: record.name,
      songCloudIds: songs.map(song => song?.cloudId).filter(Boolean),
      isPublic: record.isPublic
    };
  } else if (tableName === 'karaokePlaylists') {
    const karaokes = await db.karaokes.bulkGet(record.karaokeIds || []);
    data = {
      name: record.name,
      karaokeCloudIds: karaokes.map(karaoke => karaoke?.cloudId).filter(Boolean),
      isPublic: record.isPublic
    };
  } else {
    const allowedFields: Record<string, string[]> = {
      songs: ['name', 'artist', 'album', 'type', 'textContent', 'originalKey', 'tuning', 'strummingPattern', 'capo', 'isPublic', 'dateAdded'],
      karaokes: ['name', 'artist', 'youtubeUrl', 'hasLocalAudio', 'pitchShift', 'textContent', 'isPublic', 'dateAdded'],
      customChords: ['name', 'root', 'frets', 'fingers', 'baseFret', 'barres', 'isPublic']
    };
    data = {};
    allowedFields[tableName].forEach(field => {
      if (record[field] !== undefined) data[field] = record[field];
    });
  }

  await db.syncOperations.add({
    operationId: uuidv4(),
    entityType,
    entityId: cloudId,
    action: 'upsert',
    baseVersion,
    clientUpdatedAt: Date.now(),
    data
  });
  window.dispatchEvent(new Event('trigger-auto-sync'));
};

const enqueueDelete = async (tableName: string, record: any) => {
  const entityType = entityTypes[tableName];
  if (!entityType || !record?.cloudId || (tableName === 'songs' && record.isTemporary)) return;

  const existingOperations = await db.syncOperations.where('entityId').equals(record.cloudId).toArray();
  const baseVersion = existingOperations.length > 0
    ? Math.min(...existingOperations.map(operation => operation.baseVersion))
    : (record.version || 0);
  await db.syncOperations.bulkDelete(existingOperations.map(operation => operation.operationId));
  if (baseVersion === 0) {
    const backups = JSON.parse(localStorage.getItem(DELETION_BACKUP_KEY) || '[]');
    localStorage.setItem(DELETION_BACKUP_KEY, JSON.stringify(backups.filter((item: any) => item.record?.cloudId !== record.cloudId)));
    return;
  }
  await db.syncOperations.add({
    operationId: uuidv4(),
    entityType,
    entityId: record.cloudId,
    action: 'delete',
    baseVersion,
    clientUpdatedAt: Date.now()
  });
  const backups = JSON.parse(localStorage.getItem(DELETION_BACKUP_KEY) || '[]');
  localStorage.setItem(DELETION_BACKUP_KEY, JSON.stringify(backups.filter((item: any) => item.record?.cloudId !== record.cloudId)));
  window.dispatchEvent(new Event('trigger-auto-sync'));
};

tables.forEach(tableName => {
  db.table(tableName).hook('creating', function(_primKey, obj) {
    if ((window as any).__isSyncing) return;
    if (tableName !== 'karaokeFiles') {
      obj.cloudId ||= uuidv4();
      obj.version ||= 0;
      obj.updatedAt = Date.now();
      obj.createdAt ||= obj.updatedAt;
      obj.syncDirty = true;
      setTimeout(() => enqueueUpsert(tableName, obj.cloudId), 0);
    }
  });

  db.table(tableName).hook('updating', function(_mods, _primKey, obj) {
    if ((window as any).__isSyncing) return;
    if (tableName !== 'karaokeFiles') {
      if (obj.cloudId) setTimeout(() => enqueueUpsert(tableName, obj.cloudId), 0);
      return { updatedAt: Date.now(), syncDirty: true };
    }
  });

  db.table(tableName).hook('deleting', function(_primKey, obj) {
    if ((window as any).__isSyncing) return;
    if (tableName !== 'karaokeFiles') {
      const backups = JSON.parse(localStorage.getItem(DELETION_BACKUP_KEY) || '[]');
      backups.push({
        tableName,
        record: { cloudId: obj?.cloudId, version: obj?.version, isTemporary: obj?.isTemporary }
      });
      localStorage.setItem(DELETION_BACKUP_KEY, JSON.stringify(backups));
      setTimeout(() => enqueueDelete(tableName, obj), 0);
    }
  });
});

export const recoverPendingSyncOperations = async () => {
  const backups = JSON.parse(localStorage.getItem(DELETION_BACKUP_KEY) || '[]');
  for (const backup of backups) {
    const cloudId = backup?.record?.cloudId;
    if (!cloudId) continue;
    const queued = await db.syncOperations.where('entityId').equals(cloudId).count();
    if (queued === 0) await enqueueDelete(backup.tableName, backup.record);
  }
  localStorage.removeItem(DELETION_BACKUP_KEY);

  for (const tableName of Object.keys(entityTypes)) {
    const dirtyRecords = await db.table(tableName).filter(record => !!record.syncDirty).toArray();
    for (const record of dirtyRecords) {
      const queued = await db.syncOperations.where('entityId').equals(record.cloudId).count();
      if (queued === 0) await enqueueUpsert(tableName, record.cloudId);
    }
  }
};
