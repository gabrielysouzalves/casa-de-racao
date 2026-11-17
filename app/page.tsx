
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Leaf, KeyRound, LogIn } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { PublicUser } from '@/lib/auth';
import Store from './store';

export default function Home() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);

  const sending = useRef(false);

  const handleSessionExpired = useCallback(() => {
  setUser(null);
  toast.error('Seu acesso expirou. Entre novamente.');
  }, []);

  async function check(signal?: AbortSignal) {
    try {
      const r = await fetch('/api/auth', {
        cache: 'no-store',
        signal,
      });

      const d = await r.json() as {
        user: PublicUser | null;
        error?: string;
      };

      if (!r.ok) throw new Error(d.error);

      setUser(d.user);
      setError('');
    } catch (e) {
      if (signal?.aborted) return;

      setError((e as Error).message);
    } finally {
      if (!signal?.aborted) {
        setReady(true);
      }
    }
  }

    useEffect(() => {
    const controller = new AbortController();

    fetch('/api/auth', {
        cache: 'no-store',
        signal: controller.signal,
    })
        .then(async (r) => {
        const d = await r.json() as {
            user: PublicUser | null;
            error?: string;
        };

        if (!r.ok) throw new Error(d.error);

        return d;
        })
        .then((d) => {
        setUser(d.user);
        setError('');
        })
        .catch((e: unknown) => {
        if (!controller.signal.aborted) {
            setError((e as Error).message);
        }
        })
        .finally(() => {
        if (!controller.signal.aborted) {
            setReady(true);
        }
        });

        return () => controller.abort();
        }, []);

  async function auth(payload: unknown) {
    if (sending.current) return null;

    sending.current = true;
    setBusy(true);

    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const d = await r.json() as {
        user?: PublicUser;
        error?: string;
        ok?: boolean;
      };

      if (!r.ok) throw new Error(d.error);

      return d;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);

    const d = await auth({
      action: 'login',
      username: String(f.get('username')),
      password: String(f.get('password')),
    });

    if (d?.user) {
      setUser(d.user);
      setError('');
    }
  }

  async function logout() {
    if (await auth({ action: 'logout' })) {
      setUser(null);
      setChanging(false);
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);
    const newPassword = String(f.get('newPassword'));

    if (newPassword !== f.get('confirm')) {
      toast.error('As senhas precisam ser iguais.');
      return;
    }

    const d = await auth({
      action: 'password',
      currentPassword: String(f.get('currentPassword')),
      newPassword,
    });

    if (d?.user) {
      setUser(d.user);
      setChanging(false);
      toast.success('Senha alterada.');
    }
  }

  const passwordForm = (
    <form onSubmit={changePassword} className="form-grid">
      <label>
        Senha atual
        <input
          name="currentPassword"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
        />
      </label>

      <label>
        Nova senha
        <input
          name="newPassword"
          type="password"
          required
          minLength={6}
          maxLength={128}
          autoComplete="new-password"
        />
        <small>Use pelo menos 6 caracteres.</small>
      </label>

      <label>
        Confirmar nova senha
        <input
          name="confirm"
          type="password"
          required
          minLength={6}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>

      <button className="primary" disabled={busy}>
        {busy ? 'Alterando…' : 'Salvar nova senha'}
      </button>
    </form>
  );

  if (!ready) {
    return (
      <main className="login-page">
        <div className="login-card" role="status">
          Carregando acesso…
        </div>
      </main>
    );
  }

  if (!user || user.mustChange) {
    return (
      <main className="login-page">
        <Toaster richColors position="top-right" />

        <div className="login-brand">
          <span>
            <Leaf size={30} />
          </span>

          <div>
            Casa de Ração
            <small>GESTÃO DA LOJA</small>
          </div>
        </div>

        <section className="login-card">
          <div className="login-icon">
            {user ? <KeyRound size={25} /> : <LogIn size={25} />}
          </div>

          <h1>
            {user ? 'Crie sua nova senha' : 'Entrar no sistema'}
          </h1>

          <p>
            {user
              ? 'Para concluir seu primeiro acesso, substitua a senha temporária.'
              : 'Use o acesso cadastrado pelo administrador da loja.'}
          </p>

          {error ? (
            <div className="error" role="alert">
              {error}
              <button onClick={() => void check()}>
                Tentar novamente
              </button>
            </div>
          ) : user ? (
            passwordForm
          ) : (
            <form onSubmit={login} className="form-grid">
              <label>
                Usuário
                <input
                  name="username"
                  required
                  minLength={3}
                  maxLength={64}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                />
              </label>

              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  required
                  maxLength={128}
                  autoComplete="current-password"
                />
              </label>

              <button className="primary" disabled={busy}>
                {busy ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          )}

          {user ? (
            <button
              className="text-button exit-login"
              onClick={logout}
              disabled={busy}
            >
              Sair desta conta
            </button>
          ) : (
            <p className="login-help">
              Esqueceu a senha? Solicite a redefinição ao administrador.
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <>
      <Store
        user={user}
        onLogout={logout}
        onPasswordChange={() => setChanging(true)}
        onSessionExpired={handleSessionExpired}
      />

      <Dialog
        open={changing}
        onOpenChange={(v) => {
          if (!busy) setChanging(v);
        }}
      >
        <DialogContent className="store-dialog">
          <DialogHeader>
            <DialogTitle>Trocar senha</DialogTitle>
            <DialogDescription>
              Após a troca, os acessos abertos em outros dispositivos serão encerrados.
            </DialogDescription>
          </DialogHeader>

          {passwordForm}
        </DialogContent>
      </Dialog>
    </>
  );
}
