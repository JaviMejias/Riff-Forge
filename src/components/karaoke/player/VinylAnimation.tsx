import type { Karaoke } from '../../../db';

interface VinylAnimationProps {
  isPlaying: boolean;
  karaoke: Karaoke;
}

export const VinylAnimation = ({ isPlaying, karaoke }: VinylAnimationProps) => {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center">
      {/* Vinyl Record */}
      <div className="relative group w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 -mt-16 sm:-mt-10">
        {/* Tone Arm (aesthetic only) */}
        <div className={`absolute -top-10 -right-10 sm:-top-16 sm:-right-16 w-8 h-32 sm:w-12 sm:h-48 origin-top-right transition-transform duration-1000 z-10 ${isPlaying ? 'rotate-[25deg]' : 'rotate-0'}`}>
          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-zinc-400 absolute top-0 right-0 shadow-lg border-2 border-zinc-700" />
          <div className="w-1.5 sm:w-2 h-full bg-gradient-to-b from-zinc-300 to-zinc-500 absolute top-2 right-2 sm:right-3 rounded-full shadow-lg" />
          <div className="w-6 h-10 sm:w-8 sm:h-16 bg-zinc-800 absolute bottom-0 right-0 rounded-sm border border-zinc-600 shadow-xl" />
        </div>

        {/* The Record */}
        <div 
          className={`w-full h-full rounded-full bg-zinc-950 shadow-[0_10px_40px_rgba(0,0,0,0.8)] border-[4px] border-zinc-900 flex items-center justify-center relative overflow-hidden ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}
          style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
        >
          {/* Grooves */}
          <div className="absolute inset-2 border border-white/5 rounded-full pointer-events-none" />
          <div className="absolute inset-6 border border-white/5 rounded-full pointer-events-none" />
          <div className="absolute inset-10 border border-white/5 rounded-full pointer-events-none" />
          <div className="absolute inset-14 border border-white/5 rounded-full pointer-events-none" />
          <div className="absolute inset-18 border border-white/5 rounded-full pointer-events-none" />
          
          {/* Vinyl Highlight / Reflection */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-transparent rotate-45 pointer-events-none" />

          {/* Center Label */}
          <div className="w-1/3 h-1/3 bg-primary-500 rounded-full shadow-inner flex flex-col items-center justify-center p-2 text-center relative border-[3px] border-primary-600">
            <div className="w-3 h-3 bg-zinc-950 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10" />
            <p className="text-[0.5rem] sm:text-[0.6rem] font-black text-primary-950 uppercase tracking-widest truncate w-full mb-1">{karaoke.artist || 'Unknown'}</p>
            <p className="text-[0.4rem] sm:text-[0.5rem] font-bold text-primary-900 uppercase truncate w-full leading-tight">{karaoke.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
