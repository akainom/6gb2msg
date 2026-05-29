import { useEffect, useRef } from 'react';
import { useSocket } from './SocketProvider';

export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void,
  deps: unknown[] = [],
) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;

    const wrapped = (data: T) => handlerRef.current(data);
    socket.on(event, wrapped);

    return () => {
      socket.off(event, wrapped);
    };
  }, [socket, event, ...deps]);
}
