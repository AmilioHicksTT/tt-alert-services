import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  socket = io(API_URL, {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => console.log('[Socket] Connected'));
  socket.on('disconnect', () => console.log('[Socket] Disconnected'));

  return socket;
}

export function subscribeToArea(districtCode: string) {
  const s = connectSocket();
  s.emit('subscribe:area', districtCode);
  s.emit('subscribe:all');
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
