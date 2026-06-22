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
  
  public clear() {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}

class StreamSource {
  private inFifo: Float32Fifo;
  constructor(inFifo: Float32Fifo) {
    this.inFifo = inFifo;
  }
  extract(target: Float32Array, numFrames: number, _position: number) {
    return this.inFifo.pop(target, numFrames);
  }
}

export class SoundTouchNode {
  public node: AudioNode;
  
  // Worklet mode state
  private isWorklet: boolean = false;
  
  // ScriptProcessor fallback state
  private soundTouch: any;
  private filter: any;
  private inFifo: Float32Fifo | null = null;
  
  private constructor(node: AudioNode, isWorklet: boolean) {
    this.node = node;
    this.isWorklet = isWorklet;
  }

  static async create(context: AudioContext): Promise<SoundTouchNode> {
    // Intenta inicializar el AudioWorklet (rendimiento nativo)
    if (context.audioWorklet) {
      try {
        await context.audioWorklet.addModule('/soundtouch-processor.js');
        const workletNode = new AudioWorkletNode(context, 'soundtouch-processor', {
          outputChannelCount: [2]
        });
        console.log("SoundTouch initialized using AudioWorkletNode");
        return new SoundTouchNode(workletNode, true);
      } catch (err) {
        console.error("Failed to load AudioWorklet, falling back to ScriptProcessor", err);
      }
    }
    
    // Fallback: ScriptProcessorNode (deprecated, pero compatible)
    const bufferSize = 8192;
    const scriptNode = context.createScriptProcessor(bufferSize, 2, 2);
    const instance = new SoundTouchNode(scriptNode, false);
    instance.initScriptProcessor(context, bufferSize);
    console.log("SoundTouch initialized using ScriptProcessorNode fallback");
    return instance;
  }
  
  private initScriptProcessor(context: AudioContext, bufferSize: number) {
    this.soundTouch = new SoundTouch();
    this.soundTouch.pitch = 1.0;
    this.soundTouch.rate = 1.0;
    this.soundTouch.tempo = 1.0;
    
    if (this.soundTouch.stretch && this.soundTouch.stretch.sampleRate) {
        this.soundTouch.stretch.sampleRate = context.sampleRate;
    }
    
    this.inFifo = new Float32Fifo(bufferSize * 2 * 10);
    const source = new StreamSource(this.inFifo);
    this.filter = new SimpleFilter(source, this.soundTouch);

    (this.node as ScriptProcessorNode).onaudioprocess = (e) => {
      try {
        const inputLeft = e.inputBuffer.getChannelData(0);
        const inputRight = e.inputBuffer.getChannelData(1);
        const outputLeft = e.outputBuffer.getChannelData(0);
        const outputRight = e.outputBuffer.getChannelData(1);
        const numFrames = inputLeft.length;
        
        const inSamples = new Float32Array(numFrames * 2);
        for (let i = 0; i < numFrames; i++) {
          inSamples[i * 2] = inputLeft[i];
          inSamples[i * 2 + 1] = inputRight[i];
        }
        
        if (this.inFifo) this.inFifo.push(inSamples);
        
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
      } catch (err) {
        console.error("Error in SoundTouch ScriptProcessor:", err);
      }
    };
  }
  
  public setPitch(semitones: number) {
    if (this.isWorklet) {
      (this.node as AudioWorkletNode).port.postMessage({ type: 'SET_PITCH', pitch: semitones });
    } else {
      if (this.soundTouch) {
        this.soundTouch.pitch = Math.pow(2, semitones / 12);
      }
    }
  }
  
  public connect(destination: AudioNode) {
    this.node.connect(destination);
  }
  
  public disconnect() {
    this.node.disconnect();
  }
  
  public dispose() {
    this.disconnect();
    if (!this.isWorklet) {
      if (this.soundTouch) this.soundTouch.clear();
      if (this.filter) this.filter.clear();
      if (this.inFifo) this.inFifo.clear();
    }
  }
}
