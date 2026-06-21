import React, { useState, useEffect } from 'react';
import { Search, Play, Download, Loader2, Globe, Music } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../store/authStore';
import { db } from '../db';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

interface CatalogTab {
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

export const CatalogView: React.FC = () => {
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
      Swal.fire('Error', 'No se pudo conectar con el catálogo mundial.', 'error');
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

      // Añadir a nuestra DB
      const newSong = {
        userId: useAuthStore.getState().user?.id || 'unknown',
        name: tab.title,
        artist: tab.artist,
        type: 'gp' as const,
        data: buffer,
        dateAdded: Date.now(),
        updatedAt: Date.now(),
        isPublic: false
      };

      const id = await db.songs.add(newSong as any);
      Swal.close();
      
      Swal.fire({
        title: '¡Añadida a tu Biblioteca!',
        text: `${tab.artist} - ${tab.title} ha sido descargada exitosamente.`,
        icon: 'success',
        confirmButtonText: 'Ir al Reproductor',
        showCancelButton: true,
        cancelButtonText: 'Seguir Buscando'
      }).then((result) => {
        if (result.isConfirmed) {
          navigate(`/player/${id}`);
        }
      });

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo descargar la tablatura.', 'error');
    }
  };

  const handlePlayDirectly = async (tab: CatalogTab) => {
     // Descargar temporalmente y navegar
     try {
        Swal.fire({
          title: 'Abriendo tablatura...',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });
  
        const res = await fetch(`${API_BASE_URL}/api/catalog/${tab.id}/download`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
  
        if (!res.ok) throw new Error('Error al descargar el archivo');
        const blob = await res.blob();
        const buffer = await blob.arrayBuffer();
  
        // Guardar temporalmente en indexedDB (con un flag o solo lo agregamos normal y se queda en su lib)
        // Para que no se pierda, mejor lo agregamos a su library y lo abrimos.
        const newSong = {
          userId: useAuthStore.getState().user?.id || 'unknown',
          name: tab.title,
          artist: tab.artist,
          type: 'gp' as const,
          data: buffer,
          dateAdded: Date.now(),
          updatedAt: Date.now(),
          isPublic: false
        };
  
        const id = await db.songs.add(newSong as any);
        Swal.close();
        navigate(`/player/${id}`);
  
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudo abrir la tablatura.', 'error');
      }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-6 sm:p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
          <Globe size={28} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Catálogo Mundial</h1>
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

      <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar space-y-3">
        {tabs.map((tab) => (
          <div key={tab.id} className="bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/5 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all group">
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold truncate text-lg">{tab.title}</h3>
              <p className="text-zinc-400 truncate flex items-center gap-2">
                {tab.artist} <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-500 uppercase">{tab.format}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={() => handlePlayDirectly(tab)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-all"
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
