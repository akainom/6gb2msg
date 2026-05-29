import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { Card, ErrorMessage, Field, submitForm } from '../shared/ui';
import { useState } from 'react';

export function CompleteProfilePage() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const token = params.get('token');
  const uid = params.get('uid');

  if (auth.profile?.isComplete) return <Navigate to="/" replace />;
  if (!token || !uid) return <Navigate to="/login" replace />;
  if (!auth.accessToken) auth.setSession({ accessToken: token, user_id: uid });

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <p className="eyebrow">Google Вход</p>
        <h1 style={{ marginBottom: '.25rem' }}>Выберите имя пользователя</h1>
        <p className="text-secondary" style={{ marginBottom: '.5rem' }}>Завершите регистрацию</p>
        <form onSubmit={submitForm(async (form) => {
          setError(null);
          try { await auth.completeOAuthProfile({ username: String(form.get('username')) }); }
          catch (e: any) { setError(e?.message ?? 'Ошибка'); }
        })}>
          <Field label="Имя пользователя"><input name="username" minLength={5} maxLength={15} required autoFocus /></Field>
          <ErrorMessage error={error} />
          <button>Продолжить</button>
        </form>
      </Card>
    </main>
  );
}
