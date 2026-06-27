import React, { useState, useEffect } from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullIndicator } from './PullIndicator';
import { Search, Play, Download, Loader2, Music, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../store/authStore';
import { db } from '../db';
import { useCoverArt } from '../hooks/useCoverArt';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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

const formatName = (str: string) => {
  return str.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const CatalogItem = ({ tab, handlePlayDirectly, handleDownload }: { tab: CatalogTab, handlePlayDirectly: any, handleDownload: any }) => {
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
    <div ref={setRef} className="bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/5 p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all group">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-zinc-800/80 shrink-0 overflow-hidden flex items-center justify-center border border-white/5 relative shadow-inner">
          {coverUrl ? (
            <img src={coverUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Music size={20} className="text-zinc-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold truncate text-lg leading-tight mb-1">{title}</h3>
          <p className="text-zinc-400 truncate flex items-center gap-2 text-sm">
            {artist} <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800/80 rounded text-zinc-500 uppercase font-black tracking-wider">{tab.format}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => handlePlayDirectly(tab)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold transition-all text-sm"
        >
          <Play size={16} fill="currentColor" />
          <span className="hidden sm:inline">Tocar</span>
        </button>
        <button
          onClick={() => handleDownload(tab)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10 rounded-lg font-bold transition-all"
          title="Añadir a Mi Biblioteca"
        >
          <Download size={16} />
        </button>
      </div>
    </div>
  );
};

const GroupedCatalogItem = ({ base, versions, handlePlayDirectly, handleDownload }: { base: CatalogTab, versions: CatalogTab[], handlePlayDirectly: any, handleDownload: any }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-0.5 relative">
      <CatalogItem tab={base} handlePlayDirectly={handlePlayDirectly} handleDownload={handleDownload} />

      {versions.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 rounded-full font-bold border border-zinc-700 z-10 transition-all flex items-center gap-1 shadow-lg"
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
            <div className="pt-3 pb-2 space-y-1.5">
              {versions.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-zinc-900/50 p-2.5 px-4 rounded-xl border border-white/5 hover:bg-zinc-800/80 transition-colors group">
                  <span className="text-zinc-400 text-sm font-medium flex items-center gap-3">
                    <span className="text-[9px] px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded uppercase font-black tracking-wider">{v.format}</span>
                    <span className="truncate">{formatName(v.title)}</span>
                  </span>
                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handlePlayDirectly(v)} className="p-2 text-zinc-400 hover:text-primary-400 hover:bg-white/5 transition-all rounded-lg" title="Tocar"><Play size={16} fill="currentColor" /></button>
                    <button onClick={() => handleDownload(v)} className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 transition-all rounded-lg" title="Descargar"><Download size={16} /></button>
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

export const CatalogView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tabs, setTabs] = useState<CatalogTab[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalResults, setTotalResults] = useState(0);

  const token = useAuthStore(state => state.token);

  const { containerRef: pullRef, pullProgress, isRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      const { SyncService } = await import('../services/syncService');
      await SyncService.performAutoSync();
    },
  });
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
        id = await db.songs.add(newSong as any) as number;
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

      const id = await db.songs.add(newSong as any);
      Swal.close();
      navigate(`/song/${id}`);

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo abrir la tablatura.', 'error');
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 sm:p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-primary-500/10 text-primary-400 rounded-xl">
          <Globe size={28} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Catálogo</h1>
          <p className="text-zinc-400 text-sm mt-1">Busca entre decenas de miles de tablaturas al instante.</p>
        </div>
      </div>

      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500">
          <Search size={20} />
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por artista o canción... (ej. Metallica, Stairway to Heaven)"
          className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-lg shadow-inner"
        />
      </div>

      <div className="flex justify-between items-end mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Music size={18} className="text-indigo-400" />
          Resultados {totalResults > 0 && <span className="text-zinc-500 text-sm font-normal">({totalResults} encontradas)</span>}
        </h2>
      </div>

      <div ref={pullRef} className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar space-y-4 pb-12">
        <PullIndicator pullProgress={pullProgress} isRefreshing={isRefreshing} />
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
          <div className="py-12 flex justify-center text-indigo-500">
            <Loader2 className="animate-spin w-8 h-8" />
          </div>
        )}

        {!loading && tabs.length === 0 && debouncedQuery !== '' && (
          <div className="py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl">
            <Search size={48} className="text-zinc-700 mb-4" />
            <h3 className="text-xl font-bold text-zinc-500 mb-2">Sin resultados</h3>
            <p className="text-zinc-600 max-w-sm">No encontramos ninguna tablatura que coincida con "{debouncedQuery}". Intenta con otra búsqueda.</p>
          </div>
        )}

        {!loading && tabs.length === 0 && debouncedQuery === '' && (
          <div className="py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl bg-zinc-900/30">
            <Globe size={48} className="text-zinc-800 mb-4" />
            <h3 className="text-xl font-bold text-zinc-500 mb-2">Busca en el catálogo</h3>
            <p className="text-zinc-600 max-w-sm">Escribe el nombre de un artista o canción para empezar a explorar nuestra base de datos gigante.</p>
          </div>
        )}

        {hasMore && tabs.length > 0 && !loading && (
          <div className="pt-4 pb-8 flex justify-center">
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-bold transition-colors text-sm"
            >
              Cargar más resultados
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
