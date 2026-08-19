import ChordSheetJS from 'chordsheetjs';

const CSJS = ChordSheetJS;

export interface ChordTabBlock {
  label: string;
  lines: string[];
}

interface ChordSheetLineLike {
  items: unknown[];
}

export const buildChordTabBlockLayout = (lines: ChordSheetLineLike[]) => {
  const blocksByStart = new Map<number, ChordTabBlock>();
  const blockLineIndices = new Set<number>();
  let openBlock: { startIndex: number; label: string; lines: string[] } | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const tags = line.items.filter((item) => item instanceof CSJS.Tag);
    const startTag = tags.find((tag) => tag.name === 'start_of_tab');
    const isEnd = tags.some((tag) => tag.name === 'end_of_tab');
    if (startTag) {
      openBlock = { startIndex: lineIndex, label: startTag.value || 'Tablatura', lines: [] };
      blockLineIndices.add(lineIndex);
      continue;
    }
    if (!openBlock) continue;
    blockLineIndices.add(lineIndex);
    if (isEnd) {
      blocksByStart.set(openBlock.startIndex, { label: openBlock.label, lines: openBlock.lines });
      openBlock = null;
      continue;
    }
    const text = line.items.map((item) => {
      if (item instanceof CSJS.Literal) return item.string;
      if (item instanceof CSJS.ChordLyricsPair) return `${item.chords || ''}${item.lyrics || ''}`;
      return '';
    }).join('');
    if (text) openBlock.lines.push(text);
  }

  if (openBlock) blocksByStart.set(openBlock.startIndex, { label: openBlock.label, lines: openBlock.lines });
  return { blocksByStart, blockLineIndices };
};
