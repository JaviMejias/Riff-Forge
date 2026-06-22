import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';

import { API_BASE_URL } from '../config'; // FE-1: use central config

const API_URL = `${API_BASE_URL}/api`;

let syncTimeout: any = null;
let syncInProgress: Promise<void> | null = null; // FE-6: lock to prevent concurrent syncs

export const SyncService = {
  scheduleAutoSync() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      SyncService.performAutoSync();
    }, 3000);
  },

  performAutoSync(onProgress?: (msg: string) => void) {
    if (syncInProgress) return syncInProgress;
    syncInProgress = this._doSync(onProgress).finally(() => {
      syncInProgress = null;
    });
    return syncInProgress;
  },

  async _doSync(onProgress?: (msg: string) => void) {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const headers = { 'Authorization': `Bearer ${token}` };
    const lastSyncAt = parseInt(localStorage.getItem('lastSyncAt') || '0');
    const newSyncTime = Date.now();

    (window as any).__isSyncing = true;

    try {
      // 1. Process Deletions First
      const deletedStr = localStorage.getItem('deleted_cloud_ids');
      if (deletedStr) {
        const deleted = JSON.parse(deletedStr);
        for (const item of deleted) {
          const endpoint = item.table === 'songs' ? 'songs' :
                           item.table === 'karaokes' ? 'karaokes' : null;
          // Playlists and chords are handled by bulk overwrite, so no need to delete individually
          if (endpoint) {
            await fetch(`${API_URL}/${endpoint}/${item.cloudId}`, { method: 'DELETE', headers });
          }
        }
        localStorage.removeItem('deleted_cloud_ids');
      }

      // 2. Sync Songs incrementally
      onProgress?.('Sincronizando canciones...');
      const songs = await db.songs.filter(s => (s.updatedAt || 0) > lastSyncAt).toArray();
      for (const song of songs) {
        if (!song.cloudId) {
          song.cloudId = uuidv4();
          await db.songs.update(song.id!, { cloudId: song.cloudId });
        }
        
        const createSongFormData = () => {
          const fd = new FormData();
          Object.entries(song).forEach(([key, value]) => {
            if (key === 'data' && value) {
              if (!song.cloudUrl || song.localFileDirty) {
                fd.append('file', new Blob([value as any]), `${song.cloudId}.gp`);
              }
            } else if (value !== undefined && value !== null && key !== 'id') {
              fd.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
            }
          });
          fd.append('id', song.cloudId!);
          return fd;
        };

        const method = 'PUT'; 
        const res = await fetch(`${API_URL}/songs/${song.cloudId}`, { method, headers, body: createSongFormData() });
        if (!res.ok && res.status === 404) {
          await fetch(`${API_URL}/songs`, { method: 'POST', headers, body: createSongFormData() });
        } else if (!res.ok) {
          throw new Error(`Song update failed: ${res.status}`);
        }

        if (song.localFileDirty) {
          await db.songs.update(song.id!, { localFileDirty: false });
        }
      }

      // 3. Sync Karaokes incrementally
      onProgress?.('Sincronizando karaokes...');
      const karaokes = await db.karaokes.filter(k => (k.updatedAt || 0) > lastSyncAt).toArray();
      for (const karaoke of karaokes) {
        if (!karaoke.cloudId) {
          karaoke.cloudId = uuidv4();
          await db.karaokes.update(karaoke.id!, { cloudId: karaoke.cloudId } as any);
        }

        const karaokeFile = await db.karaokeFiles.get(karaoke.id!);

        const createKaraokeFormData = () => {
          const fd = new FormData();
          Object.entries(karaoke).forEach(([key, value]) => {
            if (value !== undefined && value !== null && key !== 'id') {
              fd.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
            }
          });
          fd.append('id', karaoke.cloudId!);

          if (karaokeFile && karaokeFile.data) {
            if (!karaoke.cloudUrl || karaoke.localFileDirty) {
              fd.append('file', new Blob([karaokeFile.data as any]), `${karaoke.cloudId}.mp3`);
            }
          }
          return fd;
        };

        const res = await fetch(`${API_URL}/karaokes/${karaoke.cloudId}`, { method: 'PUT', headers, body: createKaraokeFormData() });
        if (!res.ok && res.status === 404) {
          await fetch(`${API_URL}/karaokes`, { method: 'POST', headers, body: createKaraokeFormData() });
        } else if (!res.ok) {
          throw new Error(`Karaoke update failed`);
        }

        if (karaoke.localFileDirty) {
          await db.karaokes.update(karaoke.id!, { localFileDirty: false } as any);
        }
      }

      // 4. Bulk Sync Small Tables if modified
      const playlistsChanged = await db.playlists.filter(p => (p.updatedAt || 0) > lastSyncAt).count();
      if (playlistsChanged > 0) {
        onProgress?.('Sincronizando listas...');
        const playlists = await db.playlists.toArray();
        const songIdToCloudId = new Map((await db.songs.toArray()).map(s => [s.id, s.cloudId]));
        const playlistsPayload = playlists.map(p => ({
          ...p,
          id: p.cloudId || uuidv4(),
          songCloudIds: p.songIds.map(id => songIdToCloudId.get(id)).filter(Boolean)
        }));
        const res = await fetch(`${API_URL}/playlists/sync`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(playlistsPayload) });
        if (!res.ok) throw new Error(`Playlist sync failed: ${res.status}`);
      }

      const kPlaylistsChanged = await db.karaokePlaylists.filter(p => (p.updatedAt || 0) > lastSyncAt).count();
      if (kPlaylistsChanged > 0) {
        const karaokePlaylists = await db.karaokePlaylists.toArray();
        const karaokeIdToCloudId = new Map((await db.karaokes.toArray()).map(k => [k.id, k.cloudId]));
        const kPlaylistsPayload = karaokePlaylists.map(p => ({
          ...p,
          id: p.cloudId || uuidv4(),
          karaokeCloudIds: p.karaokeIds.map(id => karaokeIdToCloudId.get(id)).filter(Boolean)
        }));
        const res = await fetch(`${API_URL}/karaoke-playlists/sync`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(kPlaylistsPayload) });
        if (!res.ok) throw new Error(`Karaoke Playlist sync failed: ${res.status}`);
      }

      const chordsChanged = await db.customChords.filter(c => (c.updatedAt || 0) > lastSyncAt).count();
      if (chordsChanged > 0) {
        onProgress?.('Sincronizando acordes...');
        const chords = await db.customChords.toArray();
        const chordsPayload = chords.map(c => ({
          ...c,
          id: c.cloudId || uuidv4()
        }));
        const res = await fetch(`${API_URL}/chords/sync`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(chordsPayload) });
        if (!res.ok) throw new Error(`Chords sync failed: ${res.status}`);
      }

      // 5. Sync Settings
      onProgress?.('Subiendo ajustes de usuario...');
      const SYNC_KEYS = ['ui-storage']; // L-5 fix: allowlist instead of denylist
      const settings: Record<string, string> = {};
      SYNC_KEYS.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) settings[key] = val;
      });
      const resSettings = await fetch(`${API_URL}/auth/settings`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uiStorage: settings })
      });
      if (!resSettings.ok) throw new Error(`Settings sync failed: ${resSettings.status}`);

      localStorage.setItem('lastSyncAt', newSyncTime.toString());
      onProgress?.('¡Respaldo en el servidor completado!');
    } catch (error) {
      console.error("Auto-sync background failed", error);
    } finally {
      (window as any).__isSyncing = false;
    }
  },

  async syncAllToCloud(onProgress?: (msg: string) => void) {
    // We can just rely on the new performAutoSync for this as well, 
    // but to force everything, we reset lastSyncAt to 0.
    localStorage.setItem('lastSyncAt', '0');
    await this.performAutoSync(onProgress);
  },


  async downloadAllFromCloud(onProgress?: (msg: string) => void) {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error("No hay usuario autenticado");

    const headers = { 'Authorization': `Bearer ${token}` };

    onProgress?.('Descargando datos del servidor...');

    // Fetch latest user data for settings
    try {
      const authRes = await fetch(`${API_URL}/auth/verify`, { headers });
      if (authRes.ok) {
        const authData = await authRes.json();
        useAuthStore.setState({ user: authData.user });
      }
    } catch (e) {}

    // 1. Download Songs
    onProgress?.('Descargando canciones...');
    let res = await fetch(`${API_URL}/songs`, { headers });
    if (res.ok) {
      const serverSongs = await res.json();
      for (const item of serverSongs) {
        const { id: cloudId, ...data } = item; // M-4: destructuring instead of delete
        const existing = await db.songs.where('cloudId').equals(cloudId).first();
        
        let binaryData = null;
        if (data.cloudUrl && (!existing || !existing.data)) {
          try {
            const resp = await fetch(`${API_BASE_URL}${data.cloudUrl}`); // FE-1: use config
            if (resp.ok) {
              const arrayBuffer = await resp.arrayBuffer();
              binaryData = new Uint8Array(arrayBuffer);
            }
          } catch (e) {}
        }

        if (existing) {
          if (data.updatedAt > (existing.updatedAt || 0)) {
            // FE-7 fix updatedAt for db hooks bypassing
            await db.songs.update(existing.id!, { ...data, updatedAt: data.updatedAt || Date.now(), data: binaryData || existing.data });
          }
        } else {
          await db.songs.add({ ...data, cloudId, updatedAt: data.updatedAt || Date.now(), data: binaryData } as any);
        }
      }
    }

    // 2. Download Karaokes
    onProgress?.('Descargando karaokes...');
    res = await fetch(`${API_URL}/karaokes`, { headers });
    if (res.ok) {
      const serverKaraokes = await res.json();
      for (const item of serverKaraokes) {
        const { id: cloudId, ...data } = item;
        const existing = await db.karaokes.where('cloudId').equals(cloudId).first();
        let localKaraokeId = existing?.id;

        if (existing) {
          if (data.updatedAt > (existing.updatedAt || 0)) {
            await db.karaokes.update(existing.id!, { ...data, updatedAt: data.updatedAt || Date.now() });
          }
        } else {
          localKaraokeId = await db.karaokes.add({ ...data, cloudId, updatedAt: data.updatedAt || Date.now() } as any) as number;
        }

        if (data.cloudUrl && localKaraokeId) {
          const existingFile = await db.karaokeFiles.get(localKaraokeId);
          if (!existingFile || !existingFile.data) {
            try {
              const resp = await fetch(`${API_BASE_URL}${data.cloudUrl}`);
              if (resp.ok) {
                const arrayBuffer = await resp.arrayBuffer();
                const binaryData = new Uint8Array(arrayBuffer);
                await db.karaokeFiles.put({ karaokeId: localKaraokeId, cloudUrl: data.cloudUrl, data: binaryData });
              }
            } catch (e) {}
          }
        }
      }
    }

    // 3. Download Playlists & Chords
    onProgress?.('Descargando listas de reproducción...');
    res = await fetch(`${API_URL}/playlists`, { headers });
    if (res.ok) {
      const serverPlaylists = await res.json();
      const songs = await db.songs.toArray();
      const cloudIdToSongId = new Map(songs.map(s => [s.cloudId, s.id]));

      for (const item of serverPlaylists) {
        const { id: cloudId, ...data } = item;
        const songIds = (data.songCloudIds || []).map((id: string) => cloudIdToSongId.get(id)).filter(Boolean);
        const existing = await db.playlists.where('cloudId').equals(cloudId).first();
        if (existing) {
           await db.playlists.update(existing.id!, { ...data, cloudId, songIds });
        } else {
           await db.playlists.add({ ...data, cloudId, songIds } as any);
        }
      }
    }

    res = await fetch(`${API_URL}/karaoke-playlists`, { headers });
    if (res.ok) {
      const serverKaraokePlaylists = await res.json();
      const karaokes = await db.karaokes.toArray();
      const cloudIdToKaraokeId = new Map(karaokes.map(k => [k.cloudId, k.id]));

      for (const item of serverKaraokePlaylists) {
        const { id: cloudId, ...data } = item;
        const karaokeIds = (data.karaokeCloudIds || []).map((id: string) => cloudIdToKaraokeId.get(id)).filter(Boolean);
        const existing = await db.karaokePlaylists.where('cloudId').equals(cloudId).first();
        if (existing) {
           await db.karaokePlaylists.update(existing.id!, { ...data, cloudId, karaokeIds });
        } else {
           await db.karaokePlaylists.add({ ...data, cloudId, karaokeIds } as any);
        }
      }
    }

    res = await fetch(`${API_URL}/chords`, { headers });
    if (res.ok) {
      const serverChords = await res.json();
      for (const item of serverChords) {
        const { id: cloudId, ...data } = item;
        const existing = await db.customChords.where('cloudId').equals(cloudId).first();
        // Parse JSON strings from db
        const frets = typeof data.frets === 'string' ? JSON.parse(data.frets) : data.frets;
        const fingers = typeof data.fingers === 'string' ? JSON.parse(data.fingers) : data.fingers;
        const barres = typeof data.barres === 'string' ? JSON.parse(data.barres) : data.barres;

        const parsedData = { ...data, frets, fingers, barres };
        
        if (existing) {
           await db.customChords.update(existing.id!, { ...parsedData, cloudId });
        } else {
           await db.customChords.add({ ...parsedData, cloudId } as any);
        }
      }
    }

    onProgress?.('Aplicando ajustes...');
    const userState = useAuthStore.getState().user;
    if (userState && (userState as any).uiStorage) {
      try {
        const settings = typeof (userState as any).uiStorage === 'string' ? JSON.parse((userState as any).uiStorage) : (userState as any).uiStorage;
        Object.entries(settings).forEach(([key, value]) => {
          localStorage.setItem(key, String(value));
          
          // Explicitly set theme if found in ui-storage
          if (key === 'ui-storage') {
            try {
              const uiState = JSON.parse(String(value));
              if (uiState?.state?.theme) {
                useUiStore.getState().setTheme(uiState.state.theme);
              }
            } catch (e) {}
          }
        });
      } catch (e) {}
    }

    onProgress?.('¡Sincronización completada con éxito!');
  }
};

// Event listener for auto sync
if (typeof window !== 'undefined') {
  window.addEventListener('trigger-auto-sync', () => SyncService.scheduleAutoSync());
}
