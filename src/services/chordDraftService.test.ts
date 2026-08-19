import { describe, expect, it } from 'vitest';
import { clearChordDraft, isSameChordDraftContent, loadChordDraft, saveChordDraft } from './chordDraftService';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
};

const content = {
  content: '[C]Canción',
  originalKey: 'C',
  tuning: 'E A D G B E',
  capo: '',
  strummingPattern: ''
};

describe('chordDraftService', () => {
  it('saves, loads and clears a draft', () => {
    const storage = createStorage();
    saveChordDraft(12, content, 123, storage);
    expect(loadChordDraft(12, storage)).toMatchObject({ ...content, sourceUpdatedAt: 123 });
    clearChordDraft(12, storage);
    expect(loadChordDraft(12, storage)).toBeNull();
  });

  it('compares all editable fields', () => {
    expect(isSameChordDraftContent(content, { ...content })).toBe(true);
    expect(isSameChordDraftContent(content, { ...content, tuning: 'Drop D' })).toBe(false);
  });
});
