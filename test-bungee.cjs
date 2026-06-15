const fs = require('fs');

// Create a dummy environment to load the Emscripten module
globalThis.window = globalThis;
globalThis.WorkerGlobalScope = globalThis;

// Load the script
const code = fs.readFileSync('./public/bungee-processor-bundled.js', 'utf8');

// The file exports createBungeeModule as default, but in CommonJS we can just eval the glue code
// Actually, let's just use import() if possible, or eval it.
const BungeeCode = code.substring(0, code.indexOf('/* ===== AUDIOWORKLET PROCESSOR ===== */'));
eval(BungeeCode);

createBungeeModule().then(module => {
    console.log("Exports:", Object.keys(module));
}).catch(console.error);
