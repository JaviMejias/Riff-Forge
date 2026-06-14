import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Download, Upload, AlertTriangle, CheckCircle2, Menu } from 'lucide-react';
import { db } from '../db';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useUiStore } from '../store/uiStore';
import { Button } from './ui/Button';

const MySwal = withReactContent(Swal);

interface SettingsViewProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const SettingsView = (_props: SettingsViewProps) => {
  const { setMobileMenuOpen } = useUiStore();
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

      // Optimize JSON: Convert Uint8Array data to base64
      const optimizedSongs = songs.map(s => {
        if (s.data) {
          return { ...s, dataBase64: uint8ToBase64(s.data), data: undefined };
        }
        return s;
      });

      const backupData = {
        version: 1,
        timestamp: Date.now(),
        data: {
          songs: optimizedSongs,
          playlists,
          customChords
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
      if (!backupData.data || !backupData.data.songs) {
        throw new Error("Formato de archivo inválido");
      }

      const { songs, playlists, customChords } = backupData.data;

      // Reconstruct Uint8Array from base64
      const restoredSongs = songs.map((s: any) => {
        if (s.dataBase64) {
          const data = base64ToUint8(s.dataBase64);
          delete s.dataBase64;
          return { ...s, data };
        }
        return s;
      });

      const result = await MySwal.fire({
        title: 'Opciones de Restauración',
        text: '¿Deseas reemplazar tu biblioteca actual completamente o añadir los nuevos datos (fusionar)?',
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
        await db.transaction('rw', [db.songs, db.playlists, db.customChords], async () => {
          await db.songs.clear();
          await db.playlists.clear();
          await db.customChords.clear();
          
          if (restoredSongs.length > 0) await db.songs.bulkAdd(restoredSongs);
          if (playlists && playlists.length > 0) await db.playlists.bulkAdd(playlists);
          if (customChords && customChords.length > 0) await db.customChords.bulkAdd(customChords);
        });
      } else if (result.isDenied) {
        // Merge - we need to strip IDs to avoid conflict, but this breaks playlist references!
        // To keep it simple but safe for merging without breaking playlist refs, we can assign new IDs to songs
        // and update the playlists accordingly.
        await db.transaction('rw', [db.songs, db.playlists, db.customChords], async () => {
          const idMapping = new Map<number, number>(); // oldId -> newId

          for (const s of restoredSongs) {
            const oldId = s.id;
            delete s.id;
            const newId = await db.songs.add(s) as number;
            if (oldId) idMapping.set(oldId, newId);
          }

          if (playlists) {
            for (const p of playlists) {
              delete p.id;
              p.songIds = p.songIds.map((oldId: number) => idMapping.get(oldId) || oldId);
              await db.playlists.add(p);
            }
          }

          if (customChords) {
            for (const c of customChords) {
              delete c.id;
              await db.customChords.add(c);
            }
          }
        });
      }

      MySwal.fire({
        title: 'Importación Exitosa',
        text: 'Los datos han sido restaurados correctamente.',
        icon: 'success',
        background: '#18181b',
        color: '#fff',
        confirmButtonColor: '#f59e0b'
      });
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
            <Settings className="text-amber-500 hidden md:block" size={24} />
            <h1 className="text-xl md:text-2xl font-black text-white">Ajustes</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full p-6 md:p-12">
        
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
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/20">
                  <Download className="text-amber-500" size={24} />
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
