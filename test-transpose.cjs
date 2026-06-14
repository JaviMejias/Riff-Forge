const CSJS = require('chordsheetjs');

try {
  const parser = new CSJS.UltimateGuitarParser();
  const parsedSong = parser.parse('[C]Hello [G]world');
  
  if (parsedSong.transpose) {
    const transposed = parsedSong.transpose(2); // Transpose up 2 semitones
    const formatter = new CSJS.TextFormatter();
    console.log("Original:");
    console.log(new CSJS.TextFormatter().format(parsedSong));
    console.log("Transposed:");
    console.log(formatter.format(transposed));
  } else {
    console.log('No transpose method');
  }
} catch(e) {
  console.error(e);
}
