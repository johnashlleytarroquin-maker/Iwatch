import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { API_URL } from './config';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [socket, setSocket] = useState(null);

  const logout = useCallback(async () => {
    setToken(null);
    await AsyncStorage.removeItem('token');
    setUser(null);
  }, []);

  // Restore a saved session on app start
  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('token');
        if (saved) {
          setToken(saved);
          try {
            const { user: me } = await api.get('/api/me');
            setUser(me);
          } catch (e) {
            // Only forget the token if the server said it is no longer valid.
            // If the server was just unreachable, keep it for next time.
            if (e.status === 401 || e.status === 403) {
              setToken(null);
              await AsyncStorage.removeItem('token');
            }
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, [logout]);

  // One realtime connection while signed in
  useEffect(() => {
    if (!user) return undefined;
    const s = io(API_URL, { auth: { token: getToken() }, transports: ['websocket'] });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user?.id]);

  const login = useCallback(async (email, password) => {
    const { token, user: me } = await api.post('/api/auth/login', { email, password });
    setToken(token);
    await AsyncStorage.setItem('token', token);
    setUser(me);
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, socket, login, logout, updateUser }}>{children}</AuthContext.Provider>
  );
}
