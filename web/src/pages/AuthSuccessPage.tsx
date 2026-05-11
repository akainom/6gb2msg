import { useRef } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function AuthSuccessPage() {
  const [params] = useSearchParams();
  const auth = useAuth();
  const done = useRef(false);

  const token = params.get('token');
  const uid = params.get('uid');
  const role = params.get('role');
  const complete = params.get('complete');

  if (!token) return <Navigate to="/login" replace />;

  if (!done.current) {
    done.current = true;
    auth.setSession({ accessToken: token, user_id: uid ?? undefined, user: role ? { _id: uid ?? '', role } as any : undefined });
    if (complete === '0') {
      auth.setProfile({ isComplete: false } as any);
    }
  }

  if (complete === '0') return <Navigate to="/complete-profile" replace />;
  return <Navigate to="/" replace />;
}
