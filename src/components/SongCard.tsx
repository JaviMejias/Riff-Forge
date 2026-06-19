import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';
import { Trash2, Plus, User, Disc3, X, FileText, Guitar, Globe, Edit3 } from 'lucide-react';
import type { Song } from '../db';
import { useCoverArt } from '../hooks/useCoverArt';

interface SongCardProps {
  song: Song;
  isActive: boolean;
  onPlay: () => void;
  onAdd?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onRemove?: (e: React.MouseEvent) => void;
  onTogglePublic?: (e: React.MouseEvent) => void;
  onEditMetadata?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  index?: number;
}

export const SongCard = ({ song, isActive, onPlay, onAdd, onDelete, onRemove, onTogglePublic, onEditMetadata, isSelected = false, onToggleSelect, index = 0 }: SongCardProps) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const { coverUrl } = useCoverArt(song.artist, song.name);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: index * 0.05 } }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onPlay}
      onMouseMove={handleMouseMove}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={`group flex items-center p-3 rounded-2xl cursor-pointer transition-all border backdrop-blur-sm relative overflow-hidden opacity-0 ${
        isActive || isSelected
          ? 'bg-primary-500/10 border-primary-500/50 shadow-[0_0_20px_var(--theme-glow)]'
          : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-white/10 hover:border-primary-500/30 shadow-lg hover:shadow-[0_0_15px_var(--theme-glow)]'
      }`}
    >
      {/* Checkbox for Multi-Select */}
      {onToggleSelect && (
        <div 
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center p-2"
          onClick={onToggleSelect}
        >
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary-500 border-primary-500 text-zinc-950' : 'border-zinc-500 group-hover:border-primary-500'}`}>
            {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
          </div>
        </div>
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

      {/* Left: Vinyl Cover or Cover Art */}
      <div className={`relative z-10 w-20 h-20 shrink-0 mr-4 rounded-xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center shadow-inner border border-white/5 transition-all ${onToggleSelect ? 'ml-8' : ''}`}>
        {coverUrl ? (
          <img src={coverUrl} alt={song.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-90 group-hover:opacity-100" />
        ) : (
          /* Vinyl Record Fallback */
          <motion.div
            animate={isActive ? { rotate: 360 } : { rotate: 0 }}
            transition={isActive ? { duration: 3, repeat: Infinity, ease: "linear" } : { duration: 0.5 }}
            className="w-16 h-16 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-lg"
            style={{ background: 'repeating-radial-gradient(circle, #18181b, #18181b 2px, #27272a 3px, #18181b 4px)' }}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-primary-500 shadow-[0_0_10px_var(--theme-glow-strong)]' : 'bg-zinc-700'}`}>
              <div className="w-1.5 h-1.5 bg-zinc-950 rounded-full" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Right: Info */}
      <div className="flex flex-col flex-1 min-w-0 py-1 relative z-10">
        <div className="flex items-center gap-2 min-w-0 mb-1">
          <h3 className={`font-black truncate text-lg leading-tight ${isActive ? 'text-primary-400' : 'text-zinc-100'}`} title={song.name}>
            {song.name}
          </h3>
          {isActive && (
            <div className="flex items-end gap-[2px] h-3 shrink-0 ml-1">
              <motion.div animate={{ height: ['40%', '100%', '40%'] }} transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }} className="w-[3px] bg-primary-400 rounded-t-sm" />
              <motion.div animate={{ height: ['100%', '30%', '100%'] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }} className="w-[3px] bg-primary-400 rounded-t-sm" />
              <motion.div animate={{ height: ['60%', '90%', '60%'] }} transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }} className="w-[3px] bg-primary-400 rounded-t-sm" />
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 text-zinc-400 text-sm mt-1 truncate">
          <User size={14} className="shrink-0 text-zinc-500" />
          <span className="truncate">{song.artist || 'Desconocido'}</span>
        </div>

        {song.album && (
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs mt-0.5 truncate">
            <Disc3 size={12} className="shrink-0 opacity-70" />
            <span className="truncate font-medium">{song.album}</span>
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center">
          {song.data && song.textContent ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-400 text-[10px] font-bold uppercase tracking-wider border border-primary-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500" /> Tab + Acordes
            </span>
          ) : song.type === 'text' || (!song.data && song.textContent) ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-400 text-[10px] font-bold uppercase tracking-wider border border-primary-500/20">
              <FileText size={10} /> Acordes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-400 text-[10px] font-bold uppercase tracking-wider border border-primary-500/20">
              <Guitar size={10} /> Tab
            </span>
          )}
        </div>

        {/* Actions (Siempre visibles en móvil y PC) */}
        <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-white/5 opacity-100 pointer-events-auto">
          {onTogglePublic && (
            <button
              onClick={onTogglePublic}
              className={`p-1.5 rounded-lg transition-all ${song.isPublic ? 'text-primary-400 bg-primary-400/10' : 'text-zinc-500 hover:text-primary-400 hover:bg-primary-400/10'}`}
              title={song.isPublic ? 'Hacer Privado' : 'Hacer Público'}
            >
              <Globe size={16} />
            </button>
          )}
          {onEditMetadata && (
            <button
              onClick={onEditMetadata}
              className="p-1.5 text-zinc-500 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all"
              title="Editar Metadatos"
            >
              <Edit3 size={16} />
            </button>
          )}
          {onAdd && (
            <button
              onClick={onAdd}
              className="p-1.5 text-zinc-500 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all"
              title="Añadir a Playlist"
            >
              <Plus size={16} />
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
              title="Quitar de la lista"
            >
              <X size={16} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
              title="Eliminar de la biblioteca"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
