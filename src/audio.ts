// Native Web Audio API implementation for playing chords
// Replaces the old Tone.js implementation to save bundle size

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

function playTone(frequency: number, startTime: number, duration: number) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);

  // Envelope
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05); // Attack
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Decay/Release

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// Map of note names to MIDI numbers
const noteToMidi = (note: string): number => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const match = note.match(/([A-G]#?)(-?\d+)/);
  if (!match) return 60; // Default C4
  
  const pitchClass = notes.indexOf(match[1]);
  const octave = parseInt(match[2], 10);
  
  return pitchClass + (octave + 1) * 12;
};

// Convert MIDI number to frequency
const midiToFreq = (midi: number): number => {
  return 440 * Math.pow(2, (midi - 69) / 12);
};

export const playChordAudio = async (frets: number[]) => {
  if (!frets || frets.length === 0) return;
  
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  
  // Standard tuning MIDI numbers: E2, A2, D3, G3, B3, E4
  const baseMidi = [40, 45, 50, 55, 59, 64];
  
  let stringIndex = 0;
  frets.forEach((fret) => {
    if (fret >= 0 && stringIndex < 6) { // Skip muted strings (-1)
      const startTime = now + (stringIndex * 0.04); 
      const midi = baseMidi[stringIndex] + fret;
      const freq = midiToFreq(midi);
      playTone(freq, startTime, 1.5);
    }
    stringIndex++;
  });
};
