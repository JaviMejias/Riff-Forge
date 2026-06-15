import { Upload, Search, Mic2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KaraokeCard } from './KaraokeCard';
import { SongSkeleton } from '../SongSkeleton';
import { Navbar } from '../Navbar';
import { db } from '../../db';
import type { Karaoke } from '../../db';
import { useState, useRef } from 'react';

import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Toast } from '../../utils/toast';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

const MySwal = withReactContent(Swal);

interface KaraokeLibraryViewProps {
  karaokes: Karaoke[];
  activeKaraokeId: number | null;
  onPlayKaraoke: (karaoke: Karaoke) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const KaraokeLibraryView = ({ karaokes, activeKaraokeId, onPlayKaraoke, isSidebarOpen, onToggleSidebar }: KaraokeLibraryViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to normalize strings for comparison
  const normalizeString = (str: string) => {
    return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };
  
  // A future modal could handle youtube pasting or local file
  const handleAddKaraoke = async () => {
    const { value: formValues } = await MySwal.fire({
      title: 'Añadir Karaoke',
      html: `
        <div class="flex flex-col gap-4 text-left">
          <div>
            <label class="text-zinc-400 text-sm font-bold mb-1 block">Título</label>
            <input id="swal-input-title" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" placeholder="Ej: Bohemian Rhapsody">
          </div>
          <div>
            <label class="text-zinc-400 text-sm font-bold mb-1 block">Artista</label>
            <input id="swal-input-artist" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" placeholder="Ej: Queen">
          </div>
          <div>
            <label class="text-zinc-400 text-sm font-bold mb-1 block">Enlace de YouTube</label>
            <input id="swal-input-url" type="url" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" placeholder="Ej: https://www.youtube.com/watch?v=...">
          </div>
        </div>
      `,
      focusConfirm: false,
      background: '#18181b',
      color: '#f4f4f5',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b',
      preConfirm: () => {
        const title = (document.getElementById('swal-input-title') as HTMLInputElement).value;
        const artist = (document.getElementById('swal-input-artist') as HTMLInputElement).value;
        const url = (document.getElementById('swal-input-url') as HTMLInputElement).value;
        if (!title) {
          Swal.showValidationMessage('El título es obligatorio');
          return false;
        }
        return { title, artist, url };
      }
    });

    if (formValues) {
      const titleNorm = normalizeString(formValues.title);
      const artistNorm = normalizeString(formValues.artist || 'Desconocido');
      
      // Look for an existing karaoke with the same title and artist
      const existingKaraokes = await db.karaokes.toArray();
      const existing = existingKaraokes.find(k => 
        normalizeString(k.name) === titleNorm && 
        normalizeString(k.artist || 'Desconocido') === artistNorm
      );

      let targetId: number;

      if (existing) {
        // Update existing karaoke
        await db.karaokes.update(existing.id!, {
          youtubeUrl: formValues.url || undefined
        });
        targetId = existing.id!;
        Toast.fire({
          icon: 'success',
          title: 'Añadido a la versión existente'
        });
      } else {
        targetId = await db.karaokes.add({
          name: formValues.title,
          artist: formValues.artist || 'Desconocido',
          youtubeUrl: formValues.url || undefined,
          dateAdded: Date.now()
        }) as number;
        
        Toast.fire({
          icon: 'success',
          title: 'Karaoke añadido con éxito'
        });
      }
      
      const targetKaraoke = await db.karaokes.get(targetId);
      if (targetKaraoke) {
        onPlayKaraoke(targetKaraoke);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Pedir artista y confirmar título (usamos el nombre del archivo sin extensión como default)
    const defaultTitle = file.name.replace(/\.[^/.]+$/, "");

    const { value: formValues } = await MySwal.fire({
      title: 'Detalles del Archivo',
      html: `
        <div class="flex flex-col gap-4 text-left">
          <div>
            <label class="text-zinc-400 text-sm font-bold mb-1 block">Título</label>
            <input id="swal-file-title" value="${defaultTitle}" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" placeholder="Ej: Bohemian Rhapsody">
          </div>
          <div>
            <label class="text-zinc-400 text-sm font-bold mb-1 block">Artista</label>
            <input id="swal-file-artist" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none" placeholder="Ej: Queen">
          </div>
        </div>
      `,
      focusConfirm: false,
      background: '#18181b',
      color: '#f4f4f5',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b',
      preConfirm: () => {
        const title = (document.getElementById('swal-file-title') as HTMLInputElement).value;
        const artist = (document.getElementById('swal-file-artist') as HTMLInputElement).value;
        if (!title) {
          Swal.showValidationMessage('El título es obligatorio');
          return false;
        }
        return { title, artist };
      }
    });

    if (formValues) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (arrayBuffer) {
          const titleNorm = normalizeString(formValues.title);
          const artistNorm = normalizeString(formValues.artist || 'Desconocido');
          
          const existingKaraokes = await db.karaokes.toArray();
          const existing = existingKaraokes.find(k => 
            normalizeString(k.name) === titleNorm && 
            normalizeString(k.artist || 'Desconocido') === artistNorm
          );

          let targetId: number;

          if (existing) {
            await db.karaokes.update(existing.id!, {
              hasLocalAudio: true
            });
            targetId = existing.id!;
            Toast.fire({
              icon: 'success',
              title: 'MP3 añadido a la versión existente'
            });
          } else {
            targetId = await db.karaokes.add({
              name: formValues.title,
              artist: formValues.artist || 'Desconocido',
              hasLocalAudio: true,
              dateAdded: Date.now()
            }) as number;
            Toast.fire({
              icon: 'success',
              title: 'Archivo MP3 guardado'
            });
          }

          // Always save/overwrite the file data for this karaoke
          await db.karaokeFiles.put({
            karaokeId: targetId,
            data: new Uint8Array(arrayBuffer)
          });
          
          const targetKaraoke = await db.karaokes.get(targetId);
          if (targetKaraoke) {
            onPlayKaraoke(targetKaraoke);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    }
    
    // Resetear el input
    e.target.value = '';
  };

  const deleteKaraoke = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();

    const result = await MySwal.fire({
      title: '¿Eliminar karaoke?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5',
    });

    if (result.isConfirmed) {
      await db.karaokes.delete(id);
      await db.karaokeFiles.delete(id); // Delete associated file to free space
      if (activeKaraokeId === id) {
        // optionally handle stopping playback
      }
      const allPlaylists = await db.karaokePlaylists.toArray();
      for (const p of allPlaylists) {
        if (p.karaokeIds.includes(id)) {
          await db.karaokePlaylists.update(p.id!, {
            karaokeIds: p.karaokeIds.filter(kid => kid !== id)
          });
        }
      }

      Toast.fire({
        icon: 'success',
        title: 'Karaoke eliminado'
      });
    }
  };

  const filteredKaraokes = karaokes?.filter(k => {
    return k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (k.artist && k.artist.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const { visibleItems: displayedKaraokes, loadMoreRef, hasMore } = useInfiniteScroll({ items: filteredKaraokes, itemsPerPage: 20 });

  return (
    <div className="flex flex-col h-full w-full p-8">
      <Navbar
        title="Karaokes"
        subtitle="Tu colección de pistas"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      >
        <div className="flex gap-2 sm:gap-3 flex-wrap justify-end">
          <input
            type="file"
            accept="audio/mp3,audio/wav,audio/ogg"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all cursor-pointer font-bold text-xs sm:text-sm"
            title="Subir Archivo MP3"
          >
            <Upload size={16} className="hidden sm:block" /> <span className="hidden sm:inline">Subir MP3</span><span className="sm:hidden">MP3</span>
          </button>
          
          <button
            onClick={handleAddKaraoke}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all cursor-pointer font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(245,158,11,0.2)]"
            title="Añadir nuevo Karaoke de YouTube"
          >
            <Mic2 size={16} className="hidden sm:block" /> <span className="hidden sm:inline">Añadir de YouTube</span><span className="sm:hidden">YouTube</span>
          </button>
        </div>
      </Navbar>

      <div className="flex-1 overflow-y-auto hide-scrollbar pb-10 mt-6">
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-4 sm:p-6 min-h-[500px]">

          {/* HEADER DEL CONTENEDOR: Buscador */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-6">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                placeholder="Buscar karaoke o artista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
              />
            </div>
          </div>

          {karaokes?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-[450px] text-zinc-500 border-2 border-dashed border-white/5 rounded-2xl bg-zinc-900/20"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="bg-amber-500/10 w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(245,158,11,0.2)] border border-amber-500/30"
              >
                <Mic2 size={40} className="text-amber-500" />
              </motion.div>
              <p className="text-xl font-bold text-zinc-300 mb-2">Aún no hay karaokes</p>
              <p className="text-sm">Añade enlaces de YouTube o archivos locales.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {karaokes === undefined ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <SongSkeleton key={`skel-${i}`} />
                  ))
                ) : (
                  displayedKaraokes?.map((karaoke, index) => (
                    <KaraokeCard
                      key={karaoke.id}
                      karaoke={karaoke}
                      index={index}
                      isActive={activeKaraokeId === karaoke.id}
                      onPlay={() => onPlayKaraoke(karaoke)}
                      onDelete={(e) => deleteKaraoke(karaoke.id!, e)}
                    />
                  ))
                )}
              </AnimatePresence>

              {hasMore && (
                <div ref={loadMoreRef} className="col-span-full h-20 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin opacity-50"></div>
                </div>
              )}

              {filteredKaraokes?.length === 0 && searchQuery && (
                <div className="col-span-full py-12 text-center text-zinc-500">
                  No se encontraron resultados para "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
