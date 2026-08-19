import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, Palette, CheckCircle2, AlertTriangle, RefreshCcw, RefreshCw, Smartphone } from 'lucide-react';
import { db } from '../db';
import type { Karaoke, KaraokeFile, KaraokePlaylist, Playlist, Song } from '../db';
import type { ChordDef } from '../chords';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useUiStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { Navbar } from './Navbar';
import { Button } from './ui/Button';

const MySwal = withReactContent(Swal);
const BACKUP_VERSION = 3;
const SAFE_SETTING_KEYS = ['ui-storage', 'riff-forge-player-storage'];
const DELETION_BACKUP_KEY = 'sync_v2_pending_deletions';
const SYNC_CURSOR_KEY = 'sync_v2_cursor';

const withoutLocalId = <T extends { id?: number }>(record: T): Omit<T, 'id'> => {
  const copy = { ...record };
  delete copy.id;
  return copy as Omit<T, 'id'>;
};

const validBackupCollection = (value: unknown) => Array.isArray(value) && value.every(item => item && typeof item === 'object' && !Array.isArray(item));

interface SettingsViewProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  updateAvailable: boolean;
  isCheckingForUpdates: boolean;
  isHardRefreshing: boolean;
  onCheckForUpdates: () => Promise<void>;
  onUpdate: () => void;
  onHardRefresh: () => Promise<void>;
}

export const SettingsView = ({
  isSidebarOpen,
  onToggleSidebar,
  updateAvailable,
  isCheckingForUpdates,
  isHardRefreshing,
  onCheckForUpdates,
  onUpdate,
  onHardRefresh
}: SettingsViewProps) => {
  const { theme, setTheme } = useUiStore();
  const user = useAuthStore(state => state.user);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(() => Number(localStorage.getItem('sync_v2_last_success_at') || 0));

  // Convert Uint8Array to Base64 for JSON serialization
  const uint8ToBase64 = (u8Arr: Uint8Array) => {
    const chunks: string[] = [];
    const chunkSize = 0x8000;
    for (let offset = 0; offset < u8Arr.length; offset += chunkSize) {
      chunks.push(String.fromCharCode(...u8Arr.subarray(offset, offset + chunkSize)));
    }
    return btoa(chunks.join(''));
  };

  // Convert Base64 back to Uint8Array
  const base64ToUint8 = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
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

      // Optimize JSON: Convert Uint8Array data to base64
      const optimizedSongs = songs.map(s => {
        if (s.data) {
          return { ...s, dataBase64: uint8ToBase64(s.data), data: undefined };
        }
        return s;
      });

      const optimizedKaraokeFiles = karaokeFiles.map(f => {
        if (f.data) {
          return { ...f, dataBase64: uint8ToBase64(f.data), data: undefined };
        }
        return f;
      });

      const backupData = {
        version: BACKUP_VERSION,
        timestamp: Date.now(),
        ownerId: user?.id || null,
        manifest: {
          songs: songs.length,
          songFiles: songs.filter(song => !!song.data).length,
          karaokes: karaokes.length,
          karaokeFiles: karaokeFiles.length
        },
        data: {
          songs: optimizedSongs,
          playlists,
          customChords,
          karaokes,
          karaokePlaylists,
          karaokeFiles: optimizedKaraokeFiles,
          settings
        }
      };

      const jsonStr = JSON.stringify(backupData);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RiffForge_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const missingSongFiles = songs.filter(song => song.type !== 'text' && !song.data).length;
      const missingKaraokeFiles = karaokes.length - karaokeFiles.length;
      MySwal.fire({
        title: 'Exportación Exitosa',
        text: missingSongFiles || missingKaraokeFiles
          ? `El respaldo se creó. ${missingSongFiles + missingKaraokeFiles} archivo(s) están solo en la nube y no pudieron incluirse localmente.`
          : 'Tu biblioteca y todos sus archivos locales fueron guardados.',
        icon: 'success',
        background: '#18181b',
        color: '#fff',
        confirmButtonColor: '#f59e0b'
      });
    } catch (e) {
      console.error(e);
      MySwal.fire({
        title: 'Error',
        text: 'No se pudo exportar la biblioteca.',
        icon: 'error',
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const processImport = async (jsonStr: string) => {
    try {
      const backupData = JSON.parse(jsonStr) as {
        version: number;
        ownerId?: string | null;
        data?: {
          songs?: Array<Song & { dataBase64?: string }>;
          playlists?: Playlist[];
          customChords?: ChordDef[];
          karaokes?: Karaoke[];
          karaokePlaylists?: KaraokePlaylist[];
          karaokeFiles?: Array<KaraokeFile & { dataBase64?: string }>;
          settings?: Record<string, unknown>;
        };
      };
      if (![2, BACKUP_VERSION].includes(backupData.version) || !backupData.data) {
        throw new Error("Formato de archivo inválido");
      }

      const { songs = [], playlists = [], customChords = [], karaokes = [], karaokePlaylists = [], karaokeFiles = [], settings = {} } = backupData.data;
      const collections = [songs, playlists, customChords, karaokes, karaokePlaylists, karaokeFiles];
      if (!collections.every(validBackupCollection) || !settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new Error('Estructura de respaldo inválida');
      }
      if (backupData.version === BACKUP_VERSION && backupData.ownerId && user?.id && backupData.ownerId !== user.id) {
        throw new Error('Este respaldo pertenece a otra cuenta');
      }

      // Reconstruct Uint8Array from base64
      const restoredSongs = songs.map((s: Song & { dataBase64?: string }) => {
        if (s.dataBase64) {
          const data = base64ToUint8(s.dataBase64);
          delete s.dataBase64;
          return { ...s, data };
        }
        return s;
      });

      const restoredKaraokeFiles = karaokeFiles.map((f: KaraokeFile & { dataBase64?: string }) => {
        if (f.dataBase64) {
          const data = base64ToUint8(f.dataBase64);
          delete f.dataBase64;
          return { ...f, data };
        }
        return f;
      });

      const result = await MySwal.fire({
        title: 'Opciones de Restauración',
        text: 'Puedes reemplazar los datos de este dispositivo o fusionar el respaldo. Después se reconciliarán de forma segura con tu cuenta en la nube.',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Reemplazar en este dispositivo',
        denyButtonText: 'Fusionar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--primary-500)',
        denyButtonColor: '#f59e0b',
        cancelButtonColor: '#3f3f46',
        background: '#18181b',
        color: '#fff'
      });

      if (result.isDismissed) return;

      setIsImporting(true);
      const safeSettings = Object.fromEntries(
        SAFE_SETTING_KEYS
          .filter(key => typeof settings[key] === 'string')
          .map(key => [key, settings[key]])
      ) as Record<string, string>;
      const syncAwareWindow = window as typeof window & { __isSyncing?: boolean };
      syncAwareWindow.__isSyncing = true;

      try {
        if (result.isConfirmed) {
          await db.transaction('rw', [db.songs, db.playlists, db.customChords, db.karaokes, db.karaokePlaylists, db.karaokeFiles, db.syncOperations], async () => {
            await db.songs.clear();
            await db.playlists.clear();
            await db.customChords.clear();
            await db.karaokes.clear();
            await db.karaokePlaylists.clear();
            await db.karaokeFiles.clear();
            await db.syncOperations.clear();

            if (restoredSongs.length > 0) await db.songs.bulkAdd(restoredSongs);
            if (playlists.length > 0) await db.playlists.bulkAdd(playlists);
            if (customChords.length > 0) await db.customChords.bulkAdd(customChords);
            if (karaokes.length > 0) await db.karaokes.bulkAdd(karaokes);
            if (karaokePlaylists.length > 0) await db.karaokePlaylists.bulkAdd(karaokePlaylists);
            if (restoredKaraokeFiles.length > 0) await db.karaokeFiles.bulkAdd(restoredKaraokeFiles);
          });
          localStorage.removeItem(DELETION_BACKUP_KEY);
        } else if (result.isDenied) {
          await db.transaction('rw', [db.songs, db.playlists, db.customChords, db.karaokes, db.karaokePlaylists, db.karaokeFiles], async () => {
            const idMapping = new Map<number, number>(); // oldId -> newId
            const existingSongs = await db.songs.toArray();
            const songsByCloudId = new Map(existingSongs.filter(song => song.cloudId).map(song => [song.cloudId, song.id!]));

            for (const s of restoredSongs) {
              const oldId = s.id;
              const existingId = s.cloudId ? songsByCloudId.get(s.cloudId) : undefined;
              const newId = existingId || await db.songs.add(withoutLocalId(s)) as number;
              if (oldId) idMapping.set(oldId, newId);
            }

            for (const p of playlists) {
              const existing = p.cloudId ? await db.playlists.where('cloudId').equals(p.cloudId).first() : undefined;
              if (existing) continue;
              await db.playlists.add({ ...withoutLocalId(p), songIds: p.songIds.map(oldId => idMapping.get(oldId)).filter((id): id is number => typeof id === 'number') });
            }

            const existingChords = await db.customChords.toArray();
            const chordCloudIds = new Set(existingChords.map(chord => chord.cloudId).filter(Boolean));
            for (const c of customChords) {
              if (!c.cloudId || !chordCloudIds.has(c.cloudId)) await db.customChords.add(withoutLocalId(c));
            }

            const kIdMapping = new Map<number, number>();
            const existingKaraokes = await db.karaokes.toArray();
            const karaokesByCloudId = new Map(existingKaraokes.filter(karaoke => karaoke.cloudId).map(karaoke => [karaoke.cloudId, karaoke.id!]));
            for (const k of karaokes) {
              const oldId = k.id;
              const existingId = k.cloudId ? karaokesByCloudId.get(k.cloudId) : undefined;
              const newId = existingId || await db.karaokes.add(withoutLocalId(k)) as number;
              if (oldId) kIdMapping.set(oldId, newId);
            }

            for (const p of karaokePlaylists) {
              const existing = p.cloudId ? await db.karaokePlaylists.where('cloudId').equals(p.cloudId).first() : undefined;
              if (existing) continue;
              await db.karaokePlaylists.add({ ...withoutLocalId(p), karaokeIds: p.karaokeIds.map(oldId => kIdMapping.get(oldId)).filter((id): id is number => typeof id === 'number') });
            }

            for (const f of restoredKaraokeFiles) {
              const karaokeId = kIdMapping.get(f.karaokeId);
              if (karaokeId) await db.karaokeFiles.put({ ...f, karaokeId });
            }
          });
        }
      } finally {
        syncAwareWindow.__isSyncing = false;
      }

      localStorage.removeItem(SYNC_CURSOR_KEY);
      Object.entries(safeSettings).forEach(([key, value]) => localStorage.setItem(key, value));

      await MySwal.fire({
        title: 'Importación Exitosa',
        text: 'Los datos han sido restaurados correctamente.',
        icon: 'success',
        background: '#18181b',
        color: '#fff',
        confirmButtonColor: '#f59e0b'
      });

      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      console.error(e);
      const belongsToAnotherAccount = e instanceof Error && e.message === 'Este respaldo pertenece a otra cuenta';
      MySwal.fire({
        title: 'Error de Importación',
        text: belongsToAnotherAccount
          ? 'Este respaldo fue creado por otra cuenta y no puede mezclarse con la sesión actual.'
          : 'El archivo parece estar dañado o no es un backup válido de Riff Forge.',
        icon: 'error',
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsImporting(false);
      // clear the file input
      const fileInput = document.getElementById('import-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      if (!navigator.onLine) throw new Error('offline');
      const { SyncService, LAST_SYNC_SUCCESS_AT_KEY } = await import('../services/syncService');
      const previousSyncAt = Number(localStorage.getItem(LAST_SYNC_SUCCESS_AT_KEY) || 0);
      await SyncService.performAutoSync();
      const syncedAt = Number(localStorage.getItem(LAST_SYNC_SUCCESS_AT_KEY) || 0);
      if (!syncedAt || syncedAt <= previousSyncAt) throw new Error('sync_not_completed');
      setLastSyncAt(syncedAt);
      await MySwal.fire({
        title: 'Sincronización completada',
        text: 'Tus cambios locales y de la nube están al día.',
        icon: 'success',
        background: '#18181b',
        color: '#fff',
        confirmButtonColor: 'var(--primary-500)'
      });
    } catch (error) {
      console.error(error);
      await MySwal.fire({
        title: 'No se pudo sincronizar',
        text: 'Revisa tu conexión e inténtalo nuevamente.',
        icon: 'error',
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const jsonStr = event.target?.result as string;
      if (jsonStr) {
        processImport(jsonStr);
      }
    };
    reader.onerror = () => {
      setIsImporting(false);
      void MySwal.fire({
        title: 'No se pudo leer el archivo',
        text: 'Selecciona nuevamente el respaldo e inténtalo otra vez.',
        icon: 'error',
        background: '#18181b',
        color: '#fff'
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 overflow-y-auto custom-scrollbar pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
      {/* Navbar area */}
      <div className="px-4 pt-4 sm:px-8 sm:pt-8 sm:pb-4 shrink-0">
        <Navbar
          title="Ajustes"
          subtitle="Configuración y personalización"
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={onToggleSidebar}
        />
      </div>

      <div className="w-full px-3 py-4 sm:p-8">
        <div className="w-full max-w-6xl mx-auto bg-zinc-900/30 border border-white/5 rounded-2xl sm:rounded-[2rem] p-4 sm:p-10 shadow-2xl backdrop-blur-sm flex flex-col gap-8 sm:gap-12">
        
        {/* APARIENCIA */}
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 sm:mb-6">Apariencia</h2>
          
          <div className="bg-zinc-900/50 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 shadow-xl transition-all duration-300 hover:border-primary-500/20 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)]">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary-500/20 bg-primary-500/10">
                <Palette className="text-primary-500" size={24} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Tema Principal</h3>
                <p className="text-zinc-400 text-sm">
                  Personaliza el color base de toda la interfaz.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-5 items-center justify-start gap-2 sm:flex sm:flex-wrap sm:gap-3 md:justify-end">
              {[
                { id: 'amber', color: '#f59e0b', name: 'Riff Forge (Ámbar)' },
                { id: 'ruby', color: '#ef4444', name: 'Carmín (Rojo)' },
                { id: 'rose', color: '#ff8096', name: 'Rosa Pastel' },
                { id: 'emerald', color: '#10b981', name: 'Esmeralda' },
                { id: 'lime', color: '#84cc16', name: 'Lima (Verde Neón)' },
                { id: 'cyan', color: '#06b6d4', name: 'Cian (Aqua)' },
                { id: 'blue', color: '#3b82f6', name: 'Azul' },
                { id: 'indigo', color: '#6366f1', name: 'Índigo (Nocturno)' },
                { id: 'violet', color: '#8b5cf6', name: 'Violeta' },
                { id: 'silver', color: '#d4d4d8', name: 'Plata (Monocromo)' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  title={t.name}
                  aria-label={`Usar tema ${t.name}`}
                  aria-pressed={theme === t.id}
                  className={`w-11 h-11 sm:w-10 sm:h-10 rounded-full transition-all flex items-center justify-center ${theme === t.id ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-105' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: t.color }}
                >
                  {theme === t.id && <CheckCircle2 size={16} className="text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500 sm:mb-6 sm:text-sm">Aplicación</h2>
          <div className="flex flex-col gap-5 rounded-2xl border border-white/5 bg-zinc-900/50 p-4 shadow-xl sm:rounded-3xl sm:p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-400">
                <Smartphone size={24} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white sm:text-xl">Riff Forge</h3>
                <p className={`mt-1 text-xs font-medium ${updateAvailable ? 'text-primary-400' : 'text-emerald-400'}`}>
                  {updateAvailable ? 'Hay una nueva versión lista para instalar.' : 'La aplicación no tiene actualizaciones pendientes.'}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <Button
                type="button"
                variant={updateAvailable ? 'primary' : 'secondary'}
                onClick={updateAvailable ? onUpdate : () => void onCheckForUpdates()}
                disabled={isCheckingForUpdates || isHardRefreshing}
                icon={<RefreshCw size={18} className={isCheckingForUpdates ? 'animate-spin' : ''} />}
                className="w-full md:w-auto"
              >
                {updateAvailable ? 'Actualizar ahora' : isCheckingForUpdates ? 'Buscando…' : 'Buscar actualizaciones'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void onHardRefresh()}
                disabled={isCheckingForUpdates || isHardRefreshing}
                icon={<RefreshCcw size={18} className={isHardRefreshing ? 'animate-spin' : ''} />}
                className="w-full md:w-auto"
                title="Limpia la caché de la aplicación y vuelve a cargarla"
              >
                {isHardRefreshing ? 'Recargando…' : 'Recarga forzada'}
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500 sm:mb-6 sm:text-sm">Sincronización</h2>
          <div className="flex flex-col gap-5 rounded-2xl border border-white/5 bg-zinc-900/50 p-4 shadow-xl sm:rounded-3xl sm:p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-400">
                <RefreshCw size={24} className={isSyncing ? 'animate-spin' : ''} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white sm:text-xl">Datos en la nube</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {lastSyncAt
                    ? `Última sincronización: ${new Date(lastSyncAt).toLocaleString()}`
                    : 'Este dispositivo todavía no registra una sincronización completada.'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSyncNow()}
              disabled={isSyncing}
              icon={<RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />}
              className="w-full md:w-auto"
            >
              {isSyncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 sm:mb-6">Portabilidad y Respaldo Local</h2>
          
          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6"
          >
            
            {/* EXPORT CARD */}
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4 }}
              className="bg-zinc-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col justify-between shadow-lg transition-all duration-300 hover:border-primary-500/20 hover:shadow-[0_0_30px_var(--theme-glow)]"
            >
              <div>
                <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-4 border border-primary-500/20">
                  <Download className="text-primary-500" size={24} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Exportar Biblioteca</h3>
                <p className="text-zinc-400 text-sm mb-6">
                  Guarda canciones, karaokes, archivos locales, listas y preferencias permitidas. Nunca incluye tu sesión ni credenciales.
                </p>
              </div>
              
              <Button
                onClick={handleExport}
                disabled={isExporting}
                variant="primary"
                fullWidth
                icon={isExporting ? <AlertTriangle className="animate-pulse" size={18} /> : <CheckCircle2 size={18} />}
              >
                {isExporting ? 'Exportando...' : 'Descargar Backup'}
              </Button>
            </motion.div>

            {/* IMPORT CARD */}
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4 }}
              className="bg-zinc-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col justify-between shadow-lg transition-all duration-300 hover:border-primary-500/20 hover:shadow-[0_0_30px_var(--theme-glow)]"
            >
              <div>
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 border border-indigo-500/20">
                  <Upload className="text-indigo-400" size={24} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Importar Biblioteca</h3>
                <p className="text-zinc-400 text-sm mb-6">
                  Restaura un archivo de respaldo previamente guardado. Podrás elegir si deseas fusionar los datos con tu biblioteca actual o reemplazarla.
                </p>
              </div>
              
              <div className="relative">
                <input
                  type="file"
                  id="import-file"
                  accept=".json"
                  onChange={handleImportClick}
                  disabled={isImporting}
                  aria-label="Seleccionar archivo de respaldo"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-indigo-500 hover:text-white text-white rounded-xl transition-all font-bold">
                  <Upload size={18} />
                  {isImporting ? 'Importando...' : 'Seleccionar Archivo'}
                </div>
              </div>
            </motion.div>

          </motion.div>
        </div>

        </div>
      </div>
    </div>
  );
};
