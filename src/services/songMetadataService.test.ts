import { describe, expect, it } from 'vitest';
import { assessSongMetadata, normalizeMusicalKey, normalizeSongMetadata, normalizeTuning } from './songMetadataService';
import { exportChordPro, synchronizeChordProMetadata } from './chordProService';

describe('song metadata normalization', () => {
  it('cleans whitespace and repeated labels without changing names', () => {
    expect(normalizeSongMetadata({
      title: '  Título: Título:\u00a0500   Miles ',
      artist: 'Artista: Peter,  Paul & Mary',
      composer: 'Composición de: Hedy West'
    })).toMatchObject({ title: '500 Miles', artist: 'Peter, Paul & Mary', composer: 'Hedy West' });
  });

  it('normalizes safe key variants', () => {
    expect(normalizeMusicalKey('Tono: f♯ menor')).toBe('F#m');
    expect(normalizeMusicalKey('b♭ major')).toBe('Bb');
    expect(normalizeMusicalKey('Afinación abierta')).toBe('Afinación abierta');
  });

  it('normalizes standard, drop and note-list tunings', () => {
    expect(normalizeTuning('E-A-D-G-B-E')).toBe('Estándar');
    expect(normalizeTuning('standard')).toBe('Estándar');
    expect(normalizeTuning('drop d')).toBe('Drop D');
    expect(normalizeTuning('d a d g a d')).toBe('D A D G A D');
  });

  it('keeps exported ChordPro directives synchronized with saved metadata', () => {
    const exported = exportChordPro('{title: Old title}\n{key: C}\n[C]Lyrics', {
      title: 'New title',
      key: 'D'
    });

    expect(exported).toContain('{title: New title}');
    expect(exported).toContain('{key: D}');
    expect(exported).not.toContain('Old title');
    expect(exported).not.toContain('{key: C}');
  });

  it('updates stored directives and removes metadata that was cleared', () => {
    const synchronized = synchronizeChordProMetadata('{title: Old}\n{artist: Artist}\n{key: C}\n[C]Lyrics', {
      title: 'New',
      artist: 'Artist',
      key: undefined
    });

    expect(synchronized).toContain('{title: New}');
    expect(synchronized).toContain('{artist: Artist}');
    expect(synchronized).not.toContain('{title: Old}');
    expect(synchronized).not.toContain('{key: C}');
  });

  it('marks missing and unusual imported fields for review', () => {
    expect(assessSongMetadata({ title: 'Song', key: 'Do mayor', tuning: 'Open mystery' }))
      .toEqual([
        { field: 'title', label: 'Título', status: 'detected' },
        { field: 'artist', label: 'Artista', status: 'missing' },
        { field: 'key', label: 'Tono', status: 'review' },
        { field: 'tuning', label: 'Afinación', status: 'review' }
      ]);
  });
});
