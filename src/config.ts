// URL de tu servidor backend.
// Las peticiones locales (y en ngrok) usarán el proxy definido en vite.config.ts hacia Oracle Cloud
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
