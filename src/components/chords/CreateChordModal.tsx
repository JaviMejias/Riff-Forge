import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Volume2 } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { db } from '../../db';
import { ChordBox } from '../ChordBox';
import { playChordAudio } from '../../audio';
import type { ChordDef } from '../../chords';

const MySwal = withReactContent(Swal);

interface CreateChordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

export const CreateChordModal = ({ isOpen, onClose }: CreateChordModalProps) => {
  const [name, setName] = useState('');
  const [root, setRoot] = useState('C');
  const [baseFret, setBaseFret] = useState(1);
  const [frets, setFrets] = useState<number[]>([-1, -1, -1, -1, -1, -1]); // -1 = muted
  
  // To keep it simple, we won't force users to set fingerings, we'll just set 0 for all fingers or auto-assign
  // For the actual fret values, standard ChordSheetJS expects absolute frets or relative? 
  // AlphaTab/VexTab usually expects absolute fret numbers. ChordSheetJS expects absolute frets.
  // Wait, in CHORD_DICTIONARY: C is [-1, 3, 2, 0, 1, 0], baseFret: 1. These are absolute frets.
  // We'll store absolute frets.
  
  const handleStringClick = (stringIndex: number, fretOffset: number) => {
    const newFrets = [...frets];
    const absoluteFret = baseFret + fretOffset;
    if (newFrets[stringIndex] === absoluteFret) {
      // Toggle off (open if baseFret=1, otherwise muted? Muted is safer)
      newFrets[stringIndex] = -1;
    } else {
      newFrets[stringIndex] = absoluteFret;
    }
    setFrets(newFrets);
  };

  const handleHeaderClick = (stringIndex: number) => {
    const newFrets = [...frets];
    if (newFrets[stringIndex] === 0) {
      newFrets[stringIndex] = -1;
    } else {
      newFrets[stringIndex] = 0;
    }
    setFrets(newFrets);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      MySwal.fire({ title: 'Error', text: 'El acorde debe tener un nombre', icon: 'error', background: '#18181b', color: '#fff' });
      return;
    }

    const chordDef: ChordDef = {
      name: name.trim(),
      root: root,
      frets: frets,
      fingers: [0, 0, 0, 0, 0, 0], // Simple default
      baseFret: baseFret,
      isCustom: true
    };

    try {
      await db.customChords.add(chordDef);
      MySwal.fire({
        title: '¡Guardado!',
        text: `El acorde ${name} ha sido añadido a tu diccionario.`,
        icon: 'success',
        background: '#18181b',
        color: '#f4f4f5',
        timer: 2000,
        showConfirmButton: false
      });
      onClose();
      // Reset
      setName('');
      setRoot('C');
      setBaseFret(1);
      setFrets([-1, -1, -1, -1, -1, -1]);
    } catch {
      MySwal.fire({ title: 'Error', text: 'No se pudo guardar el acorde', icon: 'error', background: '#18181b', color: '#fff' });
    }
  };

  if (!isOpen) return null;

  const currentPreview: ChordDef = {
    name: name || 'Preview',
    root,
    frets,
    fingers: [0,0,0,0,0,0],
    baseFret
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-6">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-chord-title"
          className="relative w-full max-w-4xl h-[calc(100dvh-0.75rem)] md:h-auto bg-zinc-900 border border-white/10 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row md:max-h-[90vh] pb-[env(safe-area-inset-bottom)] md:pb-0"
        >
          {/* Columna Izquierda: Controles y Fretboard */}
          <div className="flex-1 min-h-0 p-4 sm:p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col gap-4 sm:gap-6 md:gap-8">
            <div className="flex items-center justify-between">
              <h2 id="create-chord-title" className="text-xl sm:text-2xl font-black text-white">Crear Acorde</h2>
              <button onClick={onClose} className="w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-zinc-400">Nombre del Acorde</label>
                <input
                  type="text"
                  placeholder="ej. Cmaj7/E"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-w-0 min-h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 sm:px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-zinc-400">Nota Raíz</label>
                <select
                  value={root}
                  onChange={(e) => setRoot(e.target.value)}
                  className="w-full min-w-0 min-h-11 bg-zinc-950 border border-white/10 rounded-xl px-3 sm:px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-colors"
                >
                  {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:gap-4 bg-zinc-950/50 p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/5">
              <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-2">
                <label className="text-sm font-bold text-zinc-400">Fretboard Interactivo</label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Traste Base</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="15" 
                    value={baseFret} 
                    onChange={(e) => setBaseFret(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 min-h-10 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-center text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>

              <p className="text-[11px] font-medium text-primary-500/70 bg-primary-500/5 px-3 py-2 rounded-lg border border-primary-500/10 mb-2">
                <strong className="text-primary-500">Nota sobre las cuerdas:</strong> La Cuerda 6 (E, más gruesa/grave) está a la izquierda y la Cuerda 1 (e, más delgada/aguda) a la derecha.
              </p>

              <div className="mt-1 flex justify-center overflow-x-auto pb-2 sm:mt-2 sm:pb-4">
                <div className="flex gap-1 min-[380px]:gap-3 sm:gap-4">
                  {[0, 1, 2, 3, 4, 5].map(stringIndex => {
                    const isMuted = frets[stringIndex] === -1;
                    const isOpen = frets[stringIndex] === 0;
                    return (
                      <div key={stringIndex} className="flex flex-col items-center gap-2">
                        {/* Header (Nut/Mute) */}
                        <button 
                          onClick={() => handleHeaderClick(stringIndex)}
                          className={`w-10 h-10 sm:w-8 sm:h-8 rounded-full font-bold flex items-center justify-center transition-all ${
                            isMuted ? 'text-red-500 hover:bg-red-500/10' : 
                            isOpen ? 'text-green-500 hover:bg-green-500/10' : 
                            'text-zinc-500 hover:bg-white/10'
                          }`}
                          aria-label={`Cuerda ${6 - stringIndex}: ${isMuted ? 'silenciada' : isOpen ? 'al aire' : 'con traste'}. Cambiar estado`}
                        >
                          {isMuted ? 'X' : isOpen ? '0' : '-'}
                        </button>
                        
                        {/* Frets */}
                        <div className="flex flex-col gap-1 w-10 sm:w-8 bg-zinc-900 rounded-lg py-2 border border-white/5 shadow-inner">
                          {[0, 1, 2, 3, 4].map(fretOffset => {
                            const absoluteFret = baseFret + fretOffset;
                            const isActive = frets[stringIndex] === absoluteFret;
                            
                            return (
                              <button
                                key={fretOffset}
                                onClick={() => handleStringClick(stringIndex, fretOffset)}
                                className="relative w-full h-11 sm:h-12 flex items-center justify-center group"
                                aria-label={`Cuerda ${6 - stringIndex}, traste ${absoluteFret}`}
                                aria-pressed={isActive}
                              >
                                {/* Cuerda Visual */}
                                <div className="absolute inset-y-0 w-0.5 bg-zinc-700 group-hover:bg-zinc-500 transition-colors" />
                                
                                {/* Traste Visual */}
                                <div className="absolute bottom-0 w-full h-px bg-white/10" />
                                
                                {/* Dedo */}
                                {isActive && (
                                  <motion.div 
                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="relative z-10 w-6 h-6 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] flex items-center justify-center"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-zinc-900" />
                                  </motion.div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        
                        {/* Nombre de la Cuerda (E A D G B e) */}
                        <div className="text-[10px] font-bold text-zinc-600 mt-1">
                          {['E', 'A', 'D', 'G', 'B', 'e'][stringIndex]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* Columna Derecha: Previsualización */}
          <div className="w-full md:w-80 bg-zinc-950 p-3 md:p-8 flex items-center md:items-stretch gap-2 md:gap-0 md:flex-col md:justify-between border-t md:border-t-0 md:border-l border-white/5 shrink-0">
            <div className="flex items-center md:flex-col md:items-center min-w-0 flex-1 md:flex-none">
              <h3 className="hidden md:block text-sm font-bold text-zinc-500 uppercase tracking-widest mb-8">Previsualización</h3>
              
              <div className="hidden md:block bg-zinc-900 p-8 rounded-3xl border border-primary-500/30 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                <ChordBox chord={currentPreview} width={140} height={180} hideName={true} />
              </div>
              <div className="text-base md:text-2xl font-black text-primary-500 md:mt-6 text-left md:text-center truncate">
                {currentPreview.name || 'Sin Nombre'}
              </div>

              <button
                onClick={() => playChordAudio(currentPreview.frets)}
                className="ml-auto md:ml-0 md:mt-6 w-11 h-11 md:w-full md:h-auto md:py-3 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-primary-500 hover:text-zinc-950 text-white rounded-xl transition-all font-bold shrink-0"
                title="Sonar acorde"
              >
                <Volume2 size={18} />
                <span className="hidden md:inline">Sonar Acorde</span>
              </button>
            </div>

            <div className="md:mt-8 md:pt-8 md:border-t border-white/10 shrink-0">
              <button
                onClick={handleSave}
                className="min-h-11 flex items-center justify-center gap-2 w-auto md:w-full px-4 md:px-0 md:py-4 bg-primary-500 hover:bg-primary-400 text-zinc-950 rounded-xl md:rounded-2xl transition-all font-black text-sm md:text-lg shadow-[0_0_20px_var(--theme-glow)]"
              >
                <Save size={20} />
                Guardar Acorde
              </button>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
