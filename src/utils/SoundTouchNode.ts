// @ts-ignore
import { SoundTouch } from 'soundtouchjs';

export class SoundTouchNode {
  public node: ScriptProcessorNode;
  private soundTouch: any;

  private outFifo: Float32Array;
  private fifoHead: number = 0;
  private fifoTail: number = 0;
  private fifoCount: number = 0;
  
  constructor(context: AudioContext, bufferSize: number = 4096) {
    // Usamos ScriptProcessorNode (deprecated pero la única opción sin AudioWorklet)
    this.node = context.createScriptProcessor(bufferSize, 2, 2);
    this.soundTouch = new SoundTouch();
    
    // Configuración base de SoundTouch para mantener el tiempo original
    this.soundTouch.pitch = 1.0;
    this.soundTouch.rate = 1.0;
    this.soundTouch.tempo = 1.0;
    
    // FIFO circular grande (3x bufferSize estéreo) para absorber las fluctuaciones de latencia del algoritmo WSOLA
    const fifoCapacity = bufferSize * 2 * 3; 
    this.outFifo = new Float32Array(fifoCapacity);

    this.node.onaudioprocess = (e) => {
      const inputLeft = e.inputBuffer.getChannelData(0);
      const inputRight = e.inputBuffer.getChannelData(1);
      const outputLeft = e.outputBuffer.getChannelData(0);
      const outputRight = e.outputBuffer.getChannelData(1);
      const numFrames = inputLeft.length;
      
      // Entrelazar L y R
      const inSamples = new Float32Array(numFrames * 2);
      for (let i = 0; i < numFrames; i++) {
        inSamples[i * 2] = inputLeft[i];
        inSamples[i * 2 + 1] = inputRight[i];
      }
      
      // Alimentar el motor
      this.soundTouch.putSamples(inSamples);
      
      // Extraer lo que el motor haya podido procesar
      // WSOLA no siempre devuelve numFrames exactos, por eso usamos un FIFO
      const chunk = new Float32Array(numFrames * 2);
      const framesReceived = this.soundTouch.receiveSamples(chunk, numFrames);
      
      // Guardar en el FIFO
      const samplesReceived = framesReceived * 2;
      for (let i = 0; i < samplesReceived; i++) {
        if (this.fifoCount < fifoCapacity) {
          this.outFifo[this.fifoTail] = chunk[i];
          this.fifoTail = (this.fifoTail + 1) % fifoCapacity;
          this.fifoCount++;
        }
      }
      
      // Leer del FIFO para llenar exactamente el outputBuffer
      const samplesNeeded = numFrames * 2;
      const readBuffer = new Float32Array(samplesNeeded);
      
      let readCount = 0;
      while (readCount < samplesNeeded && this.fifoCount > 0) {
        readBuffer[readCount] = this.outFifo[this.fifoHead];
        this.fifoHead = (this.fifoHead + 1) % fifoCapacity;
        this.fifoCount--;
        readCount++;
      }
      
      // Desentrelazar a la salida
      for (let i = 0; i < numFrames; i++) {
        // Si no hay suficientes muestras, el readBuffer ya tiene ceros por defecto
        outputLeft[i] = readBuffer[i * 2];
        outputRight[i] = readBuffer[i * 2 + 1];
      }
    };
  }
  
  public setPitch(semitones: number) {
    // SoundTouch usa un ratio para el pitch (+12 = 2.0, -12 = 0.5)
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
  }
}
