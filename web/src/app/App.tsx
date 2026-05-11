import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { SocketProvider } from '../features/socket/SocketProvider';
import { AdminReportsPage } from '../pages/AdminReportsPage';
import { AuthSuccessPage } from '../pages/AuthSuccessPage';
import { BannedPage } from '../pages/BannedPage';
import { ChatsPage } from '../pages/ChatsPage';
import { CompleteProfilePage } from '../pages/CompleteProfilePage';
import { LoginPage } from '../pages/LoginPage';
import { ProfilePage } from '../pages/ProfilePage';
import { RegisterPage } from '../pages/RegisterPage';
import { StatsPage } from '../pages/StatsPage';
import { ReportsPage } from '../pages/ReportsPage';

function HomePage() {
  const auth = useAuth();
  return auth.isAdmin ? <Navigate to="/admin/reports" replace /> : <ChatsPage />;
}

export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/success" element={<AuthSuccessPage />} />
          <Route path="/complete-profile" element={<CompleteProfilePage />} />
          <Route path="/banned" element={<BannedPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route element={<ProtectedRoute nonAdmin />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>
              <Route element={<ProtectedRoute adminOnly />}>
                <Route path="/admin/reports" element={<AdminReportsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}
