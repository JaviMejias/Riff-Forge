import * as Tone from 'tone';

// Creamos un medidor global único para toda la aplicación
export const globalAudioMeter = new Tone.Meter();

// Función auxiliar para conectar cualquier nodo de audio al medidor global
export const connectToGlobalMeter = (node: Tone.ToneAudioNode | AudioNode) => {
  try {
    Tone.connect(node, globalAudioMeter);
  } catch (e) {
    console.error("Error conectando al medidor global:", e);
  }
};
