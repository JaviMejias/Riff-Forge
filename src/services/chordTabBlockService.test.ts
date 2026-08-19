import { describe, expect, it } from 'vitest';
import { parseChordContent } from './chordProService';
import { buildChordTabBlockLayout } from './chordTabBlockService';

describe('ChordPro tablature block layout', () => {
  it('groups tab lines and preserves their label and spacing', () => {
    const song = parseChordContent('{start_of_tab: Solo}\nE|--0--3--|\nB|--0--0--|\n{end_of_tab}\n[C]Lyrics');
    const layout = buildChordTabBlockLayout(song.lines);
    const block = [...layout.blocksByStart.values()][0];

    expect(block).toEqual({ label: 'Solo', lines: ['E|--0--3--|', 'B|--0--0--|'] });
    expect(layout.blockLineIndices.size).toBe(4);
  });
});
