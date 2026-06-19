import { useState, useEffect } from 'react';

// Caché en memoria para evitar llamadas repetidas a la API durante la misma sesión
const coverCache = new Map<string, string | null>();
const MAX_CACHE_SIZE = 100; // L-6 fix: limit cache size

const addToCache = (key: string, value: string | null) => {
  if (coverCache.size >= MAX_CACHE_SIZE) {
    const firstKey = coverCache.keys().next().value;
    if (firstKey) coverCache.delete(firstKey);
  }
  coverCache.set(key, value);
};

export const useCoverArt = (artist?: string, title?: string) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!artist || !title) {
      setCoverUrl(null);
      return;
    }

    // Limpiar palabras comunes de karaoke que arruinan la búsqueda en iTunes
    const cleanTitle = title.replace(/\(.*\)|\[.*\]|karaoke|instrumental|cover|version|pista/gi, '').trim();
    const cleanArtist = artist.replace(/\(.*\)|\[.*\]/g, '').trim();
    const query = `${cleanArtist} ${cleanTitle}`.toLowerCase().trim();
    
    // Revisar caché
    if (coverCache.has(query)) {
      setCoverUrl(coverCache.get(query) || null);
      return;
    }

    const abortController = new AbortController(); // M-6 fix
    const signal = abortController.signal;

    const fetchCover = async () => {
      setIsLoading(true);
      try {
        // Usar la API de iTunes (es gratis, no requiere API key y es muy rápida)
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`, { signal });
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          // La API devuelve artworkUrl100 (100x100), pero podemos pedir una versión de mayor resolución (600x600)
          const highResUrl = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
          addToCache(query, highResUrl);
          setCoverUrl(highResUrl);
        } else {
          // Si no encuentra nada, probar solo con el artista para tener al menos una foto del artista
          const fallbackResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=musicArtist&limit=1`, { signal });
          const fallbackData = await fallbackResponse.json();
          
          if (fallbackData.results && fallbackData.results.length > 0 && fallbackData.results[0].artistLinkUrl) {
              // iTunes no siempre da fotos de artistas fácilmente por esta API sin buscar álbumes.
              // Intentemos buscar un álbum cualquiera del artista
              const albumResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=album&limit=1`, { signal });
              const albumData = await albumResponse.json();
              if (albumData.results && albumData.results.length > 0) {
                 const albumUrl = albumData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                 addToCache(query, albumUrl);
                 setCoverUrl(albumUrl);
                 return;
              }
          }
          
          addToCache(query, null);
          setCoverUrl(null);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return; // Ignore aborts
        console.warn("Failed to fetch cover art", error);
        setCoverUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCover();

    return () => abortController.abort(); // M-6 fix: cleanup on unmount or deps change
  }, [artist, title]);

  return { coverUrl, isLoading };
};
