import { Search, Mic2, Plus, FileSpreadsheet, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KaraokeCard } from './KaraokeCard';
import { CreateKaraokeModal } from './CreateKaraokeModal';
import { AddKaraokeOptionsModal } from './AddKaraokeOptionsModal';
import { EditMetadataModal } from '../EditMetadataModal';
import { SongSkeleton } from '../SongSkeleton';
import { db } from '../../db';
import type { Karaoke } from '../../db';
import { lazy, Suspense, useState } from 'react';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { Navbar } from '../Navbar';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Toast } from '../../utils/toast';
import { usePlayerStore } from '../../store/playerStore';

const MySwal = withReactContent(Swal);
const getCurrentTimestamp = () => Date.now();
const BulkImportKaraokeModal = lazy(() =>
  import('./BulkImportKaraokeModal').then((module) => ({ default: module.BulkImportKaraokeModal }))
);

interface KaraokeLibraryViewProps {
  karaokes: Karaoke[] | undefined;
  activeKaraokeId: number | null;
  onPlayKaraoke: (karaoke: Karaoke) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const KaraokeLibraryView = ({ karaokes, activeKaraokeId, onPlayKaraoke, isSidebarOpen, onToggleSidebar }: KaraokeLibraryViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddOptionsModalOpen, setIsAddOptionsModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingKaraoke, setEditingKaraoke] = useState<Karaoke | null>(null);

  // Helper function to normalize strings for comparison
  const normalizeString = (str: string) => {
    return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };
  
  const handleAddKaraoke = () => {
    setIsCreateModalOpen(true);
  };

  const onKaraokeCreated = async (formValues: { title: string; artist: string; url: string; cloudUrl?: string; textContent?: string; audioDownloadFailed?: boolean }) => {
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
        youtubeUrl: formValues.url || undefined,
        cloudUrl: formValues.cloudUrl || undefined,
        hasLocalAudio: !!formValues.cloudUrl || existing.hasLocalAudio,
        ...(formValues.textContent ? { textContent: formValues.textContent } : {})
      });
      targetId = existing.id!;
      Toast.fire({
        icon: formValues.audioDownloadFailed ? 'warning' : 'success',
        title: formValues.audioDownloadFailed ? 'Guardado con YouTube · audio local no disponible' : 'Añadido a la versión existente'
      });
    } else {
      targetId = await db.karaokes.add({
        name: formValues.title,
        artist: formValues.artist || 'Desconocido',
        youtubeUrl: formValues.url || undefined,
        cloudUrl: formValues.cloudUrl || undefined,
        hasLocalAudio: !!formValues.cloudUrl,
        localFileDirty: false,
        dateAdded: Date.now(),
        ...(formValues.textContent ? { textContent: formValues.textContent } : {})
      }) as number;
      
      Toast.fire({
        icon: formValues.audioDownloadFailed ? 'warning' : 'success',
        title: formValues.audioDownloadFailed ? 'Guardado con YouTube · audio local no disponible' : 'Karaoke añadido con éxito'
      });
    }
    
    const targetKaraoke = await db.karaokes.get(targetId);
    if (targetKaraoke) {
      onPlayKaraoke(targetKaraoke);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Pedir artista y confirmar título (usamos el nombre del archivo sin extensión como default)
    const defaultTitle = file.name.replace(/\.[^/.]+$/, "");

    const { value: formValues } = await MySwal.fire({
      title: 'Detalles del Archivo',
      html: `
        <div class="flex flex-col gap-4 text-left">
          <div>
            <label for="swal-file-title" class="text-zinc-400 text-sm font-bold mb-1 block">Título</label>
            <input id="swal-file-title" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:outline-none" placeholder="Ej: Bohemian Rhapsody">
          </div>
          <div>
            <label for="swal-file-artist" class="text-zinc-400 text-sm font-bold mb-1 block">Artista</label>
            <input id="swal-file-artist" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary-500 focus:outline-none" placeholder="Ej: Queen">
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
      didOpen: () => {
        const titleInput = Swal.getPopup()?.querySelector<HTMLInputElement>('#swal-file-title');
        if (titleInput) titleInput.value = defaultTitle;
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        const title = popup?.querySelector<HTMLInputElement>('#swal-file-title')?.value.trim() || '';
        const artist = popup?.querySelector<HTMLInputElement>('#swal-file-artist')?.value.trim() || '';
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
              hasLocalAudio: true,
              localFileDirty: true,
              updatedAt: Date.now(),
              ...(formValues.textContent ? { textContent: formValues.textContent } : {})
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
              localFileDirty: true,
              dateAdded: Date.now(),
              updatedAt: Date.now(),
              ...(formValues.textContent ? { textContent: formValues.textContent } : {})
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
  };

  const deleteKaraoke = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();

    const result = await MySwal.fire({
      title: '¿Eliminar karaoke?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary-500)',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5',
    });

    if (result.isConfirmed) {
      try {
        await db.transaction('rw', [db.karaokes, db.karaokeFiles, db.karaokePlaylists], async () => {
          await db.karaokes.delete(id);
          await db.karaokeFiles.delete(id);
          const allPlaylists = await db.karaokePlaylists.toArray();
          for (const playlist of allPlaylists) {
            if (playlist.karaokeIds.includes(id)) {
              await db.karaokePlaylists.update(playlist.id!, {
                karaokeIds: playlist.karaokeIds.filter(karaokeId => karaokeId !== id)
              });
            }
          }
        });

        if (activeKaraokeId === id) {
          usePlayerStore.getState().setActiveKaraokeId(null);
          usePlayerStore.getState().setIsKaraokeMiniPlayer(false);
        }

        Toast.fire({
          icon: 'success',
          title: 'Karaoke eliminado'
        });
      } catch (error) {
        console.error('Error deleting karaoke', error);
        Toast.fire({
          icon: 'error',
          title: 'No se pudo eliminar el karaoke'
        });
      }
    }
  };

  const handleTogglePublic = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const karaoke = await db.karaokes.get(id);
    if (!karaoke) return;
    
    await db.karaokes.update(id, { 
      isPublic: !karaoke.isPublic,
      updatedAt: getCurrentTimestamp()
    });
    
    const { SyncService } = await import('../../services/syncService');
    SyncService.scheduleAutoSync();
    
    Toast.fire({
      icon: 'success',
      title: !karaoke.isPublic ? 'Karaoke hecho público 🌐' : 'Karaoke ahora es privado 🔒',
    });
  };

  const handleEditMetadata = async (karaoke: Karaoke, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingKaraoke(karaoke);
  };

  const handleSaveMetadata = async (newTitle: string, newArtist: string) => {
    if (!editingKaraoke) return;

      if (!newTitle) {
        Toast.fire({ icon: 'error', title: 'El título es obligatorio' });
        return;
      }

      await db.karaokes.update(editingKaraoke.id!, {
        name: newTitle,
        artist: newArtist,
        updatedAt: Date.now()
      });

      const { SyncService } = await import('../../services/syncService');
      SyncService.scheduleAutoSync();

      Toast.fire({
        icon: 'success',
        title: 'Metadatos guardados'
      });
    setEditingKaraoke(null);
  };

  const filteredKaraokes = karaokes?.filter(k => {
    return k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (k.artist && k.artist.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const { visibleItems: displayedKaraokes, loadMoreRef, hasMore } = useInfiniteScroll({ items: filteredKaraokes, itemsPerPage: 20 });

  return (
    <div className="flex h-full w-full flex-col px-3 py-2 sm:p-4 lg:p-6">
      <Navbar
        title="Karaokes"
        subtitle="Tu colección de pistas"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      >
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-emerald-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all font-bold text-sm"
            title="Importar desde Excel"
          >
            <FileSpreadsheet size={18} />
            <span className="hidden sm:inline">Importar Excel</span>
          </button>
          <button
            onClick={() => setIsAddOptionsModalOpen(true)}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-zinc-950 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl transition-all font-bold text-sm shadow-[0_0_20px_var(--theme-glow)]"
            title="Añadir nuevo karaoke"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Añadir Karaoke</span>
          </button>
        </div>
      </Navbar>

      <div className="flex-1 overflow-y-auto hide-scrollbar pb-6 mt-3 sm:mt-5">

        <div className="min-h-full rounded-2xl border border-white/5 bg-zinc-900/30 p-3 sm:rounded-3xl sm:p-6">

          {/* HEADER DEL CONTENEDOR: Buscador */}
          <div className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-6">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input
                type="text"
                aria-label="Buscar karaokes en la biblioteca"
                placeholder="Buscar karaoke o artista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-200 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
              />
            </div>
          </div>

          {karaokes?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex min-h-80 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/5 bg-zinc-900/20 px-5 text-center text-zinc-500 sm:min-h-[450px]"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="bg-primary-500/10 w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_var(--theme-glow)] border border-primary-500/30"
              >
                <Mic2 size={40} className="text-primary-500" />
              </motion.div>
              <p className="text-xl font-bold text-zinc-300 mb-2">Aún no hay karaokes</p>
              <p className="text-sm">Añade enlaces de YouTube o archivos locales.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
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
                      onTogglePublic={(e) => handleTogglePublic(karaoke.id!, e)}
                      onEditMetadata={(e) => handleEditMetadata(karaoke, e)}
                    />
                  ))
                )}
              </AnimatePresence>

              {hasMore && (
                <div ref={loadMoreRef} className="col-span-full h-20 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin opacity-50"></div>
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
      <CreateKaraokeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={onKaraokeCreated}
      />
      <AddKaraokeOptionsModal
        isOpen={isAddOptionsModalOpen}
        onClose={() => setIsAddOptionsModalOpen(false)}
        onCreateNew={handleAddKaraoke}
        onUpload={handleFileUpload}
      />
      <EditMetadataModal
        isOpen={!!editingKaraoke}
        onClose={() => setEditingKaraoke(null)}
        initialTitle={editingKaraoke?.name || ''}
        initialArtist={editingKaraoke?.artist || ''}
        onSave={handleSaveMetadata}
      />
      {isBulkImportOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="status" aria-label="Cargando importador">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        }>
          <BulkImportKaraokeModal
            isOpen
            onClose={() => setIsBulkImportOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};
