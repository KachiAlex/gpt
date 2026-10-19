import { io } from 'socket.io-client';

// Determine Socket URL based on environment
const getSocketUrl = () => {
  // If explicitly set via environment variable, use it
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  // In production, the API and Socket.IO server share the nginx fronted origin
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://gpt-api.67-211-210-8.sslip.io';
  }

  // Default to localhost for local development
  return 'http://localhost:5000';
};

const SOCKET_URL = getSocketUrl();

const getToken = () => {
  try {
    const authData = localStorage.getItem('gpt_auth');
    return authData ? JSON.parse(authData).token : null;
  } catch {
    return null;
  }
};

export const socket = SOCKET_URL ? io(SOCKET_URL, {
  autoConnect: false,
  // The server verifies this JWT and derives rooms from it — clients can
  // no longer subscribe to arbitrary users/projects.
  auth: (cb) => cb({ token: getToken() }),
}) : null;

export const connectSocket = () => {
  if (!socket) {
    console.warn('Socket.IO is not available. Real-time features disabled.');
    return;
  }
  try {
    socket.connect();
  } catch (error) {
    console.error('Error connecting socket:', error);
  }
};

export const disconnectSocket = () => {
  if (!socket) return;
  try {
    socket.disconnect();
  } catch (error) {
    console.error('Error disconnecting socket:', error);
  }
};

export default socket;
