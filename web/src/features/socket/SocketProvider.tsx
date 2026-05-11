/* eslint-disable react-refresh/only-export-components, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthProvider';
import { config } from '../../shared/config';

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, isConnected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setConnected] = useState(false);

  useEffect(() => {
    if (!auth.accessToken || !auth.isAuthenticated || auth.profile?.isComplete === false) {
      socket?.disconnect();
      setSocket(null);
      setConnected(false);
      return;
    }

    const nextSocket = io(config.socketUrl, {
      path: config.socketPath,
      withCredentials: true,
      transports: ['websocket'],
      auth: { token: auth.accessToken },
    });

    nextSocket.on('connect', () => setConnected(true));
    nextSocket.on('disconnect', () => setConnected(false));
    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [auth.accessToken, auth.isAuthenticated, auth.profile?.isComplete]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
