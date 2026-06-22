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
    // Return the number of frames actually read
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
  
  // Interfaz esperada por SimpleFilter
  extract(target: Float32Array, numFrames: number, _position: number) {
    return this.inFifo.pop(target, numFrames);
  }
}

export class SoundTouchNode {
  public node: ScriptProcessorNode;
  private soundTouch: any;
  private filter: any;
  private inFifo: Float32Fifo;
  
  constructor(context: AudioContext, bufferSize: number = 8192) {
    this.node = context.createScriptProcessor(bufferSize, 2, 2);
    this.soundTouch = new SoundTouch();
    
    // Configuración WSOLA (pitch/tempo independent)
    this.soundTouch.pitch = 1.0;
    this.soundTouch.rate = 1.0;
    this.soundTouch.tempo = 1.0;
    
    // Configurar sample rate explícitamente si está disponible
    if (this.soundTouch.stretch && this.soundTouch.stretch.sampleRate) {
        this.soundTouch.stretch.sampleRate = context.sampleRate;
    }
    
    // Capacidad para 10 chunks de 4096 (aprox 1 segundo de buffer de seguridad)
    this.inFifo = new Float32Fifo(bufferSize * 2 * 10);
    const source = new StreamSource(this.inFifo);
    
    // SimpleFilter se encarga de manejar el ruteo interno de los buffers (fillOutputBuffer, process, etc)
    this.filter = new SimpleFilter(source, this.soundTouch);

    this.node.onaudioprocess = (e) => {
      try {
        const inputLeft = e.inputBuffer.getChannelData(0);
        const inputRight = e.inputBuffer.getChannelData(1);
        const outputLeft = e.outputBuffer.getChannelData(0);
        const outputRight = e.outputBuffer.getChannelData(1);
        const numFrames = inputLeft.length;
        
        // Entrelazar la entrada
        const inSamples = new Float32Array(numFrames * 2);
        for (let i = 0; i < numFrames; i++) {
          inSamples[i * 2] = inputLeft[i];
          inSamples[i * 2 + 1] = inputRight[i];
        }
        
        // Empujar las muestras recibidas desde Web Audio al FIFO de entrada
        this.inFifo.push(inSamples);
        
        // Pedirle al filtro que extraiga exactamente los frames que necesitamos
        // SimpleFilter automáticamente tirará del StreamSource (y por tanto del inFifo),
        // llamará a process() cuando tenga suficientes, y nos dará el resultado.
        const outSamples = new Float32Array(numFrames * 2);
        const framesExtracted = this.filter.extract(outSamples, numFrames);
        
        // Desentrelazar a la salida
        for (let i = 0; i < framesExtracted; i++) {
          outputLeft[i] = outSamples[i * 2];
          outputRight[i] = outSamples[i * 2 + 1];
        }
        
        // Si SimpleFilter devolvió menos frames de los necesarios (ej. llenando buffers iniciales)
        // se rellenan con silencio para evitar clicks.
        for (let i = framesExtracted; i < numFrames; i++) {
          outputLeft[i] = 0;
          outputRight[i] = 0;
        }
        
      } catch (err) {
        console.error("Error in SoundTouch onaudioprocess:", err);
      }
    };
  }
  
  public setPitch(semitones: number) {
    this.soundTouch.pitch = Math.pow(2, semitones / 12);
  }
  
  public connect(destination: AudioNode) {
    this.node.connect(destination);
  }
  
  public disconnect() {
    this.node.disconnect();
  }
  
  public dispose() {
    this.disconnect();
    this.soundTouch.clear();
    if (this.filter) this.filter.clear();
    this.inFifo.clear();
  }
}
