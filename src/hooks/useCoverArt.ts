import { useState, useEffect, useMemo } from 'react';

// Caché persistente usando localStorage
const CACHE_KEY = 'riff_forge_cover_cache';
const MAX_CACHE_SIZE = 200;

let coverCache = new Map<string, string | null>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
try {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    coverCache = new Map(Object.entries(parsed));
  }
} catch (error) {
  console.warn('Could not load cover cache', error);
}

const persistCache = () => {
  try {
    const obj = Object.fromEntries(coverCache.entries());
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore quota errors
  }
};

const addToCache = (key: string, value: string | null) => {
  if (coverCache.size >= MAX_CACHE_SIZE) {
    const firstKey = coverCache.keys().next().value;
    if (firstKey) coverCache.delete(firstKey);
  }
  coverCache.set(key, value);
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistCache, 1000);
};

interface CoverSearchResponse {
  results?: Array<{
    artworkUrl100?: string;
    artistLinkUrl?: string;
  }>;
}

interface CoverRequestState {
  query: string;
  coverUrl: string | null;
  isLoading: boolean;
}

export const useCoverArt = (artist?: string, title?: string) => {
  const query = useMemo(() => {
    if (!artist || !title) return '';
    const cleanTitle = title.replace(/\(.*\)|\[.*\]|karaoke|instrumental|cover|version|pista/gi, '').trim();
    const cleanArtist = artist.replace(/\(.*\)|\[.*\]/g, '').trim();
    return `${cleanArtist} ${cleanTitle}`.toLowerCase().trim();
  }, [artist, title]);

  const [requestState, setRequestState] = useState<CoverRequestState>({
    query: '',
    coverUrl: null,
    isLoading: false
  });

  useEffect(() => {
    if (!query || coverCache.has(query)) return;

    const abortController = new AbortController(); // M-6 fix
    const signal = abortController.signal;

    const fetchCover = async () => {
      try {
        // Usar la API de iTunes (es gratis, no requiere API key y es muy rápida)
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`, { signal });
        if (!response.ok) throw new Error(`Cover search failed (${response.status})`);
        const data = await response.json() as CoverSearchResponse;

        const artworkUrl = data.results?.[0]?.artworkUrl100;
        if (artworkUrl) {
          // La API devuelve artworkUrl100 (100x100), pero podemos pedir una versión de mayor resolución (600x600)
          const highResUrl = artworkUrl.replace('100x100bb', '600x600bb');
          addToCache(query, highResUrl);
          setRequestState({ query, coverUrl: highResUrl, isLoading: false });
        } else {
          // Si no encuentra nada, probar solo con el artista para tener al menos una foto del artista
          const fallbackResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist || '')}&entity=musicArtist&limit=1`, { signal });
          const fallbackData = await fallbackResponse.json() as CoverSearchResponse;
          
          if (fallbackData.results && fallbackData.results.length > 0 && fallbackData.results[0].artistLinkUrl) {
              // iTunes no siempre da fotos de artistas fácilmente por esta API sin buscar álbumes.
              // Intentemos buscar un álbum cualquiera del artista
              const albumResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist || '')}&entity=album&limit=1`, { signal });
              const albumData = await albumResponse.json() as CoverSearchResponse;
              const albumArtworkUrl = albumData.results?.[0]?.artworkUrl100;
              if (albumArtworkUrl) {
                 const albumUrl = albumArtworkUrl.replace('100x100bb', '600x600bb');
                 addToCache(query, albumUrl);
                 setRequestState({ query, coverUrl: albumUrl, isLoading: false });
                 return;
              }
          }
          
          addToCache(query, null);
          setRequestState({ query, coverUrl: null, isLoading: false });
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.warn("Failed to fetch cover art", error);
        setRequestState({ query, coverUrl: null, isLoading: false });
      }
    };

    fetchCover();

    return () => abortController.abort(); // M-6 fix: cleanup on unmount or deps change
  }, [artist, query]);

  if (!query) return { coverUrl: null, isLoading: false };
  if (coverCache.has(query)) return { coverUrl: coverCache.get(query) || null, isLoading: false };
  if (requestState.query === query) return requestState;
  return { coverUrl: null, isLoading: true };
};
