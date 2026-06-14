import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic2, AlertCircle, Edit3, Save, AlignLeft, MonitorPlay, Music, Settings, Info, ExternalLink } from 'lucide-react';
import { Navbar } from '../Navbar';
import { LocalAudioPlayer } from './LocalAudioPlayer';
import { db } from '../../db';
import type { Karaoke } from '../../db';
import Swal from 'sweetalert2';

interface KaraokePlayerProps {
  karaoke: Karaoke;
  onBack: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const KaraokePlayer = ({ karaoke, onBack, isSidebarOpen, onToggleSidebar }: KaraokePlayerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(karaoke.textContent || '');
  const [showLyrics, setShowLyrics] = useState(!!karaoke.textContent);
  const [showYtSettings, setShowYtSettings] = useState(false);



  // Extract YouTube ID if it's a YT URL
  const getYoutubeEmbedUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      let videoId = '';
      if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v') || '';
      } else if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    } catch (e) {
      // invalid url
    }
    return null;
  };

  const embedUrl = karaoke.youtubeUrl ? getYoutubeEmbedUrl(karaoke.youtubeUrl) : null;
  const hasLocalAudio = !!karaoke.hasLocalAudio || !!(karaoke as any).localFile;

  const [activeSource, setActiveSource] = useState<'youtube' | 'local'>(embedUrl ? 'youtube' : 'local');

  // Sync state if karaoke prop changes
  useEffect(() => {
    setShowYtSettings(false);
  }, [activeSource]);

  useEffect(() => {
    setEditContent(karaoke.textContent || '');
    if (karaoke.textContent && !showLyrics && !isEditing) {
      setShowLyrics(true);
    }
    // Update active source if the available sources change
    if (embedUrl && !hasLocalAudio) setActiveSource('youtube');
    else if (!embedUrl && hasLocalAudio) setActiveSource('local');
  }, [karaoke.textContent, embedUrl, hasLocalAudio]);

  const handleSaveLyrics = async () => {
    try {
      await db.karaokes.update(karaoke.id!, {
        textContent: editContent
      });
      setIsEditing(false);
      setShowLyrics(!!editContent.trim());
      Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        icon: 'success',
        title: 'Letra guardada',
        background: '#18181b',
        color: '#f4f4f5',
      });
    } catch (e) {
      console.error(e);
    }
  };


  return (
    <div className="flex flex-col h-full w-full p-8">
      <Navbar
        title={karaoke.name}
        subtitle={`${karaoke.artist || 'Desconocido'} • Karaoke`}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onBack={onBack}
      >
        <div className="flex gap-2">
          {!isEditing && (
            <button
              onClick={() => setShowLyrics(!showLyrics)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer font-bold text-xs sm:text-sm ${
                showLyrics 
                  ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <AlignLeft size={16} /> <span className="hidden sm:inline">{showLyrics ? 'Ocultar Letra' : 'Mostrar Letra'}</span>
            </button>
          )}

          {isEditing ? (
            <button
              onClick={handleSaveLyrics}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              <Save size={16} /> <span className="hidden sm:inline">Guardar Letra</span>
            </button>
          ) : (
            <button
              onClick={() => { setIsEditing(true); setShowLyrics(true); }}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(245,158,11,0.2)]"
            >
              <Edit3 size={16} /> <span className="hidden sm:inline">Editar Letra</span>
            </button>
          )}
        </div>
      </Navbar>

      <div className="flex-1 mt-6 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* LADO IZQUIERDO: REPRODUCTOR */}
        <div className={`relative flex flex-col transition-all duration-300 ${
          showLyrics ? 'lg:w-1/2 h-[40vh] lg:h-full' : 'w-full h-full'
        }`}>
          {/* Selector de Fuente (Sólo si tiene ambas) */}
          {embedUrl && hasLocalAudio && (
            <div className="flex bg-zinc-900/50 p-1 rounded-xl mb-4 self-center sm:self-start border border-white/5 relative">
              <button
                onClick={() => setActiveSource('youtube')}
                className={`relative flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-colors z-10 ${
                  activeSource === 'youtube' 
                    ? 'text-zinc-950' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                {activeSource === 'youtube' && (
                  <motion.div
                    layoutId="karaokeSourcePill"
                    className="absolute inset-0 bg-amber-500 rounded-lg shadow-md -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <MonitorPlay size={14} className="sm:w-4 sm:h-4" /> YouTube
              </button>
              <button
                onClick={() => setActiveSource('local')}
                className={`relative flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-colors z-10 ${
                  activeSource === 'local' 
                    ? 'text-zinc-950' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                {activeSource === 'local' && (
                  <motion.div
                    layoutId="karaokeSourcePill"
                    className="absolute inset-0 bg-amber-500 rounded-lg shadow-md -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <Music size={14} className="sm:w-4 sm:h-4" /> MP3
              </button>
            </div>
          )}

          <div className="flex-1 rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl relative">
            {!embedUrl && !hasLocalAudio ? (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 h-full">
                <AlertCircle size={48} className="mb-4 opacity-50" />
                <p className="text-xl font-bold">Fuente no encontrada</p>
                <p className="text-sm">El enlace de YouTube no es válido o el archivo local no existe.</p>
              </div>
            ) : activeSource === 'youtube' && embedUrl ? (
              <div className="flex-1 w-full h-full relative group">
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                  title={karaoke.name}
                ></iframe>
                
                {/* Overlay Settings Button */}
                <div className="absolute bottom-20 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => setShowYtSettings(!showYtSettings)}
                    className="p-2 sm:p-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full text-white transition-colors shadow-lg"
                    title="Ajustes de Audio"
                  >
                    <Settings size={20} className={`transition-transform duration-500 ${showYtSettings ? 'rotate-90 text-amber-500' : ''}`} />
                  </button>
                </div>

                {/* Info Pop-up */}
                {showYtSettings && (
                  <div className="absolute bottom-36 right-4 sm:right-8 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 w-72 sm:w-80 shadow-2xl z-20">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <Info size={16} className="text-amber-500" /> Limitación de YouTube
                      </h3>
                      <button onClick={() => setShowYtSettings(false)} className="text-zinc-400 hover:text-white">✕</button>
                    </div>
                    
                    <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                      No es posible cambiar el tono o la velocidad de forma nativa dentro de los videos insertados de YouTube debido a restricciones de seguridad.
                    </p>
                    
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                      <p className="text-xs text-amber-200/80 mb-2 font-bold">La mejor solución:</p>
                      <p className="text-xs text-amber-200/60 leading-relaxed">
                        Te sugerimos descargar esta pista como archivo MP3 y subirla a tu biblioteca (botón MP3 arriba) para usar nuestro motor de tono profesional sin salir de la app.
                      </p>
                    </div>

                    <p className="text-xs text-zinc-400 font-bold mb-3">O usa una extensión de navegador:</p>
                    <p className="text-[10px] text-zinc-500 mb-3 leading-relaxed">
                      ⚠️ <strong className="text-zinc-400">Nota:</strong> Las extensiones (como Transpose en Chrome) <strong className="text-rose-400">no funcionan dentro de esta página</strong> por seguridad del navegador. Para usarlas, debes hacer clic en el logo de YouTube del reproductor para abrir el video en una pestaña nueva y usar la extensión allí.
                    </p>
                    <div className="flex flex-col gap-2">
                      <a 
                        href="https://chromewebstore.google.com/detail/transpose-%E2%96%B2%E2%96%BC-pitch-%E2%96%B9-spee/ioimlbgefgadofblnajllknopjboejda" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 px-3 py-2 rounded-lg transition-colors"
                      >
                        <span>Transpose (Chrome / Edge)</span>
                        <ExternalLink size={12} />
                      </a>
                      <a 
                        href="https://addons.mozilla.org/es/firefox/addon/simple-pitch-shifter/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 px-3 py-2 rounded-lg transition-colors"
                      >
                        <span>Simple Pitch Shifter (Firefox)</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : activeSource === 'local' && hasLocalAudio ? (
              <div className="flex-1 w-full h-full">
                <LocalAudioPlayer karaoke={karaoke} />
              </div>
            ) : null}
          </div>
        </div>

        {/* LADO DERECHO: LETRA */}
        {showLyrics && (
          <div className="lg:w-1/2 h-[50vh] lg:h-full bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl rounded-3xl border border-white/5 flex flex-col overflow-hidden shadow-2xl relative">
            
            {/* Brillo decorativo superior */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-amber-500/5 blur-3xl pointer-events-none rounded-full" />
            
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full p-6 sm:p-8 bg-transparent text-zinc-100 font-mono text-sm sm:text-base resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500/50"
                placeholder="Pega aquí la letra de la canción..."
                spellCheck={false}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 hide-scrollbar">
                {karaoke.textContent ? (
                  <div className="flex flex-col gap-4 sm:gap-6 pb-20">
                    {karaoke.textContent.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (!trimmed) return <div key={idx} className="h-2 sm:h-4" />;
                      
                      return (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                          className="group origin-left"
                        >
                          <p className="font-sans text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-zinc-500 hover:text-zinc-100 transition-colors duration-300">
                            {trimmed}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                    <AlignLeft size={48} className="opacity-20" />
                    <p className="text-lg">No hay letra guardada aún</p>
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors text-sm font-bold"
                    >
                      Añadir Letra
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
