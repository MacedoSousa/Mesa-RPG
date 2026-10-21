import { useState, type FormEvent } from 'react';
import { Auth, errorMessage } from './api';
import { toast } from './stores';
import { Button, Card, Field, Tabs } from './ui';

/** Tela de Login/Cadastro usada pelos dois clientes. */
export function AuthScreen({ title, subtitle, allowMasterCode, inviteCode }: { title: string; subtitle: string; allowMasterCode?: boolean; inviteCode?: string }) {
  const [mode, setMode] = useState<'login' | 'cadastro'>('login');
  const [form, setForm] = useState({ login: '', username: '', email: '', password: '', displayName: '', masterCode: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') await Auth.login(form.login, form.password);
      else {
        await Auth.register({
          username: form.username, email: form.email, password: form.password,
          displayName: form.displayName || undefined, masterCode: form.masterCode || undefined,
        });
        toast('Conta criada! Bem-vindo(a) à mesa.', 'sucesso');
      }
    } catch (err) {
      toast(errorMessage(err), 'erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-5xl">🏛️</div>
          <h1 className="font-display mt-2 text-3xl text-amber-200">{title}</h1>
          <p className="mt-1 text-slate-300">{subtitle}</p>
        </div>
        {inviteCode && (
          <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-950/40 p-3 text-sm">
            🎟️ Você foi convidado(a) para a mesa <code className="font-bold text-amber-200">{inviteCode}</code>.{' '}
            <strong>Já tem conta?</strong> Só entrar. <strong>Primeira vez?</strong> Toque em "Criar conta". Depois é só escolher seu herói.
          </div>
        )}
        <Card>
          <Tabs className="mb-4" value={mode} onChange={setMode} tabs={[{ key: 'login', label: 'Entrar' }, { key: 'cadastro', label: 'Criar conta' }]} />
          <form onSubmit={submit} className="space-y-3">
            {mode === 'login' ? (
              <Field label="E-mail ou usuário" value={form.login} onChange={set('login')} autoComplete="username" required />
            ) : (
              <>
                <Field label="Nome de usuário" value={form.username} onChange={set('username')} autoComplete="username" required minLength={3} hint="Letras, números, ponto, hífen ou underline" />
                <Field label="E-mail" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
                <Field label="Como quer ser chamado(a) (opcional)" value={form.displayName} onChange={set('displayName')} />
              </>
            )}
            <Field label="Senha" type="password" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'cadastro' ? 8 : 1} hint={mode === 'cadastro' ? 'Mínimo de 8 caracteres' : undefined} />
            {mode === 'cadastro' && allowMasterCode && (
              <Field
                label="Código de Mestre (opcional)"
                value={form.masterCode}
                onChange={set('masterCode')}
                autoComplete="off"
                hint="Deixe vazio no primeiro cadastro: ele já vira Mestre. Para outro Mestre, use o MASTER_INVITE_CODE do server/.env (aparece no terminal do Host). Não é o código de 6 letras da campanha."
              />
            )}
            <Button type="submit" variant="gold" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
