import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthProvider';
import { config } from '../../shared/config';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

type QueuedMessage = {
  event: string;
  payload: unknown;
  ack?: (response: unknown) => void;
  ts: number;
};

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  connectionState: ConnectionState;
  emit: (event: string, payload?: unknown) => void;
  emitWithAck: <T>(event: string, payload?: unknown, timeout?: number) => Promise<T | null>;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  connectionState: 'idle',
  emit: () => {},
  emitWithAck: async () => null,
});

const RECONNECT_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const RECONNECT_MAX_ATTEMPTS = 10;
const QUEUE_MAX_AGE = 30000;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');

  const socketRef = useRef<Socket | null>(null);
  const queueRef = useRef<QueuedMessage[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!auth.accessToken || !auth.isAuthenticated || auth.profile?.isComplete === false) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setConnectionState('idle');
      return;
    }

    setConnectionState('connecting');

    const nextSocket = io(config.socketUrl, {
      path: config.socketPath,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: {
        token: auth.accessToken,
      },
      reconnection: true,
      reconnectionAttempts: RECONNECT_MAX_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionDelayMax: RECONNECT_MAX_DELAY,
      randomizationFactor: 0.3,
      timeout: 20000,
    });

    const onConnect = () => {
      if (!mountedRef.current) return;
      setConnectionState('connected');
      processQueue();
    };

    const onDisconnect = (reason: string) => {
      if (!mountedRef.current) return;
      if (reason === 'io client disconnect') {
        setConnectionState('idle');
        return;
      }
    };

    const onReconnectAttempt = () => {
      if (!mountedRef.current) return;
      setConnectionState('reconnecting');

      if (auth.accessToken) {
        (nextSocket as any).auth = { token: auth.accessToken };
      }
    };

    const onConnectError = () => {
      if (!mountedRef.current) return;
      if (nextSocket.disconnected) {
        setConnectionState('disconnected');
      }
    };

    nextSocket.on('connect', onConnect);
    nextSocket.on('disconnect', onDisconnect);
    nextSocket.on('reconnect_attempt', onReconnectAttempt);
    nextSocket.on('connect_error', onConnectError);

    socketRef.current = nextSocket;
    setSocket(nextSocket);

    return () => {
      nextSocket.off('connect', onConnect);
      nextSocket.off('disconnect', onDisconnect);
      nextSocket.off('reconnect_attempt', onReconnectAttempt);
      nextSocket.off('connect_error', onConnectError);
      nextSocket.removeAllListeners();
      nextSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnectionState('idle');
    };
  }, [auth.accessToken, auth.isAuthenticated, auth.profile?.isComplete]);

  const processQueue = useCallback(() => {
    const now = Date.now();
    const pending = queueRef.current;
    queueRef.current = [];

    const valid = pending.filter((m) => now - m.ts < QUEUE_MAX_AGE);
    const sock = socketRef.current;

    if (!sock || !sock.connected) {
      queueRef.current.unshift(...valid);
      return;
    }

    for (const msg of valid) {
      if (msg.ack) {
        sock.emit(msg.event, msg.payload, msg.ack);
      } else {
        sock.emit(msg.event, msg.payload);
      }
    }
  }, []);

  const emit = useCallback((event: string, payload?: unknown) => {
    const sock = socketRef.current;
    if (sock?.connected) {
      sock.emit(event, payload);
    }
  }, []);

  const emitWithAck = useCallback(<T,>(event: string, payload?: unknown, timeout = 15000): Promise<T | null> => {
    return new Promise((resolve) => {
      const sock = socketRef.current;
      if (!sock?.connected) {
        resolve(null);
        return;
      }

      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; resolve(null); }
      }, timeout);

      sock.emit(event, payload, (response: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(response as T);
        }
      });
    });
  }, []);

  const isConnected = connectionState === 'connected';

  const value = useMemo<SocketContextValue>(
    () => ({ socket, isConnected, connectionState, emit, emitWithAck }),
    [socket, isConnected, connectionState, emit, emitWithAck],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
