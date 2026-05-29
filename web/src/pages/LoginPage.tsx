import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { config } from '../shared/config';
import { Card, ErrorMessage, Field, submitForm } from '../shared/ui';

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/';

  if (auth.isReady && auth.isAuthenticated) return <Navigate to={from} replace />;

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <p className="eyebrow">С возвращением</p>
        <h1 style={{ marginBottom: '.25rem' }}>Вход</h1>
        <p className="text-secondary" style={{ marginBottom: '.5rem' }}>Войдите в свой аккаунт</p>
        <form onSubmit={submitForm(async (form) => {
          setPending(true); setError(null);
          try { await auth.login(String(form.get('username')), String(form.get('password'))); navigate(from, { replace: true }); }
          catch (e) { setError(e); }
          finally { setPending(false); }
        })}>
          <Field label="Имя пользователя"><input name="username" autoComplete="username" required /></Field>
          <Field label="Пароль"><input name="password" type="password" autoComplete="current-password" required /></Field>
          <ErrorMessage error={error} />
          <button disabled={pending}>{pending ? 'Входим...' : 'Войти'}</button>
        </form>
        <p style={{ textAlign: 'center' }}>
          Нет аккаунта? <Link to="/register">Создать</Link>
        </p>
        <div style={{ display: 'grid', gap: '.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span className="text-secondary" style={{ fontSize: '.8rem' }}>или</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <a className="oauth-link" href={`${config.apiBaseUrl}/auth/oauth/google`}>Войти через Google</a>
        </div>
      </Card>
    </main>
  );
}
