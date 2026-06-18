import { Settings, AlertCircle, Music, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

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
        className="fixed inset-0 z-10"
        onClick={() => setShowYtSettings(false)}
        title="Cerrar ajustes"
      />
      <div className="absolute bottom-36 right-4 sm:right-8 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 w-72 sm:w-80 shadow-2xl z-20">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Settings size={16} className="text-primary-500" /> Motor de Audio
          </h3>
          <button onClick={() => setShowYtSettings(false)} className="text-zinc-400 hover:text-white transition-colors">✕</button>
        </div>

        {!ytAudioUrl ? (
          <div className="text-center py-4">
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
                  className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-primary-500/20 hover:text-primary-400 text-zinc-400 disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center"
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
                  className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-primary-500/20 hover:text-primary-400 text-zinc-400 disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center"
                >
                  <ChevronUp size={20} />
                </button>
              </div>

              {/* Presets rápidos */}
              <div className="grid grid-cols-9 gap-1">
                {SEMITONE_PRESETS.map((st) => (
                  <button
                    key={st}
                    onClick={() => setPitch(st)}
                    className={`h-7 rounded-lg text-[10px] font-black transition-all active:scale-95 ${
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
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-zinc-600 w-6 text-right">-12</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={pitch}
                  onChange={handlePitchChange}
                  className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
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
