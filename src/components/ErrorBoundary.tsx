import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mb-6 border border-rose-500/20">
            <AlertTriangle size={40} className="text-rose-500" />
          </div>
          <h1 className="text-3xl font-black text-white mb-4 tracking-tight">
            ¡Ups! Se nos rompió una cuerda...
          </h1>
          <p className="text-zinc-400 mb-8 max-w-md">
            Algo inesperado ocurrió al procesar esta vista. Si el error persiste, es posible que el archivo esté corrupto.
          </p>
          <div className="bg-zinc-900/50 border border-white/5 p-4 rounded-xl mb-8 max-w-2xl overflow-auto max-h-40 text-left w-full">
            <p className="text-sm text-rose-400 font-mono">
              {this.state.error?.toString()}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-bold transition-all"
          >
            <RefreshCw size={20} />
            Volver a la Biblioteca
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
