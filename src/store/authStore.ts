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

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
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
      if (!res.ok) throw new Error(data.error || 'Error de autenticación');

      localStorage.setItem('riff_token', data.token);
      set({ user: data.user, token: data.token });

      // Automatically sync down data on successful login
      try {
        const { SyncService } = await import('../services/syncService');
        await SyncService.downloadAllFromCloud();
      } catch (err) {
        console.error("Error auto-syncing after login", err);
      }
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
      set({ user: null, token: null });

      // Clear local database to protect privacy
      const { db } = await import('../db');
      await db.transaction('rw', [db.songs, db.playlists, db.customChords, db.karaokes, db.karaokePlaylists, db.karaokeFiles], async () => {
        await db.songs.clear();
        await db.playlists.clear();
        await db.customChords.clear();
        await db.karaokes.clear();
        await db.karaokePlaylists.clear();
        await db.karaokeFiles.clear();
      });

      // FE-7 fix: only remove keys this app owns — localStorage.clear() also wipes
      // browser extension data and unrelated app data on the same origin.
      const APP_KEYS = ['riff_token', 'lastSyncAt', 'deleted_cloud_ids', 'ui-storage'];
      APP_KEYS.forEach(key => localStorage.removeItem(key));

      await Swal.fire({ 
        icon: 'success', 
        title: 'Sesión cerrada', 
        text: 'Tus datos se guardaron correctamente.',
        background: '#18181b',
        color: '#f4f4f5',
        timer: 1500,
        showConfirmButton: false
      });
      
      const { useUiStore } = await import('../store/uiStore');
      useUiStore.getState().setTheme('amber');
      
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
        set({ user: data.user, loading: false });
      } else {
        throw new Error('Token inválido');
      }
    } catch (error) {
      localStorage.removeItem('riff_token');
      set({ user: null, token: null, loading: false });
    }
  }
}));

// Initialize token verification
useAuthStore.getState().verifyToken();
