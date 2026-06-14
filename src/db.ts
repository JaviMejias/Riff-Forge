import Dexie, { type EntityTable } from 'dexie';
import type { ChordDef } from './chords';

export interface Karaoke {
  id?: number;
  name: string;
  artist?: string;
  youtubeUrl?: string;
  hasLocalAudio?: boolean; // Replaces localFile blob for lightweight metadata
  pitchShift?: number; // In semitones
  textContent?: string;
  dateAdded: number;
}

export interface KaraokeFile {
  karaokeId: number;
  data: Uint8Array;
}

export interface KaraokePlaylist {
  id?: number;
  name: string;
  karaokeIds: number[];
  createdAt: number;
}

export interface Song {
  id?: number;
  name: string;
  artist?: string;
  album?: string;
  type?: 'gp' | 'text';
  data?: Uint8Array | null;
  textContent?: string | null;
  originalKey?: string;
  tuning?: string;
  strummingPattern?: string;
  capo?: string;
  dateAdded: number;
}

export interface Playlist {
  id?: number;
  name: string;
  songIds: number[];
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
  }
}

export const db = new MiRiffPlayerDB();
