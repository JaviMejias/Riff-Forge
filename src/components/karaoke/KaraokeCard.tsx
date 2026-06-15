import { Mic2, Play, Trash2, MonitorPlay, Disc3 } from 'lucide-react';
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';
import type { Karaoke } from '../../db';

interface KaraokeCardProps {
  karaoke: Karaoke;
  index: number;
  isActive: boolean;
  onPlay: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const KaraokeCard = ({ karaoke, index, isActive, onPlay, onDelete }: KaraokeCardProps) => {
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
    } catch (e) {
      // invalid url
    }
    return null;
  };

  const thumbnail = karaoke.youtubeUrl ? getYoutubeThumbnail(karaoke.youtubeUrl) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: index * 0.05 } }}
      whileHover={{ y: -5, scale: 1.02 }}
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer opacity-0 ${
        isActive 
          ? 'bg-primary-500/10 border-primary-500/50 shadow-[0_0_30px_var(--theme-glow)]' 
          : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-800/60 hover:border-primary-500/30 hover:shadow-[0_0_15px_var(--theme-glow)]'
      }`}
      onClick={onPlay}
      onMouseMove={handleMouseMove}
    >
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
      <div className="absolute top-3 right-3 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={onDelete}
          className="p-2 bg-rose-500/90 text-white rounded-xl shadow-lg hover:bg-rose-500 hover:scale-110 transition-all backdrop-blur-md"
          title="Eliminar Karaoke"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex flex-col h-full">
        {/* Thumbnail Area */}
        <div className="relative h-32 sm:h-40 bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0">
          {thumbnail ? (
            <img 
              src={thumbnail} 
              alt={karaoke.name} 
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500" 
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 opacity-50"></div>
          )}
          
          <div className="relative z-10 p-4 rounded-full bg-zinc-950/50 backdrop-blur-sm border border-white/10 text-white shadow-2xl group-hover:scale-110 group-hover:bg-primary-500 group-hover:text-zinc-950 group-hover:border-primary-400 transition-all duration-300">
            <Play size={24} className={isActive ? 'text-primary-500' : ''} />
          </div>

          <div className="absolute bottom-2 left-2 flex gap-2 z-10">
            {karaoke.youtubeUrl && (
              <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md bg-primary-500/10 text-primary-400 backdrop-blur-md shadow-sm border border-primary-500/20">
                <MonitorPlay size={12} /> YouTube
              </span>
            )}
            {karaoke.hasLocalAudio && (
              <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md bg-primary-500/10 text-primary-400 backdrop-blur-md shadow-sm border border-primary-500/20">
                <Disc3 size={12} /> MP3
              </span>
            )}
          </div>
        </div>

        {/* Info Area */}
        <div className="p-4 flex flex-col flex-1 relative z-10 pointer-events-none">
          <h3 className="font-bold text-base sm:text-lg text-zinc-100 truncate group-hover:text-primary-400 transition-colors mb-1">
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
