import React, { useState, useEffect } from 'react';
import { Search, Play, Download, Loader2, Music, ChevronDown, ChevronUp, X } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../store/authStore';
import { db } from '../db';
import { useCoverArt } from '../hooks/useCoverArt';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Song } from '../db';
import { Navbar } from './Navbar';

export interface CatalogTab {
  id: string;
  artist: string;
  title: string;
  format: string;
}

interface SearchResponse {
  total: number;
  page: number;
  totalPages: number;
  tabs: CatalogTab[];
}

interface CatalogViewProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const formatName = (str: string) => {
  return str.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

interface CatalogItemActions {
  handlePlayDirectly: (tab: CatalogTab) => void;
  handleDownload: (tab: CatalogTab) => void;
}

const CatalogItem = ({ tab, handlePlayDirectly, handleDownload }: { tab: CatalogTab } & CatalogItemActions) => {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { rootMargin: '100px' });
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);

  const artist = formatName(tab.artist);
  const title = formatName(tab.title);

  // Lazy load cover only when in view
  const { coverUrl } = useCoverArt(inView ? artist : undefined, inView ? title : undefined);

  return (
    <div ref={setRef} className="bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/5 p-2.5 sm:p-4 rounded-xl flex flex-row items-center justify-between gap-2 sm:gap-4 transition-all group">
      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-zinc-800/80 shrink-0 overflow-hidden flex items-center justify-center border border-white/5 relative shadow-inner">
          {coverUrl ? (
            <img src={coverUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Music size={20} className="text-zinc-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold truncate text-sm sm:text-lg leading-tight mb-1">{title}</h3>
          <p className="text-zinc-400 truncate flex items-center gap-2 text-sm">
            {artist} <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800/80 rounded text-zinc-500 uppercase font-black tracking-wider">{tab.format}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={() => handlePlayDirectly(tab)}
          className="w-11 h-11 sm:w-auto sm:h-auto flex items-center justify-center gap-2 sm:px-4 sm:py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl sm:rounded-lg font-bold transition-all text-sm"
          title="Tocar sin guardar"
        >
          <Play size={16} fill="currentColor" />
          <span className="hidden sm:inline">Tocar</span>
        </button>
        <button
          onClick={() => handleDownload(tab)}
          className="w-11 h-11 sm:w-auto sm:h-auto flex items-center justify-center gap-2 sm:px-4 sm:py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 rounded-xl sm:rounded-lg font-bold transition-all"
          title="Añadir a Mi Biblioteca"
        >
          <Download size={16} />
        </button>
      </div>
    </div>
  );
};

const GroupedCatalogItem = ({ base, versions, handlePlayDirectly, handleDownload }: { base: CatalogTab, versions: CatalogTab[] } & CatalogItemActions) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-0.5 relative">
      <CatalogItem tab={base} handlePlayDirectly={handlePlayDirectly} handleDownload={handleDownload} />

      {versions.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 min-h-9 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 rounded-full font-bold border border-zinc-700 z-10 transition-all flex items-center gap-1 shadow-lg whitespace-nowrap"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {versions.length} {versions.length === 1 ? 'versión más' : 'versiones más'}
        </button>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden sm:pl-16 pr-2"
          >
            <div className="pt-5 pb-2 space-y-1.5">
              {versions.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-zinc-900/50 p-2.5 px-4 rounded-xl border border-white/5 hover:bg-zinc-800/80 transition-colors group">
                  <span className="text-zinc-400 text-sm font-medium flex items-center gap-3">
                    <span className="text-[9px] px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded uppercase font-black tracking-wider">{v.format}</span>
                    <span className="truncate">{formatName(v.title)}</span>
                  </span>
                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handlePlayDirectly(v)} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-primary-400 hover:bg-white/5 transition-all rounded-lg" title="Tocar"><Play size={16} fill="currentColor" /></button>
                    <button onClick={() => handleDownload(v)} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-all rounded-lg" title="Descargar"><Download size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const CatalogView: React.FC<CatalogViewProps> = ({ isSidebarOpen, onToggleSidebar }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tabs, setTabs] = useState<CatalogTab[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalResults, setTotalResults] = useState(0);

  const token = useAuthStore(state => state.token);

  const navigate = useNavigate();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== debouncedQuery) {
        setDebouncedQuery(query);
        setPage(1); // Reset page on new search
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, debouncedQuery]);

  const fetchResults = async (searchQuery: string, pageNum: number) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/catalog/search?q=${encodeURIComponent(searchQuery)}&page=${pageNum}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al buscar en el catálogo');

      const data: SearchResponse = await res.json();

      setTabs(prev => pageNum === 1 ? data.tabs : [...prev, ...data.tabs]);
      setHasMore(data.page < data.totalPages);
      setTotalResults(data.total);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo conectar con el catálogo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The request updates loading and result state as part of this external synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchResults(debouncedQuery, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, page, token]);

  const handleDownload = async (tab: CatalogTab) => {
    try {
      Swal.fire({
        title: 'Descargando tablatura...',
        text: 'Por favor espera',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const res = await fetch(`${API_BASE_URL}/api/catalog/${tab.id}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Error al descargar el archivo');
      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();

      const titleNorm = formatName(tab.title).toLowerCase();
      const artistNorm = formatName(tab.artist).toLowerCase();

      const existingSongs = await db.songs.toArray();
      const existing = existingSongs.find(s => 
        s.name.toLowerCase() === titleNorm && 
        (s.artist || '').toLowerCase() === artistNorm
      );

      let id: number;

      if (existing) {
        // Combinar con la canción existente
        await db.songs.update(existing.id!, {
          type: 'gp',
          data: new Uint8Array(buffer),
          catalogSourceId: tab.id,
          updatedAt: Date.now()
        });
        id = existing.id!;
      } else {
        // Crear nueva canción
        const newSong = {
          userId: useAuthStore.getState().user?.id || 'unknown',
          name: formatName(tab.title),
          artist: formatName(tab.artist),
          type: 'gp' as const,
          data: new Uint8Array(buffer),
          dateAdded: Date.now(),
          updatedAt: Date.now(),
          isPublic: false,
          catalogSourceId: tab.id
        };
        id = await db.songs.add(newSong as Song) as number;
      }
      
      Swal.close();

      Swal.fire({
        title: '¡Añadida a tu Biblioteca!',
        text: `${formatName(tab.artist)} - ${formatName(tab.title)} ha sido guardada en tu biblioteca.`,
        icon: 'success',
        confirmButtonText: 'Ir al Reproductor',
        showCancelButton: true,
        cancelButtonText: 'Seguir Buscando'
      }).then((result) => {
        if (result.isConfirmed) {
          navigate(`/song/${id}`);
        }
      });

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo descargar la tablatura.', 'error');
    }
  };

  const handlePlayDirectly = async (tab: CatalogTab) => {
    // Abrir en el reproductor SIN guardar en la biblioteca (isTemporary: true)
    try {
      Swal.fire({
        title: 'Abriendo tablatura...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await fetch(`${API_BASE_URL}/api/catalog/${tab.id}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Error al abrir el archivo');
      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();

      // Guardar TEMPORALMENTE - isTemporary: true - no aparece en la biblioteca
      // catalogSourceId para poder descargarlo permanentemente desde el reproductor
      const newSong = {
        userId: useAuthStore.getState().user?.id || 'unknown',
        name: formatName(tab.title),
        artist: formatName(tab.artist),
        type: 'gp' as const,
        data: new Uint8Array(buffer),
        dateAdded: Date.now(),
        updatedAt: Date.now(),
        isPublic: false,
        isTemporary: true,
        catalogSourceId: tab.id
      };

      const id = await db.songs.add(newSong as Song);
      Swal.close();
      navigate(`/song/${id}`);

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo abrir la tablatura.', 'error');
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950 px-3 py-2 sm:p-4 lg:p-6">
      <Navbar
        title="Catálogo"
        subtitle="Miles de tablaturas listas para tocar"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="flex-1 min-h-0 mt-3 sm:mt-5 rounded-2xl sm:rounded-3xl border border-white/5 bg-zinc-900/30 p-3 sm:p-6 flex flex-col overflow-hidden">
        <div className="relative mb-4 sm:mb-5 shrink-0">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500">
            <Search size={20} />
          </div>
          <input
            type="search"
            aria-label="Buscar en el catálogo"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar artista o canción"
            className="w-full min-h-12 bg-zinc-950/60 border border-white/10 rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-12 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all text-base sm:text-lg shadow-inner"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute inset-y-0 right-1 w-11 flex items-center justify-center text-zinc-500 hover:text-white" aria-label="Limpiar búsqueda">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex justify-between items-center mb-3 sm:mb-4 shrink-0">
          <h2 className="text-sm sm:text-lg font-bold text-white flex items-center gap-2">
            <Music size={18} className="text-primary-400" />
            Resultados {totalResults > 0 && <span className="text-zinc-500 text-xs sm:text-sm font-normal">({totalResults})</span>}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 sm:pr-2 custom-scrollbar space-y-4 pb-3 sm:pb-6">
        {Object.values(tabs.reduce((acc, tab) => {
          // Extraemos el título base (removiendo números y "version" al final)
          const baseTitle = tab.title.replace(/[\s_]*(v\d+|version\s*\d+|\d+)$/i, '').trim();
          const key = `${tab.artist}-${baseTitle}`;
          if (!acc[key]) acc[key] = { base: tab, versions: [] };
          else acc[key].versions.push(tab);
          return acc;
        }, {} as Record<string, { base: CatalogTab, versions: CatalogTab[] }>)).map(({ base, versions }) => (
          <GroupedCatalogItem
            key={base.id}
            base={base}
            versions={versions}
            handlePlayDirectly={handlePlayDirectly}
            handleDownload={handleDownload}
          />
        ))}

        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-primary-500">
            <Loader2 className="animate-spin w-8 h-8" />
            <span className="text-sm text-zinc-500">Buscando tablaturas...</span>
          </div>
        )}

        {!loading && tabs.length === 0 && debouncedQuery !== '' && (
          <div className="py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl">
            <Search size={48} className="text-zinc-700 mb-4" />
            <h3 className="text-lg sm:text-xl font-bold text-zinc-400 mb-2">Sin resultados</h3>
            <p className="text-sm text-zinc-500 max-w-sm px-4">No encontramos ninguna tablatura que coincida con "{debouncedQuery}". Intenta con otra búsqueda.</p>
            <button onClick={() => setQuery('')} className="mt-4 min-h-11 px-4 rounded-xl bg-zinc-800 text-white font-bold text-sm">Limpiar búsqueda</button>
          </div>
        )}

        {!loading && tabs.length === 0 && debouncedQuery === '' && (
          <div className="py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl bg-zinc-900/30">
            <Search size={48} className="text-zinc-700 mb-4" />
            <h3 className="text-xl font-bold text-zinc-500 mb-2">Busca en el catálogo</h3>
            <p className="text-zinc-600 max-w-sm">Escribe el nombre de un artista o canción para empezar a explorar nuestra base de datos gigante.</p>
          </div>
        )}

          {hasMore && tabs.length > 0 && !loading && (
          <div className="pt-4 pb-8 flex justify-center">
            <button
              onClick={() => setPage(p => p + 1)}
              className="min-h-11 w-full sm:w-auto px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl sm:rounded-full font-bold transition-colors text-sm"
            >
              Cargar más resultados
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
