const CSJS = require('chordsheetjs');

try {
  const chord = CSJS.Chord.parse('C');
  console.log(chord.transpose(2).toString());
  console.log(chord.transpose(-2).toString());
} catch(e) {
  console.error(e);
}
