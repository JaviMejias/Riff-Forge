import { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { SongCard } from './SongCard';
import { KaraokeCard } from './karaoke/KaraokeCard';
import { Users, Loader2, Download, Music, Mic2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { db } from '../db';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Toast } from '../utils/toast';

const MySwal = withReactContent(Swal);
const API_URL = 'http://146.181.32.238:3001/api';

interface CommunityViewProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const CommunityView = ({ isSidebarOpen, onToggleSidebar }: CommunityViewProps) => {
  const [activeTab, setActiveTab] = useState<'songs' | 'karaokes'>('songs');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/community/${activeTab}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error fetching community items');
      const data = await res.json();
      setItems(data);
    } catch (error) {
      console.error(error);
      Toast.fire({ icon: 'error', title: 'Error al cargar la comunidad' });
    } finally {
      setLoading(false);
    }
  };

  const cloneSong = async (item: any) => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && item.userId === currentUser.id) {
      Toast.fire({ icon: 'info', title: 'Este aporte es tuyo', text: 'Ya tienes este elemento en tu biblioteca.' });
      return;
    }

    const confirm = await MySwal.fire({
      title: `¿Clonar "${item.name}"?`,
      text: `Se añadirá a tu biblioteca personal.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary-500)',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Sí, clonar',
      cancelButtonText: 'Cancelar',
      background: '#18181b',
      color: '#f4f4f5'
    });

    if (confirm.isConfirmed) {
      try {
        if (activeTab === 'songs') {
          // Clone Song
          let fileData = undefined;
          // If song is GP, we need to download it
          if (item.cloudUrl) {
            const res = await fetch(`http://146.181.32.238:3001${item.cloudUrl}`);
            const blob = await res.blob();
            const arrayBuffer = await blob.arrayBuffer();
            fileData = new Uint8Array(arrayBuffer);
          }

          await db.songs.add({
            name: item.name,
            artist: item.artist,
            album: item.album,
            type: item.type,
            textContent: item.textContent,
            originalKey: item.originalKey,
            tuning: item.tuning,
            strummingPattern: item.strummingPattern,
            capo: item.capo,
            data: fileData,
            dateAdded: Date.now(),
            isPublic: false
          });
        } else {
          // Clone Karaoke
          const targetId = await db.karaokes.add({
            name: item.name,
            artist: item.artist,
            youtubeUrl: item.youtubeUrl,
            cloudUrl: item.cloudUrl,
            hasLocalAudio: item.hasLocalAudio,
            pitchShift: item.pitchShift,
            textContent: item.textContent,
            dateAdded: Date.now(),
            isPublic: false
          }) as number;

          if (item.cloudUrl) {
            // Need to download the mp3 if exists
            const res = await fetch(`http://146.181.32.238:3001${item.cloudUrl}`);
            if (res.ok) {
                const blob = await res.blob();
                const arrayBuffer = await blob.arrayBuffer();
                await db.karaokeFiles.put({
                    karaokeId: targetId,
                    data: new Uint8Array(arrayBuffer)
                });
            }
          }
        }
        Toast.fire({ icon: 'success', title: 'Añadido a tu biblioteca' });
      } catch (error) {
        console.error(error);
        Toast.fire({ icon: 'error', title: 'Error al clonar' });
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full p-8">
      <Navbar
        title="Comunidad"
        subtitle="Explora y clona contenido de otros usuarios"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      >
        <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-white/5 shadow-inner">
          <button
            onClick={() => setActiveTab('songs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${
              activeTab === 'songs' 
                ? 'bg-primary-500 text-zinc-950 shadow-lg' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Music size={16} /> Canciones
          </button>
          <button
            onClick={() => setActiveTab('karaokes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${
              activeTab === 'karaokes' 
                ? 'bg-primary-500 text-zinc-950 shadow-lg' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Mic2 size={16} /> Karaokes
          </button>
        </div>
      </Navbar>

      <div className="flex-1 overflow-y-auto hide-scrollbar pb-10 mt-6">
        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-4 sm:p-6 min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-zinc-500">
              <Loader2 className="animate-spin w-10 h-10 mb-4 text-primary-500" />
              <p>Cargando comunidad...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-zinc-500 border-2 border-dashed border-white/5 rounded-2xl bg-zinc-900/20">
              <Users size={40} className="mb-4 text-zinc-600" />
              <p className="text-xl font-bold text-zinc-400">No hay contenido público</p>
              <p className="text-sm">Sé el primero en compartir algo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {items.map((item, index) => (
                  <div key={item.id} className="relative group">
                    {activeTab === 'songs' ? (
                      <SongCard
                        song={item}
                        isActive={false}
                        index={index}
                        onPlay={() => cloneSong(item)}
                      />
                    ) : (
                      <KaraokeCard
                        karaoke={item}
                        isActive={false}
                        index={index}
                        onPlay={() => cloneSong(item)}
                        onDelete={() => {}}
                      />
                    )}
                    {/* Contribuidor */}
                    <div className="absolute -top-3 -left-3 z-30 bg-zinc-800 border border-primary-500/30 text-primary-400 text-xs px-2 py-1 rounded-lg shadow-xl shadow-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      Subido por {item.user?.name || 'Usuario'}
                    </div>
                    {/* Icono Descargar overlay */}
                    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black/50 absolute inset-0 rounded-2xl"></div>
                      <div className="flex flex-col items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-all">
                        {useAuthStore.getState().user?.id === item.userId ? (
                          <>
                            <div className="text-primary-400 mb-2 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]">🌐</div>
                            <span className="text-white font-bold tracking-widest uppercase text-xs text-center px-2">Tu Aporte<br/>Público</span>
                          </>
                        ) : (
                          <>
                            <Download size={32} className="text-primary-400 mb-2 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                            <span className="text-white font-bold tracking-widest uppercase text-xs text-center px-2">Clonar a<br/>Biblioteca</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
