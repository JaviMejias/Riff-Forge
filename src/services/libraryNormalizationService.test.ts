import { describe, expect, it } from 'vitest';
import type { Song } from '../db';
import { buildLibraryNormalizationPlan } from './libraryNormalizationService';

describe('library metadata normalization', () => {
  it('prepares changes without mutating the original songs', () => {
    const song: Song = {
      id: 1,
      name: ' Título:  Song ',
      artist: 'Artista: Artist',
      originalKey: 'f♯ menor',
      tuning: 'E-A-D-G-B-E',
      textContent: '{title: Old}\n{key: C}\n[C]Lyrics',
      dateAdded: 1
    };

    const [change] = buildLibraryNormalizationPlan([song]);

    expect(change.updates).toMatchObject({
      name: 'Song',
      artist: 'Artist',
      originalKey: 'F#m',
      tuning: 'Estándar'
    });
    expect(change.updates.textContent).toContain('{title: Song}');
    expect(change.updates.textContent).toContain('{key: F#m}');
    expect(song.name).toBe(' Título:  Song ');
  });

  it('does not include songs that are already normalized and synchronized', () => {
    const song: Song = {
      id: 1,
      name: 'Song',
      artist: 'Artist',
      originalKey: 'C',
      tuning: 'Estándar',
      textContent: '{title: Song}\n{artist: Artist}\n{key: C}\n{tuning: Estándar}\n[C]Lyrics',
      dateAdded: 1
    };

    expect(buildLibraryNormalizationPlan([song])).toEqual([]);
  });
});
