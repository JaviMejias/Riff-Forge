import { CHORD_DICTIONARY } from '../chords';

export interface ChordValidationIssue {
  chord: string;
  line: number;
  offset: number;
  suggestion?: string;
}

const editDistance = (left: string, right: string) => {
  const costs = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = costs[0];
    costs[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = costs[rightIndex];
      costs[rightIndex] = Math.min(
        costs[rightIndex] + 1,
        costs[rightIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      previous = current;
    }
  }
  return costs[right.length];
};

const closestChord = (chord: string, knownChords: string[]) => {
  const normalized = chord.toLowerCase();
  const candidates = knownChords
    .map((candidate) => ({ candidate, distance: editDistance(normalized, candidate.toLowerCase()) }))
    .sort((left, right) => left.distance - right.distance || left.candidate.localeCompare(right.candidate));
  return candidates[0]?.distance <= 2 ? candidates[0].candidate : undefined;
};

export const validateChordProChords = (content: string, customChordNames: string[] = []): ChordValidationIssue[] => {
  const knownChords = [...new Set([...CHORD_DICTIONARY.map((chord) => chord.name), ...customChordNames])];
  const knownNames = new Set(knownChords.map((name) => name.toLowerCase()));
  const issues: ChordValidationIssue[] = [];
  let absoluteOffset = 0;
  let isTabBlock = false;

  content.split('\n').forEach((line, lineIndex) => {
    if (/^\s*\{start_of_tab(?::[^}]*)?}/i.test(line)) isTabBlock = true;
    if (!isTabBlock && !/^\s*\{/.test(line)) {
      for (const match of line.matchAll(/\[([^\]\n]+)]/g)) {
        const chord = match[1].trim();
        const mainChord = chord.split('/')[0];
        const isKnown = knownNames.has(chord.toLowerCase()) || knownNames.has(mainChord.toLowerCase());
        if (!isKnown) {
          issues.push({
            chord,
            line: lineIndex + 1,
            offset: absoluteOffset + (match.index || 0),
            suggestion: closestChord(mainChord, knownChords)
          });
        }
      }
    }
    if (/^\s*\{end_of_tab}/i.test(line)) isTabBlock = false;
    absoluteOffset += line.length + 1;
  });

  return issues;
};
