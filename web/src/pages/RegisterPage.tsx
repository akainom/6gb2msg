import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { Card, ErrorMessage, Field, submitForm } from '../shared/ui';

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  if (auth.isReady && auth.isAuthenticated) return <Navigate to="/" replace />;

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <p className="eyebrow">Create account</p>
        <h1 style={{ marginBottom: '.25rem' }}>Регистрация</h1>
        <p className="text-secondary" style={{ marginBottom: '.5rem' }}>Создайте новый аккаунт</p>
        <form onSubmit={submitForm(async (form) => {
          setPending(true); setError(null);
          try { await auth.register({ email: String(form.get('email')), username: String(form.get('username')), password: String(form.get('password')) }); navigate('/', { replace: true }); }
          catch (e) { setError(e); }
          finally { setPending(false); }
        })}>
          <Field label="Email"><input name="email" type="email" autoComplete="email" required /></Field>
          <Field label="Username" hint="6-15 символов: латиница, цифры и underscore."><input name="username" autoComplete="username" minLength={6} maxLength={15} required /></Field>
          <Field label="Password"><input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
          <ErrorMessage error={error} />
          <button disabled={pending}>{pending ? 'Создаём...' : 'Зарегистрироваться'}</button>
        </form>
        <p style={{ textAlign: 'center' }}>Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </Card>
    </main>
  );
}
