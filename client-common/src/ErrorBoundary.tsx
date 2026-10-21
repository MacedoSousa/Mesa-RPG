import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Rede de segurança: se algum componente quebrar, mostra um aviso com botão
 * em vez de deixar a tela em branco. O estado da mesa continua salvo no Host.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro na interface:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-5xl">🌀</p>
        <p className="text-lg font-semibold">A Névoa embaralhou a tela.</p>
        <p className="max-w-md text-sm text-slate-300">
          Nada foi perdido: a mesa continua salva no PC do Mestre. Toque abaixo para voltar ao jogo.
        </p>
        <code className="max-w-md break-words rounded bg-white/5 px-2 py-1 text-xs text-rose-300">{this.state.error.message}</code>
        <div className="flex gap-2">
          <button className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950" onClick={() => this.setState({ error: null })}>
            Tentar continuar
          </button>
          <button className="rounded-lg bg-white/10 px-4 py-2" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
