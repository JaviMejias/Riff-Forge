declare module 'soundtouchjs' {
  export interface SoundTouchInstance {
    pitch: number;
    rate: number;
    tempo: number;
    stretch?: {
      sampleRate?: number;
    };
    clear: () => void;
  }

  export interface SoundTouchSource {
    extract: (target: Float32Array, numFrames: number, position?: number) => number;
  }

  export class SoundTouch implements SoundTouchInstance {
    pitch: number;
    rate: number;
    tempo: number;
    stretch?: {
      sampleRate?: number;
    };
    clear(): void;
  }

  export class SimpleFilter {
    constructor(source: SoundTouchSource, soundTouch: SoundTouchInstance);
    extract(target: Float32Array, numFrames: number): number;
    clear(): void;
  }
}
