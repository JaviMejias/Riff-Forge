import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Download, Upload, AlertTriangle, CheckCircle2, Menu } from 'lucide-react';
import { db } from '../db';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useUiStore } from '../store/uiStore';
import { Button } from './ui/Button';
import { Palette } from 'lucide-react';

const MySwal = withReactContent(Swal);

interface SettingsViewProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const SettingsView = (_props: SettingsViewProps) => {
  const { setMobileMenuOpen, theme, setTheme } = useUiStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Convert Uint8Array to Base64 for JSON serialization
  const uint8ToBase64 = (u8Arr: Uint8Array) => {
    let binaryString = '';
    for (let i = 0; i < u8Arr.length; i++) {
      binaryString += String.fromCharCode(u8Arr[i]);
    }
    return btoa(binaryString);
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
      const songs = await db.songs.toArray();
      const playlists = await db.playlists.toArray();
      const customChords = await db.customChords.toArray();
      const karaokes = await db.karaokes.toArray();
      const karaokePlaylists = await db.karaokePlaylists.toArray();
      const karaokeFiles = await db.karaokeFiles.toArray();

      const settings: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          settings[key] = localStorage.getItem(key) || '';
        }
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
        version: 2,
        timestamp: Date.now(),
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

      MySwal.fire({
        title: 'Exportación Exitosa',
        text: 'Tu biblioteca ha sido guardada en un archivo de respaldo.',
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
      const backupData = JSON.parse(jsonStr);
      if (!backupData.data) {
        throw new Error("Formato de archivo inválido");
      }

      const { songs = [], playlists = [], customChords = [], karaokes = [], karaokePlaylists = [], karaokeFiles = [], settings = {} } = backupData.data;

      // Reconstruct Uint8Array from base64
      const restoredSongs = songs.map((s: any) => {
        if (s.dataBase64) {
          const data = base64ToUint8(s.dataBase64);
          delete s.dataBase64;
          return { ...s, data };
        }
        return s;
      });

      const restoredKaraokeFiles = karaokeFiles.map((f: any) => {
        if (f.dataBase64) {
          const data = base64ToUint8(f.dataBase64);
          delete f.dataBase64;
          return { ...f, data };
        }
        return f;
      });

      const result = await MySwal.fire({
        title: 'Opciones de Restauración',
        text: '¿Deseas reemplazar tu biblioteca actual completamente o añadir los nuevos datos (fusionar)? Si se restauran ajustes de usuario, la página se recargará automáticamente.',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Reemplazar Todo',
        denyButtonText: 'Fusionar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        denyButtonColor: '#f59e0b',
        cancelButtonColor: '#3f3f46',
        background: '#18181b',
        color: '#fff'
      });

      if (result.isDismissed) return;

      setIsImporting(true);

      if (result.isConfirmed) {
        // Replace all
        await db.transaction('rw', [db.songs, db.playlists, db.customChords, db.karaokes, db.karaokePlaylists, db.karaokeFiles], async () => {
          await db.songs.clear();
          await db.playlists.clear();
          await db.customChords.clear();
          await db.karaokes.clear();
          await db.karaokePlaylists.clear();
          await db.karaokeFiles.clear();
          
          if (restoredSongs.length > 0) await db.songs.bulkAdd(restoredSongs);
          if (playlists.length > 0) await db.playlists.bulkAdd(playlists);
          if (customChords.length > 0) await db.customChords.bulkAdd(customChords);
          if (karaokes.length > 0) await db.karaokes.bulkAdd(karaokes);
          if (karaokePlaylists.length > 0) await db.karaokePlaylists.bulkAdd(karaokePlaylists);
          if (restoredKaraokeFiles.length > 0) await db.karaokeFiles.bulkAdd(restoredKaraokeFiles);
        });

        if (Object.keys(settings).length > 0) {
          localStorage.clear();
          Object.entries(settings).forEach(([key, value]) => {
            localStorage.setItem(key, value as string);
          });
        }
      } else if (result.isDenied) {
        // Merge
        await db.transaction('rw', [db.songs, db.playlists, db.customChords, db.karaokes, db.karaokePlaylists, db.karaokeFiles], async () => {
          const idMapping = new Map<number, number>(); // oldId -> newId

          for (const s of restoredSongs) {
            const oldId = s.id;
            delete s.id;
            const newId = await db.songs.add(s) as number;
            if (oldId) idMapping.set(oldId, newId);
          }

          for (const p of playlists) {
            delete p.id;
            p.songIds = p.songIds.map((oldId: number) => idMapping.get(oldId) || oldId);
            await db.playlists.add(p);
          }

          for (const c of customChords) {
            delete c.id;
            await db.customChords.add(c);
          }

          const kIdMapping = new Map<number, number>();
          for (const k of karaokes) {
             const oldId = k.id;
             delete k.id;
             const newId = await db.karaokes.add(k) as number;
             if (oldId) kIdMapping.set(oldId, newId);
          }

          for (const p of karaokePlaylists) {
             delete p.id;
             p.songIds = p.songIds.map((oldId: number) => kIdMapping.get(oldId) || oldId);
             await db.karaokePlaylists.add(p);
          }

          for (const f of restoredKaraokeFiles) {
             if (f.karaokeId && kIdMapping.has(f.karaokeId)) {
                f.karaokeId = kIdMapping.get(f.karaokeId);
             }
             await db.karaokeFiles.put(f);
          }
        });

        if (Object.keys(settings).length > 0) {
          Object.entries(settings).forEach(([key, value]) => {
            localStorage.setItem(key, value as string);
          });
        }
      }

      await MySwal.fire({
        title: 'Importación Exitosa',
        text: 'Los datos han sido restaurados correctamente.',
        icon: 'success',
        background: '#18181b',
        color: '#fff',
        confirmButtonColor: '#f59e0b'
      });

      if (Object.keys(settings).length > 0) {
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e) {
      console.error(e);
      MySwal.fire({
        title: 'Error de Importación',
        text: 'El archivo parece estar dañado o no es un backup válido de Riff Forge.',
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
    reader.readAsText(file);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-y-auto hide-scrollbar">
      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-3">
            <Settings className="text-primary-500 hidden md:block" size={24} />
            <h1 className="text-xl md:text-2xl font-black text-white">Ajustes</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full p-6 md:p-12">
        
        {/* APARIENCIA */}
        <div className="mb-12">
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Apariencia</h2>
          
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/20">
                <Palette className="text-primary-500" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Tema Principal</h3>
                <p className="text-zinc-400 text-sm">
                  Personaliza el color base de toda la interfaz.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {[
                { id: 'amber', color: '#f59e0b', name: 'Riff Forge (Ámbar)' },
                { id: 'rose', color: '#f43f5e', name: 'Rosa' },
                { id: 'emerald', color: '#10b981', name: 'Esmeralda' },
                { id: 'blue', color: '#3b82f6', name: 'Azul' },
                { id: 'violet', color: '#8b5cf6', name: 'Violeta' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  title={t.name}
                  className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${theme === t.id ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                  style={{ backgroundColor: t.color }}
                >
                  {theme === t.id && <CheckCircle2 size={16} className="text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Portabilidad y Respaldo</h2>
          
          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            
            {/* EXPORT CARD */}
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4 }}
              className="bg-zinc-900 border border-white/5 rounded-3xl p-6 flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-4 border border-primary-500/20">
                  <Download className="text-primary-500" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Exportar Biblioteca</h3>
                <p className="text-zinc-400 text-sm mb-6">
                  Crea un archivo de respaldo con todas tus canciones, listas de reproducción y acordes personalizados. Ideal para llevar tu música a otra computadora.
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
              className="bg-zinc-900 border border-white/5 rounded-3xl p-6 flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 border border-indigo-500/20">
                  <Upload className="text-indigo-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Importar Biblioteca</h3>
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
  );
};
