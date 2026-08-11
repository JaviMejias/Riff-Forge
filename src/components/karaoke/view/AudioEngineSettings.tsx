import { Settings, AlertCircle, Music, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react';

interface AudioEngineSettingsProps {
  showYtSettings: boolean;
  setShowYtSettings: (show: boolean) => void;
  ytAudioUrl: string | null;
  pitch: number;
  handlePitchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SEMITONE_PRESETS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

export const AudioEngineSettings = ({
  showYtSettings,
  setShowYtSettings,
  ytAudioUrl,
  pitch,
  handlePitchChange,
}: AudioEngineSettingsProps) => {
  if (!showYtSettings) return null;

  const setPitch = (val: number) => {
    const clamped = Math.max(-12, Math.min(12, val));
    handlePitchChange({ target: { value: String(clamped) } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <>
      {/* Fondo transparente para cerrar al hacer clic fuera */}
      <div
        className="fixed inset-0 z-10 bg-black/20 sm:bg-transparent"
        onClick={() => setShowYtSettings(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-engine-title"
        className="fixed inset-x-0 bottom-0 z-20 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-900/98 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-36 sm:right-8 sm:w-80 sm:rounded-2xl sm:p-5"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700 sm:hidden" />
        <div className="mb-5 flex items-center justify-between">
          <h3 id="audio-engine-title" className="flex items-center gap-2 text-sm font-bold text-white">
            <Settings size={16} className="text-primary-500" /> Motor de audio
          </h3>
          <button
            onClick={() => setShowYtSettings(false)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white sm:min-h-9 sm:min-w-9"
            aria-label="Cerrar ajustes de audio"
          >
            <X size={18} />
          </button>
        </div>

        {!ytAudioUrl ? (
          <div className="py-4 text-center">
            <AlertCircle size={24} className="text-rose-500 mx-auto mb-2" />
            <p className="text-xs text-zinc-300 font-bold mb-2">Motor de Tono Inactivo</p>
            <p className="text-[10px] text-zinc-400 leading-relaxed mb-4">
              La API comunitaria que extrae el audio limpio de YouTube está temporalmente bloqueada. Estás escuchando el audio original (sin capacidad de cambiar el tono).
            </p>
            <div className="bg-zinc-800 rounded-xl p-3 text-left">
              <p className="text-[10px] text-zinc-300 font-bold mb-2">Opciones:</p>
              <ul className="text-[10px] text-zinc-500 list-disc pl-4 space-y-1">
                <li>Usa la pestaña <strong>MP3</strong> (100% nativo y sin bloqueos).</li>
                <li>Instala la extensión <strong>Transpose</strong> en el navegador y abre el video directamente en YouTube.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Control de Tono — diseño mejorado */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
                  <Music size={12} className="text-primary-400" />
                  Cambio de Tono
                </label>
                {pitch !== 0 && (
                  <button
                    onClick={() => setPitch(0)}
                    className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-primary-400 transition-colors"
                  >
                    <RotateCcw size={10} /> Resetear
                  </button>
                )}
              </div>

              {/* Display principal del tono */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={() => setPitch(pitch - 1)}
                  disabled={pitch <= -12}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition-all hover:bg-primary-500/20 hover:text-primary-400 active:scale-95 disabled:opacity-30 sm:h-10 sm:w-10"
                  aria-label="Bajar un semitono"
                >
                  <ChevronDown size={20} />
                </button>

                <div className={`flex flex-col items-center min-w-[72px] ${pitch !== 0 ? 'text-primary-400' : 'text-zinc-500'}`}>
                  <span className="text-3xl font-black tabular-nums leading-none">
                    {pitch > 0 ? `+${pitch}` : pitch}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-600 mt-0.5">semitonos</span>
                </div>

                <button
                  onClick={() => setPitch(pitch + 1)}
                  disabled={pitch >= 12}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition-all hover:bg-primary-500/20 hover:text-primary-400 active:scale-95 disabled:opacity-30 sm:h-10 sm:w-10"
                  aria-label="Subir un semitono"
                >
                  <ChevronUp size={20} />
                </button>
              </div>

              {/* Presets rápidos */}
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9 sm:gap-1">
                {SEMITONE_PRESETS.map((st) => (
                  <button
                    key={st}
                    onClick={() => setPitch(st)}
                    className={`min-h-10 rounded-xl text-xs font-black transition-all active:scale-95 sm:min-h-7 sm:rounded-lg sm:text-[10px] ${
                      pitch === st
                        ? 'bg-primary-500 text-zinc-950 shadow-[0_0_10px_var(--theme-glow)]'
                        : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    {st > 0 ? `+${st}` : st}
                  </button>
                ))}
              </div>

              {/* Slider fino para ajuste preciso */}
              <div className="mt-4 flex items-center gap-2 sm:mt-3">
                <span className="text-[10px] text-zinc-600 w-6 text-right">-12</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={pitch}
                  onChange={handlePitchChange}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-primary-500"
                  aria-label="Cambio de tono en semitonos"
                />
                <span className="text-[10px] text-zinc-600 w-6">+12</span>
              </div>
            </div>

            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-3">
              <p className="text-xs text-primary-400/80 mb-1 font-bold flex items-center gap-1">
                <Music size={12} /> Audio Directo Activo
              </p>
              <p className="text-[10px] text-primary-400/60 leading-relaxed">
                Estás escuchando la pista original procesada en tiempo real.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
