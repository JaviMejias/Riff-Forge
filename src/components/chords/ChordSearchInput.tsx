import { useMemo } from 'react';
import { Music2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CHORD_DICTIONARY } from '../../chords';
import { db } from '../../db';
import { InsertionCombobox } from './InsertionCombobox';

interface ChordSearchInputProps {
  canInsert?: boolean;
  onInsert: (chordName: string) => void;
}

export const ChordSearchInput = ({ canInsert, onInsert }: ChordSearchInputProps) => {
  const customChords = useLiveQuery(() => db.customChords.toArray());
  const items = useMemo(() => [...CHORD_DICTIONARY, ...(customChords || [])].map((chord) => ({
    id: `${chord.isCustom ? 'custom' : 'default'}-${chord.name}`,
    label: chord.name,
    detail: chord.root && chord.suffix ? `${chord.root} · ${chord.suffix}` : chord.root,
    icon: <Music2 size={14} />
  })), [customChords]);

  return (
    <InsertionCombobox
      items={items}
      placeholder="Buscar acorde…"
      emptyMessage="No existe ese acorde en el diccionario."
      ariaLabel="Buscar e insertar acorde"
      canInsert={canInsert}
      onInsert={(item) => onInsert(item.label)}
    />
  );
};
