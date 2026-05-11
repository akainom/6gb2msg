import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function ProtectedRoute({ adminOnly = false, nonAdmin = false }: { adminOnly?: boolean; nonAdmin?: boolean }) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isReady) return <div className="centered"><div className="card" style={{ padding: '2rem', textAlign: 'center' }}><p className="text-secondary">Проверяем сессию...</p></div></div>;
  if (!auth.isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (auth.profile && !auth.profile.isComplete) return <Navigate to="/complete-profile" replace />;
  if (adminOnly && !auth.isAdmin) return <Navigate to="/" replace />;
  if (nonAdmin && auth.isAdmin) return <Navigate to="/admin/reports" replace />;

  return <Outlet />;
}
