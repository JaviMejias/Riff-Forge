let audioCtx: AudioContext | null = null;

// Base frequencies for standard tuning strings: E2, A2, D3, G3, B3, E4
const STRING_FREQUENCIES = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

export const playChordAudio = async (frets: number[]) => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // Ensure context is active (browsers suspend it until user interaction)
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  
  // Strumming speed (seconds between each string pick)
  const strumDelay = 0.03;

  frets.forEach((fret, stringIndex) => {
    // -1 means muted string, don't play
    if (fret === -1) return;

    // Calculate the actual frequency of the fretted note
    const baseFreq = STRING_FREQUENCIES[stringIndex];
    const freq = baseFreq * Math.pow(2, fret / 12);

    // Create an oscillator
    const osc = audioCtx!.createOscillator();
    // Sawtooth has rich harmonics like a string, but needs to be filtered so it's not too buzzy
    osc.type = 'sawtooth'; 
    osc.frequency.value = freq;

    // Create a lowpass filter to simulate the body and pluck of the guitar
    const filter = audioCtx!.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.2; // Slight resonance
    
    // Create an envelope using a GainNode
    const gainNode = audioCtx!.createGain();
    
    // Connect nodes: osc -> filter -> gain -> destination
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx!.destination);

    // Schedule the strum
    const startTime = now + (stringIndex * strumDelay);
    
    // Filter envelope: Start bright (pluck) and decay rapidly to simulate string damping
    filter.frequency.setValueAtTime(Math.min(freq * 10, 20000), startTime);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + 0.5);

    // Amplitude envelope: sharp attack, exponential decay
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.015); // Quick Attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0); // Decay over 2 seconds

    // Start and stop the oscillator
    osc.start(startTime);
    osc.stop(startTime + 2.1);
  });
};
