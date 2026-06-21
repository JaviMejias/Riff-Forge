import Dexie, { type EntityTable } from 'dexie';
import type { ChordDef } from './chords';

export interface Karaoke {
  id?: number;
  cloudId?: string;
  updatedAt?: number;
  name: string;
  artist?: string;
  youtubeUrl?: string;
  cloudUrl?: string; // For streaming the downloaded MP3 from backend
  hasLocalAudio?: boolean; // Replaces localFile blob for lightweight metadata
  pitchShift?: number; // In semitones
  textContent?: string;
  isPublic?: boolean;
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
  name: string;
  karaokeIds: number[]; // LOCAL ids
  isPublic?: boolean;
  createdAt: number;
}

export interface Song {
  id?: number;
  cloudId?: string;
  updatedAt?: number;
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
  dateAdded: number;
}

export interface Playlist {
  id?: number;
  cloudId?: string;
  updatedAt?: number;
  name: string;
  songIds: number[]; // LOCAL ids
  isPublic?: boolean;
  createdAt: number;
}

export class MiRiffPlayerDB extends Dexie {
  songs!: EntityTable<Song, 'id'>;
  playlists!: EntityTable<Playlist, 'id'>;
  customChords!: EntityTable<ChordDef, 'id'>;
  karaokes!: EntityTable<Karaoke, 'id'>;
  karaokePlaylists!: EntityTable<KaraokePlaylist, 'id'>;
  karaokeFiles!: EntityTable<KaraokeFile, 'karaokeId'>;

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
  }
}

export const db = new MiRiffPlayerDB();

// --- Auto-Sync Hooks ---
const tables = ['songs', 'playlists', 'customChords', 'karaokes', 'karaokePlaylists', 'karaokeFiles'];

tables.forEach(tableName => {
  db.table(tableName).hook('creating', function(_primKey, obj) {
    if ((window as any).__isSyncing) return;
    if (tableName !== 'karaokeFiles') {
      obj.updatedAt = Date.now();
    }
    // Defer the event so it runs outside the transaction
    setTimeout(() => window.dispatchEvent(new Event('trigger-auto-sync')), 10);
  });

  db.table(tableName).hook('updating', function() {
    if ((window as any).__isSyncing) return;
    setTimeout(() => window.dispatchEvent(new Event('trigger-auto-sync')), 10);
    if (tableName !== 'karaokeFiles') {
      return { updatedAt: Date.now() };
    }
  });

  db.table(tableName).hook('deleting', function(_primKey, obj) {
    if ((window as any).__isSyncing) return;
    if (obj && obj.cloudId) {
      try {
        const deletedStr = localStorage.getItem('deleted_cloud_ids') || '[]';
        const deleted = JSON.parse(deletedStr);
        deleted.push({ table: tableName, cloudId: obj.cloudId });
        localStorage.setItem('deleted_cloud_ids', JSON.stringify(deleted));
      } catch (e) {}
    }
    setTimeout(() => window.dispatchEvent(new Event('trigger-auto-sync')), 10);
  });
});
