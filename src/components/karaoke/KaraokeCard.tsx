import { Mic2, Play, Trash2, MonitorPlay, Disc3, Globe, Edit3, Download, MoreVertical } from 'lucide-react';
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';
import type { Karaoke } from '../../db';
import { useCoverArt } from '../../hooks/useCoverArt';
import { downloadKaraokeMp3 } from '../../utils/download';
import { KaraokeAudioUploadButton } from './KaraokeAudioUploadButton';

interface KaraokeCardProps {
  karaoke: Karaoke;
  index: number;
  isActive: boolean;
  onPlay: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePublic?: (e: React.MouseEvent) => void;
  onEditMetadata?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
}

export const KaraokeCard = ({ karaoke, index, isActive, onPlay, onDelete, onTogglePublic, onEditMetadata, isSelected = false, onToggleSelect }: KaraokeCardProps) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const getYoutubeThumbnail = (url: string) => {
    try {
      const urlObj = new URL(url);
      let videoId = '';
      if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v') || '';
      } else if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      }
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
    } catch {
      // invalid url
    }
    return null;
  };

  const thumbnail = karaoke.youtubeUrl ? getYoutubeThumbnail(karaoke.youtubeUrl) : null;
  const { coverUrl } = useCoverArt(karaoke.artist, karaoke.name);
  const displayImage = coverUrl || thumbnail;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: index * 0.05 } }}
      whileHover={{ y: -5, scale: 1.02 }}
      className={`group relative overflow-visible rounded-2xl border transition-all duration-300 cursor-pointer opacity-0 has-[details[open]]:z-50 sm:overflow-hidden ${
        isActive || isSelected
          ? 'bg-primary-500/10 border-primary-500/50 shadow-[0_0_30px_var(--theme-glow)]' 
          : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-800/60 hover:border-primary-500/30 hover:shadow-[0_0_15px_var(--theme-glow)]'
      }`}
      onClick={onPlay}
      onMouseMove={handleMouseMove}
    >
      <details className="absolute right-2 top-2 z-40 sm:hidden" onClick={event => event.stopPropagation()}>
        <summary title="Acciones" aria-label={`Acciones de ${karaoke.name}`} className="flex min-h-10 min-w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-zinc-950/90 text-zinc-300 shadow-lg backdrop-blur-xl [&::-webkit-details-marker]:hidden">
          <MoreVertical size={20} />
        </summary>
        <div className="absolute right-0 top-12 flex min-w-48 flex-col gap-1 rounded-2xl border border-white/10 bg-zinc-950 p-2 text-sm font-semibold shadow-2xl">
          {onTogglePublic && <button onClick={onTogglePublic} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-zinc-200 active:bg-zinc-800"><Globe size={17} />{karaoke.isPublic ? 'Hacer privado' : 'Hacer público'}</button>}
          {onEditMetadata && <button onClick={onEditMetadata} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-zinc-200 active:bg-zinc-800"><Edit3 size={17} />Editar información</button>}
          {(karaoke.hasLocalAudio || karaoke.cloudUrl) && (
            <button onClick={event => { event.stopPropagation(); downloadKaraokeMp3(karaoke); }} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-zinc-200 active:bg-zinc-800"><Download size={17} />Descargar audio</button>
          )}
          {!karaoke.hasLocalAudio && !karaoke.cloudUrl && (
            <KaraokeAudioUploadButton
              karaoke={karaoke}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-zinc-200 active:bg-zinc-800 disabled:opacity-50"
            />
          )}
          <button onClick={onDelete} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-rose-400 active:bg-rose-500/10"><Trash2 size={17} />Eliminar</button>
        </div>
      </details>

      {/* Checkbox for Multi-Select */}
      {onToggleSelect && (
        <button
          type="button"
          className="absolute left-2 top-2 z-30 flex items-center justify-center p-2"
          onClick={onToggleSelect}
          aria-label={`${isSelected ? 'Deseleccionar' : 'Seleccionar'} ${karaoke.name}`}
          aria-pressed={isSelected}
        >
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-lg backdrop-blur-md ${isSelected ? 'bg-primary-500 border-primary-500 text-zinc-950' : 'border-white/50 bg-black/30 group-hover:border-primary-500'}`}>
            {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          </div>
        </button>
      )}

      {/* Spotlight Effect */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100 z-0"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              300px circle at ${mouseX}px ${mouseY}px,
              var(--theme-glow),
              transparent 80%
            )
          `,
        }}
      />
      {/* Opciones hover (arriba a la derecha) */}
      <div className="absolute top-3 right-3 z-20 hidden gap-2 opacity-0 transition-opacity duration-200 pointer-events-auto sm:flex sm:group-hover:opacity-100">
        {onTogglePublic && (
          <button
            onClick={onTogglePublic}
            className={`p-2 rounded-xl shadow-lg transition-all backdrop-blur-md hover:scale-110 ${karaoke.isPublic ? 'bg-primary-500/90 text-zinc-900 hover:bg-primary-500' : 'bg-zinc-800/90 text-zinc-400 hover:bg-zinc-700 hover:text-primary-400'}`}
            title={karaoke.isPublic ? 'Hacer Privado' : 'Hacer Público'}
          >
            <Globe size={16} />
          </button>
        )}
        {onEditMetadata && (
          <button
            onClick={onEditMetadata}
            className="p-2 rounded-xl shadow-lg transition-all backdrop-blur-md hover:scale-110 bg-zinc-800/90 text-zinc-400 hover:bg-zinc-700 hover:text-primary-400"
            title="Editar Metadatos"
          >
            <Edit3 size={16} />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-2 bg-rose-500/90 text-white rounded-xl shadow-lg hover:bg-rose-500 hover:scale-110 transition-all backdrop-blur-md"
          title="Eliminar Karaoke"
        >
          <Trash2 size={16} />
        </button>
        {(karaoke.hasLocalAudio || karaoke.cloudUrl) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadKaraokeMp3(karaoke);
            }}
            className="p-2 bg-primary-500/90 text-zinc-900 rounded-xl shadow-lg hover:bg-primary-500 hover:scale-110 transition-all backdrop-blur-md"
            title="Descargar Audio MP3"
          >
            <Download size={16} />
          </button>
        )}
        {!karaoke.hasLocalAudio && !karaoke.cloudUrl && (
          <KaraokeAudioUploadButton
            karaoke={karaoke}
            iconOnly
            className="p-2 bg-primary-500/90 text-zinc-900 rounded-xl shadow-lg hover:bg-primary-500 hover:scale-110 transition-all backdrop-blur-md disabled:opacity-50"
          />
        )}
      </div>

      <div className="flex min-h-28 h-full flex-row sm:flex-col">
        {/* Thumbnail Area */}
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-l-2xl bg-zinc-950 sm:h-40 sm:w-full sm:rounded-none">
          {displayImage ? (
            <img 
              src={displayImage} 
              alt={karaoke.name} 
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${coverUrl ? 'opacity-80 group-hover:opacity-100' : 'opacity-60 group-hover:opacity-80'}`} 
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary-900 to-zinc-900 opacity-50"></div>
          )}
          
          <div className="relative z-10 rounded-full border border-white/10 bg-zinc-950/50 p-2.5 text-white shadow-2xl backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:border-primary-400 group-hover:bg-primary-500 group-hover:text-zinc-950 sm:p-4">
            <Play size={20} className={`sm:h-6 sm:w-6 ${isActive ? 'text-primary-500' : ''}`} />
          </div>

          <div className="absolute bottom-1.5 left-1.5 z-10 flex gap-1 sm:bottom-2 sm:left-2 sm:gap-2">
            {karaoke.youtubeUrl && (
              <span className="flex items-center gap-1 rounded-md border border-primary-500/20 bg-zinc-950/70 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary-400 shadow-sm backdrop-blur-md sm:bg-primary-500/10 sm:px-2 sm:text-[10px]">
                <MonitorPlay size={11} /> <span className="hidden sm:inline">YouTube</span>
              </span>
            )}
            {karaoke.hasLocalAudio && (
              <span className="flex items-center gap-1 rounded-md border border-primary-500/20 bg-zinc-950/70 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary-400 shadow-sm backdrop-blur-md sm:bg-primary-500/10 sm:px-2 sm:text-[10px]">
                <Disc3 size={11} /> <span className="hidden sm:inline">MP3</span>
              </span>
            )}
          </div>
        </div>

        {/* Info Area */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center p-3 pr-12 pointer-events-none sm:justify-start sm:p-4">
          <h3 className="mb-1 truncate text-base font-bold text-zinc-100 transition-colors group-hover:text-primary-400 sm:text-lg">
            {karaoke.name}
          </h3>
          <p className="text-zinc-400 text-xs sm:text-sm truncate font-medium flex items-center gap-2">
            <Mic2 size={14} className="opacity-70" /> {karaoke.artist || 'Desconocido'}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
