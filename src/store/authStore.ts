import { create } from 'zustand';
import { API_BASE_URL } from '../config'; // FE-1: use central config


interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string, isSignup: boolean, name?: string) => Promise<void>;
  logOut: () => Promise<void>;
  verifyToken: () => Promise<void>;
}

const API_URL = `${API_BASE_URL}/api`;
const CACHED_USER_KEY = 'riff_user';
const SYNC_RETRY_AT_KEY = 'sync_retry_at';

const getCachedUser = (): User | null => {
  try {
    const value = localStorage.getItem(CACHED_USER_KEY);
    return value ? JSON.parse(value) as User : null;
  } catch {
    localStorage.removeItem(CACHED_USER_KEY);
    return null;
  }
};

const cacheUser = (user: User) => localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: getCachedUser(),
  token: localStorage.getItem('riff_token'),
  loading: true,

  signIn: async (email, password, isSignup, name) => {
      const endpoint = isSignup ? '/auth/signup' : '/auth/login';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      const data = await res.json();
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
        localStorage.setItem(SYNC_RETRY_AT_KEY, String(Date.now() + retryAfter * 1000));
        const minutes = Math.max(1, Math.ceil(retryAfter / 60));
        throw new Error(`Demasiadas solicitudes. Intenta nuevamente en ${minutes} minuto${minutes === 1 ? '' : 's'}.`);
      }
      if (!res.ok) throw new Error(data.error || 'Error de autenticación');

      localStorage.setItem('riff_token', data.token);
      cacheUser(data.user);
      set({ user: data.user, token: data.token });
  },

  logOut: async () => {
    const Swal = (await import('sweetalert2')).default;
    const result = await Swal.fire({
      title: '¿Cerrar Sesión?',
      text: '¿Seguro que quieres cerrar tu sesión en Riff Forge?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      background: '#18181b',
      color: '#f4f4f5',
    });

    if (result.isConfirmed) {
      // Show closing progress
      Swal.fire({
        title: 'Cerrando sesión...',
        text: 'Por favor espera',
        allowOutsideClick: false,
        background: '#18181b',
        color: '#f4f4f5',
        didOpen: () => {
          Swal.showLoading();
        }
      });

      try {
        const { SyncService } = await import('../services/syncService');
        // Do a quick differential sync just in case there are pending changes from the last 3 seconds
        await SyncService.performAutoSync();
      } catch (err) {
        console.error("Error auto-syncing on logout", err);
      }

      localStorage.removeItem('riff_token');
      localStorage.removeItem(CACHED_USER_KEY);
      set({ user: null, token: null });

      await Swal.fire({ 
        icon: 'success', 
        title: 'Sesión cerrada', 
        text: 'Tus datos locales permanecen guardados en este dispositivo.',
        background: '#18181b',
        color: '#f4f4f5',
        timer: 1500,
        showConfirmButton: false
      });
      
      window.dispatchEvent(new Event('auth-logout'));
    }
  },

  verifyToken: async () => {
    const token = get().token;
    if (!token) {
      set({ loading: false });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        cacheUser(data.user);
        set({ user: data.user, loading: false });
        
        // Auto sync incremental changes when opening the app
        try {
          const { SyncService } = await import('../services/syncService');
          await SyncService.performAutoSync();
        } catch (err) {
          console.error("Error auto-syncing on app load", err);
        }
      } else if (res.status === 401 || res.status === 403) {
        throw new Error('Token inválido');
      } else {
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
          localStorage.setItem(SYNC_RETRY_AT_KEY, String(Date.now() + retryAfter * 1000));
        }
        // Temporary server/rate-limit errors must not destroy a valid local session.
        set({ loading: false });
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Token inválido') {
        localStorage.removeItem('riff_token');
        localStorage.removeItem(CACHED_USER_KEY);
        set({ user: null, token: null, loading: false });
        window.dispatchEvent(new Event('auth-logout'));
      } else {
        console.error('No se pudo verificar la sesión temporalmente', error);
        set({ loading: false });
      }
    }
  }
}));

// Initialize token verification
useAuthStore.getState().verifyToken();
