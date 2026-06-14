import { UltimateGuitarParser } from 'chordsheetjs';
try {
  const parser = new UltimateGuitarParser();
  console.log('Parser instance created:', !!parser);
  const result = parser.parse('A\nHello');
  console.log('Lines parsed:', result.lines.length);
} catch (e) {
  console.error('Error during parse:', e);
}
