import { describe, expect, it } from 'vitest';
import { validateChordProChords } from './chordValidationService';

describe('ChordPro chord validation', () => {
  it('reports unknown chords with their line and a close suggestion', () => {
    expect(validateChordProChords('{title: Song}\n[C]Line\n[F#mm]Other')).toEqual([
      { chord: 'F#mm', line: 3, offset: 22, suggestion: 'F#m' }
    ]);
  });

  it('accepts slash chords and user-defined chords', () => {
    expect(validateChordProChords('[C/E]Line [Custom]end', ['Custom'])).toEqual([]);
  });

  it('ignores brackets inside tablature blocks', () => {
    expect(validateChordProChords('{start_of_tab}\nE|--[12]--|\n{end_of_tab}')).toEqual([]);
  });
});
