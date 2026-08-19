import { describe, expect, it } from 'vitest';
import { chordProFilename, exportChordPro, importChordPro, isChordProContent, normalizeChordPro, parseChordContent } from './chordProService';

describe('chordProService', () => {
  it('imports lyrics, chords, sections and metadata', () => {
    const imported = importChordPro('{key: G}\n{capo: 2}\n{start_of_chorus}\n[G]Hola [D]mundo\n{end_of_chorus}');

    expect(imported.content).toContain('{start_of_chorus}');
    expect(imported.content).toContain('[G]Hola [D]mundo');
    expect(imported.metadata).toMatchObject({ key: 'G', capo: '2' });
  });

  it('exports metadata without duplicating existing directives', () => {
    const exported = exportChordPro('{key: C}\n[C]Una canción', {
      title: 'Prueba',
      artist: 'Artista',
      key: 'G'
    });

    expect(exported).toContain('{title: Prueba}');
    expect(exported).toContain('{artist: Artista}');
    expect(exported.match(/\{key:/g)).toHaveLength(1);
  });

  it('selects the appropriate parser for inline and over-lyrics chords', () => {
    expect(isChordProContent('[C]Hola')).toBe(true);
    expect(isChordProContent('C    G\nHola mundo')).toBe(false);
    expect(parseChordContent('[C]Hola').lines).toHaveLength(1);
    expect(parseChordContent('C    G\nHola mundo').lines.length).toBeGreaterThan(0);
    expect(normalizeChordPro('C    G\nHola mundo')).toContain('[C]Hola');
  });

  it('creates a filesystem-safe filename', () => {
    expect(chordProFilename('Mi: canción?', 'Artista/Test')).toBe('ArtistaTest - Mi canción.chopro');
  });

  it('rejects files without musical content', () => {
    expect(() => importChordPro('{title: Vacía}')).toThrow('INVALID_CHORD_PRO');
  });
});
