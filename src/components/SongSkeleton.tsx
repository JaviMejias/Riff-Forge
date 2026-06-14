import { motion } from 'framer-motion';

export const SongSkeleton = () => {
  return (
    <div className="flex items-center p-3 rounded-2xl border border-white/5 bg-zinc-900/40 backdrop-blur-sm relative overflow-hidden">
      {/* Shimmer Effect */}
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 z-10 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
      />
      
      {/* Left: Cover */}
      <div className="relative w-20 h-20 shrink-0 mr-4 rounded-xl bg-zinc-800/50 flex items-center justify-center border border-white/5">
        <div className="w-16 h-16 rounded-full bg-zinc-900/80" />
      </div>

      {/* Right: Info Lines */}
      <div className="flex flex-col flex-1 gap-2 py-1">
        <div className="h-5 bg-zinc-800/50 rounded w-3/4" />
        <div className="h-3 bg-zinc-800/50 rounded w-1/2 mt-1" />
        <div className="h-3 bg-zinc-800/50 rounded w-1/3" />
      </div>
    </div>
  );
};
