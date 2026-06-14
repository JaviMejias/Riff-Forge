import ChordSheetJS from 'chordsheetjs';

const CSJS = (ChordSheetJS as any).default || ChordSheetJS;

try {
  const parser = new CSJS.UltimateGuitarParser();
  const parsedSong = parser.parse('[C]Hello [G]world');
  
  // Try transposition
  if (parsedSong.transpose) {
    const transposed = parsedSong.transpose(2); // Transpose up 2 semitones (C -> D, G -> A)
    const formatter = new CSJS.TextFormatter();
    console.log(formatter.format(transposed));
  } else {
    console.log('No transpose method found directly on song, checking other options');
  }
} catch(e) {
  console.error(e);
}
