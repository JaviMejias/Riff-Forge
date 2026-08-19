import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, LogIn, Loader2, Music, UserPlus } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignup && !name)) {
      Toast.fire({ icon: 'warning', title: 'Faltan datos' });
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password, isSignup, name);
    } catch (error: unknown) {
      Toast.fire({ icon: 'error', title: error instanceof Error ? error.message : 'Hubo un error al iniciar sesión' });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] w-full bg-zinc-950 text-zinc-100 overflow-x-hidden overflow-y-auto font-sans items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-900/20 via-zinc-950 to-zinc-950 px-3 py-[max(0.75rem,env(safe-area-inset-top))] relative">
      
      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-700/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-auto"
      >
        <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative">
          
          {/* Header */}
          <div className="px-5 pt-6 pb-3 sm:p-8 sm:pb-4 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mx-auto flex items-center justify-center mb-4 sm:mb-6 shadow-[0_0_30px_rgba(251,146,60,0.3)]">
              <Music size={28} className="text-zinc-950 sm:w-8 sm:h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-1 sm:mb-2">Riff Forge</h1>
            <p className="text-zinc-400 text-sm">
              {isSignup ? 'Únete y sincroniza tu música en la nube' : 'Ingresa a tu biblioteca musical'}
            </p>
          </div>

          <div className="mx-4 sm:mx-8 mt-2 grid grid-cols-2 gap-1 p-1 bg-zinc-950/60 border border-white/5 rounded-2xl" role="tablist" aria-label="Tipo de acceso">
            <button
              type="button"
              onClick={() => setIsSignup(false)}
              className={`min-h-11 rounded-xl text-sm font-bold transition-all ${!isSignup ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              aria-selected={!isSignup}
              role="tab"
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setIsSignup(true)}
              className={`min-h-11 rounded-xl text-sm font-bold transition-all ${isSignup ? 'bg-primary-500 text-zinc-950 shadow-[0_0_15px_var(--theme-glow)]' : 'text-zinc-500 hover:text-zinc-300'}`}
              aria-selected={isSignup}
              role="tab"
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-4 pt-4 pb-5 sm:p-8 sm:pt-4 flex flex-col gap-4 sm:gap-5">
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
                    className="w-full min-h-12 bg-zinc-950/50 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all"
                    placeholder="Juan Perez"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  autoComplete={isSignup ? "off" : "email"}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-12 bg-zinc-950/50 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all"
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-12 bg-zinc-950/50 border border-white/5 rounded-xl pl-4 pr-12 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full min-h-12 py-3 sm:py-4 mt-1 sm:mt-2 justify-center text-base sm:text-lg shadow-[0_0_20px_rgba(251,146,60,0.15)] font-bold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {isSignup ? <UserPlus className="w-5 h-5 mr-2" /> : <LogIn className="w-5 h-5 mr-2" />}
                  <span>{isSignup ? 'Crear Cuenta' : 'Entrar a Riff Forge'}</span>
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
