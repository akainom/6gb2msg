/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, configureAuthRuntime, setAccessToken, setUserId } from '../../shared/api';
import { profilesApi } from '../../shared/resources';
import type { AuthPayload, Profile, User } from '../../shared/types';

type AuthState = {
  accessToken: string | null;
  userId: string | null;
  user: User | null;
  profile: Profile | null;
  isReady: boolean;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: { email: string; username: string; password: string }) => Promise<void>;
  completeOAuthProfile: (input: { username: string; bio?: string; location?: string }) => Promise<void>;
  refresh: () => Promise<AuthPayload | null>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  setSession: (payload: AuthPayload) => void;
  setProfile: (profile: Profile | null) => void;
};

const USER_ID_KEY = '6gb2msg:userId';
const USER_KEY = '6gb2msg:user';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    accessToken: null,
    userId: localStorage.getItem(USER_ID_KEY),
    user: readJson<User>(USER_KEY),
    profile: null,
    isReady: false,
  }));

  const applySession = useCallback((payload: AuthPayload) => {
    const userId = payload.user_id ?? payload.user?._id ?? payload.profile?.user_id ?? null;
    setAccessToken(payload.accessToken);
    setUserId(userId);
    setState((current) => {
      const nextProfile = payload.profile ?? current.profile;
      const nextUser = payload.user ?? current.user;
      if (userId) localStorage.setItem(USER_ID_KEY, userId);
      if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      return {
        accessToken: payload.accessToken,
        userId,
        user: nextUser,
        profile: nextProfile,
        isReady: true,
      };
    });
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUserId(null);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ accessToken: null, userId: null, user: null, profile: null, isReady: true });
  }, []);

  const refreshing = useRef<Promise<AuthPayload | null> | null>(null);

  const refresh = useCallback(async () => {
    if (refreshing.current) return refreshing.current;

    const userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      clearSession();
      return null;
    }

    refreshing.current = (async () => {
      try {
        const payload = await authApi.refresh(userId);
        applySession({ ...payload, user_id: userId });
        return payload;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshing.current = null;
      }
    })();

    return refreshing.current;
  }, [applySession, clearSession]);

  useEffect(() => {
    configureAuthRuntime({
      getAccessToken: () => state.accessToken,
      getUserId: () => state.userId,
      refresh,
      clear: clearSession,
    });
  }, [state.accessToken, state.userId, refresh, clearSession]);

  useEffect(() => {
    if (!state.isReady) {
      if (state.userId) {
        void refresh().finally(() => {
          setState((current) => ({ ...current, isReady: true }));
        });
      } else {
        setState((current) => ({ ...current, isReady: true }));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.accessToken && state.userId && !state.profile?.username) {
      void profilesApi.getByUser(state.userId).then((p) => {
        setState((current) => ({ ...current, profile: p }));
      });
    }
  }, [state.accessToken, state.userId, state.profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.accessToken && state.userId),
      isAdmin: state.user?.role === 'Admin',
      login: async (username, password) => applySession(await authApi.login({ username, password })),
      register: async (input) => applySession(await authApi.register(input)),
      completeOAuthProfile: async (input) => {
        if (!state.userId) throw new Error('Missing user id');
        const result = await authApi.completeOAuthProfile({ userid: state.userId, ...input });
        if (result.profile) {
          setState((current) => ({ ...current, profile: result.profile as Profile }));
        }
      },
      refresh,
      logout: async () => {
        const userId = state.userId;
        clearSession();
        if (userId) {
          await authApi.logout(userId).catch(() => undefined);
        }
      },
      logoutAll: async () => {
        const userId = state.userId;
        clearSession();
        if (userId) {
          await authApi.logoutAll(userId).catch(() => undefined);
        }
      },
      setSession: applySession,
      setProfile: (profile) => {
        setState((current) => ({ ...current, profile }));
      },
    }),
    [applySession, clearSession, refresh, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

function readJson<T>(key: string): T | null {
  const value = localStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}
