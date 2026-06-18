import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Loader2, Music } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuthStore } from '../store/authStore';
import { Toast } from '../utils/toast';

export const LoginView = () => {
  const { signIn } = useAuthStore();
  
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignup && !name)) {
      Toast.fire({ icon: 'warning', title: 'Faltan datos' });
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password, isSignup, name);
      Toast.fire({ icon: 'success', title: '¡Bienvenido!' });
    } catch (error: any) {
      Toast.fire({ icon: 'error', title: error.message || 'Hubo un error al iniciar sesión' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-900/20 via-zinc-950 to-zinc-950">
      
      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-700/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-auto p-6"
      >
        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative">
          
          {/* Header */}
          <div className="p-8 pb-4 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(251,146,60,0.3)]">
              <Music size={32} className="text-zinc-950" />
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-2">Riff Forge</h1>
            <p className="text-zinc-400 text-sm">
              {isSignup ? 'Únete y sincroniza tu música en la nube' : 'Ingresa a tu biblioteca musical'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 pt-4 flex flex-col gap-5">
            <AnimatePresence>
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Nombre y Apellido</label>
                  <input
                    type="text"
                    value={name}
                    required={isSignup}
                    autoComplete="off"
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950/50 border border-white/5 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all"
                    placeholder="Juan Perez"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                autoComplete={isSignup ? "off" : "email"}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950/50 border border-white/5 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Contraseña</label>
              <input
                type="password"
                value={password}
                autoComplete={isSignup ? "new-password" : "current-password"}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950/50 border border-white/5 rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all"
                placeholder="••••••••"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer mt-2 group w-max">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={isSignup}
                  onChange={(e) => setIsSignup(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-11 h-6 bg-zinc-800 rounded-full peer-checked:bg-primary-500 transition-colors border border-white/10 relative">
                  <motion.div
                    layout
                    className="absolute top-[1px] left-[1px] w-5 h-5 bg-white rounded-full shadow-md"
                    initial={false}
                    animate={{ x: isSignup ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors select-none">
                No tengo cuenta, quiero registrarme
              </span>
            </label>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-4 mt-2 justify-center text-lg shadow-[0_0_20px_rgba(251,146,60,0.15)] font-bold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  {isSignup ? 'Crear Cuenta' : 'Entrar a Riff Forge'}
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
