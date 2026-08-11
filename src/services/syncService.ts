/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from 'uuid';
import { db, recoverPendingSyncOperations, type SyncEntityType } from '../db';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { API_BASE_URL } from '../config';

const API_URL = `${API_BASE_URL}/api`;
const DEVICE_ID_KEY = 'sync_v2_device_id';
const CURSOR_KEY = 'sync_v2_cursor';
const SYNC_RETRY_AT_KEY = 'sync_retry_at';

interface RemoteFile {
  url: string;
  version: number;
  hash?: string;
  size?: number;
  mimeType?: string;
}

interface SyncChange {
  entityType: SyncEntityType;
  entityId: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  data: Record<string, any>;
}

interface RejectedOperation {
  operationId: string;
  reason: string;
  serverEntity?: SyncChange;
}

interface SyncResponse {
  acknowledgedOperationIds: string[];
  rejectedOperations: RejectedOperation[];
  changes: SyncChange[];
  nextCursor: string | null;
  hasMore: boolean;
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let syncInProgress: Promise<void> | null = null;

class RateLimitError extends Error {}

const ensureSyncResponse = (response: Response, message: string) => {
  if (response.ok) return;
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    localStorage.setItem(SYNC_RETRY_AT_KEY, String(Date.now() + retryAfter * 1000));
    throw new RateLimitError(`${message}: 429`);
  }
  throw new Error(`${message}: ${response.status}`);
};

const emitSyncStatus = (status: 'idle' | 'syncing' | 'success' | 'attention' | 'error') => {
  window.dispatchEvent(new CustomEvent('sync-status-change', { detail: { status } }));
};

const getDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

const fullFileUrl = (url: string) => /^https?:\/\//.test(url) ? url : `${API_BASE_URL}${url}`;

const downloadBinary = async (file: RemoteFile) => {
  const response = await fetch(fullFileUrl(file.url), { cache: 'no-store' });
  if (!response.ok) throw new Error(`File download failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

const runRemoteWrite = async <T>(write: () => Promise<T>) => {
  (window as any).__isSyncing = true;
  try {
    return await write();
  } finally {
    (window as any).__isSyncing = false;
  }
};

const deleteByCloudId = async (entityType: SyncEntityType, cloudId: string) => {
  const table = entityType === 'song' ? db.songs
    : entityType === 'karaoke' ? db.karaokes
    : entityType === 'custom_chord' ? db.customChords
    : entityType === 'playlist' ? db.playlists
    : db.karaokePlaylists;
  const existing = await table.where('cloudId').equals(cloudId).first() as any;
  if (!existing) return;

  if (entityType === 'karaoke') await db.karaokeFiles.delete(existing.id);
  await table.delete(existing.id);

  if (entityType === 'song') {
    const playlists = await db.playlists.toArray();
    await Promise.all(playlists.filter(p => p.songIds.includes(existing.id)).map(p =>
      db.playlists.update(p.id!, { songIds: p.songIds.filter(id => id !== existing.id) })
    ));
  } else if (entityType === 'karaoke') {
    const playlists = await db.karaokePlaylists.toArray();
    await Promise.all(playlists.filter(p => p.karaokeIds.includes(existing.id)).map(p =>
      db.karaokePlaylists.update(p.id!, { karaokeIds: p.karaokeIds.filter(id => id !== existing.id) })
    ));
  }
};

const applySong = async (change: SyncChange) => {
  const existing = await db.songs.where('cloudId').equals(change.entityId).first();
  const file = change.data.file as RemoteFile | undefined;
  let binaryData = existing?.data;
  let fileApplied = !file || existing?.fileVersion === file.version;

  if (file && !fileApplied) {
    binaryData = await downloadBinary(file);
    fileApplied = true;
  }

  const data = { ...change.data };
  delete data.file;
  const values = {
    ...data,
    cloudId: change.entityId,
    version: change.version,
    createdAt: change.createdAt,
    updatedAt: change.updatedAt,
    deletedAt: change.deletedAt,
    cloudUrl: file?.url,
    fileVersion: fileApplied ? file?.version : existing?.fileVersion,
    fileHash: fileApplied ? file?.hash : existing?.fileHash,
    fileSize: fileApplied ? file?.size : existing?.fileSize,
    fileMimeType: fileApplied ? file?.mimeType : existing?.fileMimeType,
    data: binaryData,
    localFileDirty: existing?.localFileDirty || false,
    syncDirty: false
  };
  await runRemoteWrite(async () => {
    if (existing) await db.songs.update(existing.id!, values);
    else await db.songs.add(values as any);
  });
};

const applyKaraoke = async (change: SyncChange) => {
  const existing = await db.karaokes.where('cloudId').equals(change.entityId).first();
  const file = change.data.file as RemoteFile | undefined;
  const data = { ...change.data };
  delete data.file;
  const values = {
    ...data,
    cloudId: change.entityId,
    version: change.version,
    createdAt: change.createdAt,
    updatedAt: change.updatedAt,
    deletedAt: change.deletedAt,
    cloudUrl: file?.url,
    fileVersion: file?.version,
    fileHash: file?.hash,
    fileSize: file?.size,
    fileMimeType: file?.mimeType,
    localFileDirty: existing?.localFileDirty || false,
    syncDirty: false
  };
  const localFile = existing?.id ? await db.karaokeFiles.get(existing.id) : undefined;
  let binaryData: Uint8Array | undefined;
  if (file && (!localFile?.data || existing?.fileVersion !== file.version) && !existing?.localFileDirty) {
    binaryData = await downloadBinary(file);
  }
  await runRemoteWrite(async () => {
    const localId = existing?.id || await db.karaokes.add(values as any) as number;
    if (existing) await db.karaokes.update(localId, values);
    if (file && binaryData) await db.karaokeFiles.put({ karaokeId: localId, cloudUrl: file.url, data: binaryData });
  });
};

const applySimpleEntity = async (change: SyncChange) => {
  if (change.entityType === 'custom_chord') {
    const existing = await db.customChords.where('cloudId').equals(change.entityId).first();
    const values = { ...change.data, cloudId: change.entityId, version: change.version, createdAt: change.createdAt, updatedAt: change.updatedAt, syncDirty: false } as Record<string, any>;
    for (const field of ['frets', 'fingers', 'barres']) {
      if (typeof values[field] === 'string') values[field] = JSON.parse(values[field]);
    }
    if (existing) await db.customChords.update(existing.id!, values);
    else await db.customChords.add(values as any);
    return;
  }

  if (change.entityType === 'playlist') {
    const songs = await db.songs.toArray();
    const ids = new Map(songs.map(song => [song.cloudId, song.id]));
    const remoteCloudIds = (change.data.songCloudIds || []) as string[];
    const songIds = remoteCloudIds.map((id: string) => ids.get(id)).filter(Boolean) as number[];
    const existing = await db.playlists.where('cloudId').equals(change.entityId).first();
    const values = { ...change.data, songCloudIds: undefined, songIds, remoteCloudIds, cloudId: change.entityId, version: change.version, createdAt: change.createdAt, updatedAt: change.updatedAt, syncDirty: false };
    if (existing) await db.playlists.update(existing.id!, values);
    else await db.playlists.add(values as any);
    return;
  }

  const karaokes = await db.karaokes.toArray();
  const ids = new Map(karaokes.map(karaoke => [karaoke.cloudId, karaoke.id]));
  const remoteCloudIds = (change.data.karaokeCloudIds || []) as string[];
  const karaokeIds = remoteCloudIds.map((id: string) => ids.get(id)).filter(Boolean) as number[];
  const existing = await db.karaokePlaylists.where('cloudId').equals(change.entityId).first();
  const values = { ...change.data, karaokeCloudIds: undefined, karaokeIds, remoteCloudIds, cloudId: change.entityId, version: change.version, createdAt: change.createdAt, updatedAt: change.updatedAt, syncDirty: false };
  if (existing) await db.karaokePlaylists.update(existing.id!, values);
  else await db.karaokePlaylists.add(values as any);
};

const resolvePendingPlaylistReferences = async () => {
  const songs = await db.songs.toArray();
  const songIdsByCloudId = new Map(songs.map(song => [song.cloudId, song.id]));
  const playlists = await db.playlists.filter(playlist => Array.isArray(playlist.remoteCloudIds)).toArray();
  for (const playlist of playlists) {
    const resolvedIds = playlist.remoteCloudIds!.map(cloudId => songIdsByCloudId.get(cloudId));
    if (resolvedIds.every((id): id is number => typeof id === 'number')) {
      await runRemoteWrite(() => db.playlists.update(playlist.id!, { songIds: resolvedIds, remoteCloudIds: undefined }));
    }
  }

  const karaokes = await db.karaokes.toArray();
  const karaokeIdsByCloudId = new Map(karaokes.map(karaoke => [karaoke.cloudId, karaoke.id]));
  const karaokePlaylists = await db.karaokePlaylists.filter(playlist => Array.isArray(playlist.remoteCloudIds)).toArray();
  for (const playlist of karaokePlaylists) {
    const resolvedIds = playlist.remoteCloudIds!.map(cloudId => karaokeIdsByCloudId.get(cloudId));
    if (resolvedIds.every((id): id is number => typeof id === 'number')) {
      await runRemoteWrite(() => db.karaokePlaylists.update(playlist.id!, { karaokeIds: resolvedIds, remoteCloudIds: undefined }));
    }
  }
};

const applyChanges = async (changes: SyncChange[]) => {
  const latestByEntity = new Map<string, SyncChange>();
  for (const change of changes) latestByEntity.set(`${change.entityType}:${change.entityId}`, change);
  const latestChanges = Array.from(latestByEntity.values());
  for (const change of latestChanges.filter(item => item.deletedAt)) {
    await runRemoteWrite(() => deleteByCloudId(change.entityType, change.entityId));
    await db.syncOperations.where('entityId').equals(change.entityId).delete();
  }
  const activeChanges = latestChanges.filter(item => !item.deletedAt);
  for (const change of activeChanges.filter(item => item.entityType === 'song')) await applySong(change);
  for (const change of activeChanges.filter(item => item.entityType === 'karaoke')) await applyKaraoke(change);
  for (const change of activeChanges.filter(item => !['song', 'karaoke'].includes(item.entityType))) {
    await runRemoteWrite(() => applySimpleEntity(change));
  }
  await resolvePendingPlaylistReferences();
};

const applyConflict = async (rejection: RejectedOperation) => {
  if (rejection.reason === 'conflict' && rejection.serverEntity) {
    await applyChanges([rejection.serverEntity]);
    await db.syncOperations.delete(rejection.operationId);
    return 'conflict';
  }
  await db.syncOperations.update(rejection.operationId, { lastError: rejection.reason });
  return 'rejected';
};

const uploadDirtyFiles = async (headers: Record<string, string>) => {
  let uploaded = false;
  const songs = await db.songs.filter(song => !!song.localFileDirty && !!song.data && !song.isTemporary).toArray();
  for (const song of songs) {
    const formData = new FormData();
    Object.entries(song).forEach(([key, value]) => {
      if (key === 'data' && value) formData.append('file', new Blob([value as BlobPart]), `${song.cloudId}.gp`);
      else if (!['id', 'version', 'createdAt', 'updatedAt', 'deletedAt', 'fileVersion', 'fileHash', 'fileSize', 'fileMimeType'].includes(key) && value != null) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    formData.append('id', song.cloudId!);
    // The metadata upsert above creates the cloud record before its binary file is uploaded.
    // Always update that record so a new local song cannot collide with its own cloud ID.
    const url = `${API_URL}/songs/${song.cloudId}`;
    const response = await fetch(url, { method: 'PUT', headers, body: formData });
    ensureSyncResponse(response, 'Song file upload failed');
    uploaded = true;
    await db.syncOperations.where('entityId').equals(song.cloudId!).delete();
    await runRemoteWrite(() => db.songs.update(song.id!, { localFileDirty: false }));
  }

  const karaokes = await db.karaokes.filter(karaoke => !!karaoke.localFileDirty).toArray();
  for (const karaoke of karaokes) {
    const file = await db.karaokeFiles.get(karaoke.id!);
    if (!file?.data) continue;
    const formData = new FormData();
    Object.entries(karaoke).forEach(([key, value]) => {
      if (!['id', 'version', 'createdAt', 'updatedAt', 'deletedAt', 'fileVersion', 'fileHash', 'fileSize', 'fileMimeType'].includes(key) && value != null) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    formData.append('id', karaoke.cloudId!);
    formData.append('file', new Blob([file.data as BlobPart]), `${karaoke.cloudId}.mp3`);
    const url = `${API_URL}/karaokes/${karaoke.cloudId}`;
    const response = await fetch(url, { method: 'PUT', headers, body: formData });
    ensureSyncResponse(response, 'Karaoke file upload failed');
    uploaded = true;
    await db.syncOperations.where('entityId').equals(karaoke.cloudId!).delete();
    await runRemoteWrite(() => db.karaokes.update(karaoke.id!, { localFileDirty: false }));
  }
  return uploaded;
};

const migrateUnsyncedRecords = async () => {
  const collections = [db.songs, db.karaokes, db.customChords, db.playlists, db.karaokePlaylists] as any[];
  for (const table of collections) {
    const records = await table.toArray();
    for (const record of records) {
      const updates: Record<string, unknown> = {};
      if (!record.cloudId) Object.assign(updates, { cloudId: uuidv4(), version: 0, updatedAt: Date.now() });
      if (table.name === 'songs' && record.data && (!record.cloudUrl || !record.fileVersion)) {
        updates.localFileDirty = true;
      }
      if (Object.keys(updates).length > 0) await table.update(record.id, updates);
    }
  }
};

const applyUiStorage = (value: string) => {
  localStorage.setItem('ui-storage', value);
  try {
    const parsed = JSON.parse(value);
    if (parsed?.state?.theme) useUiStore.getState().setTheme(parsed.state.theme);
  } catch {
    // Ignore malformed legacy settings and keep the local theme.
  }
};

const syncSettings = async (headers: Record<string, string>) => {
  const localValue = localStorage.getItem('ui-storage') || '';
  const localSnapshot = JSON.stringify({ 'ui-storage': localValue });
  const lastSnapshot = localStorage.getItem('lastSyncedUiStorage');
  const authUser = useAuthStore.getState().user as any;

  let remoteSettings: Record<string, string> = {};
  if (authUser?.uiStorage) {
    try {
      remoteSettings = typeof authUser.uiStorage === 'string'
        ? JSON.parse(authUser.uiStorage)
        : authUser.uiStorage;
    } catch {
      remoteSettings = {};
    }
  }
  const remoteValue = remoteSettings['ui-storage'];

  if (lastSnapshot === null && remoteValue) {
    applyUiStorage(remoteValue);
    localStorage.setItem('lastSyncedUiStorage', JSON.stringify({ 'ui-storage': remoteValue }));
    return;
  }
  if (lastSnapshot !== null && localSnapshot === lastSnapshot && remoteValue && remoteValue !== localValue) {
    applyUiStorage(remoteValue);
    localStorage.setItem('lastSyncedUiStorage', JSON.stringify({ 'ui-storage': remoteValue }));
    return;
  }
  if (localSnapshot !== lastSnapshot) {
    const response = await fetch(`${API_URL}/auth/settings`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uiStorage: { 'ui-storage': localValue } })
    });
    ensureSyncResponse(response, 'Settings upload failed');
    localStorage.setItem('lastSyncedUiStorage', localSnapshot);
  }
};

export const SyncService = {
  scheduleAutoSync() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      void this.performAutoSync().catch(() => {});
    }, 3000);
  },

  performAutoSync(onProgress?: (message: string) => void) {
    if (syncInProgress) return syncInProgress;
    syncInProgress = this._doSync(onProgress).finally(() => { syncInProgress = null; });
    return syncInProgress;
  },

  async _doSync(onProgress?: (message: string) => void) {
    const token = useAuthStore.getState().token;
    if (!token || !navigator.onLine) return;
    const retryAt = Number(localStorage.getItem(SYNC_RETRY_AT_KEY) || 0);
    if (retryAt > Date.now()) return;
    if (retryAt) localStorage.removeItem(SYNC_RETRY_AT_KEY);
    const headers = { Authorization: `Bearer ${token}` };

    emitSyncStatus('syncing');
    try {
      let operationsNeedingAttention = 0;
      await migrateUnsyncedRecords();
      await recoverPendingSyncOperations();
      let hasMore = true;
      let sendOperations = true;
      while (hasMore) {
        const operations = sendOperations
          ? (await db.syncOperations.filter(operation => !operation.lastError).toArray())
            .sort((left, right) => {
              const leftPlaylist = ['playlist', 'karaoke_playlist'].includes(left.entityType);
              const rightPlaylist = ['playlist', 'karaoke_playlist'].includes(right.entityType);
              const leftPriority = left.action === 'delete' ? (leftPlaylist ? 0 : 1) : (leftPlaylist ? 1 : 0);
              const rightPriority = right.action === 'delete' ? (rightPlaylist ? 0 : 1) : (rightPlaylist ? 1 : 0);
              return leftPriority - rightPriority || left.clientUpdatedAt - right.clientUpdatedAt;
            })
            .slice(0, 100)
          : [];
        onProgress?.('Sincronizando cambios...');
        const response = await fetch(`${API_URL}/sync/v2`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: getDeviceId(),
            cursor: localStorage.getItem(CURSOR_KEY),
            limit: 200,
            operations: operations.map(operation => ({
              operationId: operation.operationId,
              entityType: operation.entityType,
              entityId: operation.entityId,
              action: operation.action,
              baseVersion: operation.baseVersion,
              clientUpdatedAt: operation.clientUpdatedAt,
              data: operation.data
            }))
          })
        });
        ensureSyncResponse(response, 'Sync v2 failed');
        const result = await response.json() as SyncResponse;

        await applyChanges(result.changes || []);
        await db.syncOperations.bulkDelete(result.acknowledgedOperationIds || []);
        for (const rejection of result.rejectedOperations || []) {
          await applyConflict(rejection);
          operationsNeedingAttention++;
        }
        if (result.nextCursor) localStorage.setItem(CURSOR_KEY, result.nextCursor);
        const pendingCount = await db.syncOperations.filter(operation => !operation.lastError).count();
        sendOperations = !result.hasMore && pendingCount > 0;
        hasMore = result.hasMore || sendOperations;
      }

      onProgress?.('Subiendo archivos pendientes...');
      const uploadedFiles = await uploadDirtyFiles(headers);
      if (uploadedFiles) {
        hasMore = true;
        while (hasMore) {
          const response = await fetch(`${API_URL}/sync/v2`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: getDeviceId(),
              cursor: localStorage.getItem(CURSOR_KEY),
              limit: 200,
              operations: []
            })
          });
          ensureSyncResponse(response, 'Sync v2 failed after file upload');
          const result = await response.json() as SyncResponse;
          await applyChanges(result.changes || []);
          if (result.nextCursor) localStorage.setItem(CURSOR_KEY, result.nextCursor);
          hasMore = result.hasMore;
        }
      }
      await syncSettings(headers);
      onProgress?.('¡Sincronización completada!');
      emitSyncStatus(operationsNeedingAttention > 0 ? 'attention' : 'success');
    } catch (error) {
      if (error instanceof RateLimitError) {
        emitSyncStatus('idle');
        console.warn('Auto-sync paused by server rate limit');
        return;
      }
      emitSyncStatus('error');
      console.error('Auto-sync v2 failed', error);
      throw error;
    }
  },

  async syncAllToCloud(onProgress?: (message: string) => void) {
    await this.performAutoSync(onProgress);
  },

  async downloadAllFromCloud(onProgress?: (message: string) => void) {
    await this.performAutoSync(onProgress);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('trigger-auto-sync', () => SyncService.scheduleAutoSync());
}
