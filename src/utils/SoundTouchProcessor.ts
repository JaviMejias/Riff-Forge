// @ts-ignore
import { SoundTouch, SimpleFilter } from 'soundtouchjs';

class Float32Fifo {
  private buffer: Float32Array;
  private head: number = 0;
  private tail: number = 0;
  public count: number = 0;

  constructor(capacity: number) {
    this.buffer = new Float32Array(capacity);
  }

  public push(samples: Float32Array) {
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.tail] = samples[i];
      this.tail = (this.tail + 1) % this.buffer.length;
      this.count++;
    }
  }

  public pop(target: Float32Array, numFrames: number): number {
    const samplesToRead = numFrames * 2; // Stereo
    const actualRead = Math.min(samplesToRead, this.count);
    for (let i = 0; i < actualRead; i++) {
      target[i] = this.buffer[this.head];
      this.head = (this.head + 1) % this.buffer.length;
      this.count--;
    }
    return actualRead / 2;
  }
}

class StreamSource {
  private inFifo: Float32Fifo;
  constructor(inFifo: Float32Fifo) {
    this.inFifo = inFifo;
  }
  extract(target: Float32Array, numFrames: number) {
    return this.inFifo.pop(target, numFrames);
  }
}

class SoundTouchProcessor extends AudioWorkletProcessor {
  private soundTouch: any;
  private filter: any;
  private inFifo: Float32Fifo;
  
  constructor(options: any) {
    super();
    this.soundTouch = new SoundTouch();
    this.soundTouch.pitch = 1.0;
    this.soundTouch.rate = 1.0;
    this.soundTouch.tempo = 1.0;
    
    if (options && options.processorOptions && options.processorOptions.sampleRate) {
      if (this.soundTouch.stretch) {
        this.soundTouch.stretch.sampleRate = options.processorOptions.sampleRate;
      }
    }
    
    this.inFifo = new Float32Fifo(32768 * 2);
    const source = new StreamSource(this.inFifo);
    this.filter = new SimpleFilter(source, this.soundTouch);
    
    this.port.onmessage = (e) => {
      if (e.data.type === 'SET_PITCH') {
        this.soundTouch.pitch = Math.pow(2, e.data.pitch / 12);
      }
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const inputLeft = input[0];
    const inputRight = input.length > 1 ? input[1] : input[0];
    const outputLeft = output[0];
    const outputRight = output.length > 1 ? output[1] : output[0];
    const numFrames = inputLeft.length;

    const inSamples = new Float32Array(numFrames * 2);
    for (let i = 0; i < numFrames; i++) {
      inSamples[i * 2] = inputLeft[i];
      inSamples[i * 2 + 1] = inputRight[i];
    }
    
    this.inFifo.push(inSamples);
    
    const outSamples = new Float32Array(numFrames * 2);
    const framesExtracted = this.filter.extract(outSamples, numFrames);
    
    for (let i = 0; i < framesExtracted; i++) {
      outputLeft[i] = outSamples[i * 2];
      outputRight[i] = outSamples[i * 2 + 1];
    }
    
    for (let i = framesExtracted; i < numFrames; i++) {
      outputLeft[i] = 0;
      outputRight[i] = 0;
    }
    
    return true;
  }
}

registerProcessor('soundtouch-processor', SoundTouchProcessor);
