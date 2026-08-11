import { Keyboard } from 'lucide-react';
import { Modal } from './Modal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ['Espacio'], description: 'Reproducir o pausar' },
  { keys: ['←', '→'], description: 'Ir al compás anterior o siguiente' },
  { keys: ['Shift', '← / →'], description: 'Ir al inicio o al final' },
  { keys: ['M'], description: 'Silenciar la pista actual' },
  { keys: ['S'], description: 'Escuchar solo la pista actual' },
  { keys: ['R'], description: 'Activar o desactivar el bucle' },
  { keys: ['C'], description: 'Cambiar cuenta de entrada: no, 1 o 2 compases' },
  { keys: ['?'], description: 'Mostrar u ocultar estos atajos' },
];

export const KeyboardShortcutsModal = ({ isOpen, onClose }: KeyboardShortcutsModalProps) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Atajos de teclado" icon={<Keyboard size={22} />}>
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-primary-500/20 bg-primary-500/10 p-3 text-sm text-zinc-300">
        <Keyboard className="mt-0.5 shrink-0 text-primary-400" size={20} />
        <p>Estos atajos funcionan en la vista <strong className="text-white">Tab</strong> cuando no estás escribiendo en un campo.</p>
      </div>
      <dl className="divide-y divide-white/5">
        {shortcuts.map(({ keys, description }) => (
          <div key={description} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-zinc-300">{description}</dt>
            <dd className="flex shrink-0 items-center gap-1">
              {keys.map((key) => (
                <kbd key={key} className="min-w-8 rounded-md border border-white/15 bg-zinc-800 px-2 py-1 text-center font-mono text-xs font-bold text-zinc-100 shadow-sm">
                  {key}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </Modal>
);
