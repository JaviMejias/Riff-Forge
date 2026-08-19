import { describe, expect, it } from 'vitest';
import type { Song } from '../db';
import { findDuplicateSong, normalizeSongIdentityPart } from './songDuplicateService';

const song = (id: number, name: string, artist: string): Song => ({ id, name, artist, dateAdded: 1 });

describe('song duplicate detection', () => {
  it('ignores casing, accents, punctuation and repeated whitespace', () => {
    expect(normalizeSongIdentityPart('  Canción:  de Mí ')).toBe('cancion de mi');
    expect(findDuplicateSong(
      [song(1, 'Tu falta de querer', 'Mon Laferte')],
      'TU FALTA  DE QUERER!',
      'Món Laferte'
    )?.id).toBe(1);
  });

  it('does not merge songs by different artists', () => {
    expect(findDuplicateSong(
      [song(1, 'Hallelujah', 'Leonard Cohen')],
      'Hallelujah',
      'Jeff Buckley'
    )).toBeUndefined();
  });

  it('can exclude the song currently being edited', () => {
    expect(findDuplicateSong([song(1, 'Song', 'Artist')], 'Song', 'Artist', 1)).toBeUndefined();
  });
});
