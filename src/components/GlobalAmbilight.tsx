import { motion, AnimatePresence } from 'framer-motion';
import { useAudioStore } from '../store/audioStore';

export const GlobalAmbilight = () => {
  const { globalIsPlaying } = useAudioStore();

  return (
    <AnimatePresence>
      {globalIsPlaying && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        >
          <motion.div 
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vw] max-w-[1500px] max-h-[1500px] rounded-full blur-[150px] mix-blend-screen"
            style={{ backgroundColor: 'var(--theme-glow, #f43f5e)' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
