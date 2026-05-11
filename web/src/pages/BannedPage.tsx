import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { Card } from '../shared/ui';

export function BannedPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const reason = sessionStorage.getItem('ban:reason') || 'нарушение правил';
  const untilRaw = sessionStorage.getItem('ban:until');
  const until = untilRaw ? new Date(untilRaw).toLocaleString() : null;

  const handleLogout = () => {
    sessionStorage.removeItem('ban:reason');
    sessionStorage.removeItem('ban:until');
    void auth.logout().then(() => {
      navigate('/login');
    });
  };

  return (
    <main className="auth-page">
      <Card className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>🚫</div>
        <h1 style={{ marginBottom: '.5rem' }}>Аккаунт заблокирован</h1>
        <p className="text-secondary" style={{ marginBottom: '.75rem' }}>
          Причина: {reason}
        </p>
        {until && (
          <p className="text-secondary" style={{ marginBottom: '1rem' }}>
            Разблокировка: {until}
          </p>
        )}
        <button className="btn-secondary" onClick={handleLogout}>
          Выйти из аккаунта
        </button>
      </Card>
    </main>
  );
}
