const DRAFT_PREFIX = 'riff_forge_chord_draft_v1:';

export interface ChordDraftContent {
  content: string;
  originalKey: string;
  tuning: string;
  capo: string;
  strummingPattern: string;
}

export interface ChordDraft extends ChordDraftContent {
  updatedAt: number;
  sourceUpdatedAt?: number;
}

interface DraftStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const storageOrDefault = (storage?: DraftStorage) => storage || window.localStorage;

export const chordDraftKey = (songIdentity: string | number) => `${DRAFT_PREFIX}${songIdentity}`;

export const loadChordDraft = (songIdentity: string | number, storage?: DraftStorage): ChordDraft | null => {
  try {
    const serialized = storageOrDefault(storage).getItem(chordDraftKey(songIdentity));
    if (!serialized) return null;
    const draft = JSON.parse(serialized) as Partial<ChordDraft>;
    if (typeof draft.content !== 'string' || typeof draft.updatedAt !== 'number') return null;
    return {
      content: draft.content,
      originalKey: draft.originalKey || '',
      tuning: draft.tuning || '',
      capo: draft.capo || '',
      strummingPattern: draft.strummingPattern || '',
      updatedAt: draft.updatedAt,
      sourceUpdatedAt: draft.sourceUpdatedAt
    };
  } catch {
    return null;
  }
};

export const saveChordDraft = (
  songIdentity: string | number,
  content: ChordDraftContent,
  sourceUpdatedAt?: number,
  storage?: DraftStorage
) => {
  const draft: ChordDraft = { ...content, updatedAt: Date.now(), sourceUpdatedAt };
  storageOrDefault(storage).setItem(chordDraftKey(songIdentity), JSON.stringify(draft));
  return draft;
};

export const clearChordDraft = (songIdentity: string | number, storage?: DraftStorage) => {
  storageOrDefault(storage).removeItem(chordDraftKey(songIdentity));
};

export const isSameChordDraftContent = (left: ChordDraftContent, right: ChordDraftContent) => (
  left.content === right.content
  && left.originalKey === right.originalKey
  && left.tuning === right.tuning
  && left.capo === right.capo
  && left.strummingPattern === right.strummingPattern
);
