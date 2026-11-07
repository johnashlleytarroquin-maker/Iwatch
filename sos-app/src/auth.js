import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { API_URL } from './config';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';

// Inactivity session timeout: 15 minutes
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [socket, setSocket] = useState(null);
  const lastActiveRef = useRef(Date.now());

  // Record user activity timestamp
  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    AsyncStorage.setItem('last_active_time', String(now)).catch(() => {});
  }, []);

  // Internal silent logout (for session expiration, 401s, etc.)
  const performLogout = useCallback(async (alertMessage = null) => {
    try {
      await api.post('/api/me/remove-push-token').catch(() => {});
    } catch {}
    setToken(null);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('last_active_time');
    setUser(null);
    if (alertMessage) {
      setTimeout(() => {
        Alert.alert('Session Expired', alertMessage);
      }, 300);
    }
  }, []);

  // User-facing logout with required confirmation dialog
  const logout = useCallback(
    (force = false) => {
      if (force === true) {
        return performLogout();
      }
      Alert.alert(
        'Are you sure you want to log out?',
        'You will need to sign in again to access your account.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Log Out',
            style: 'destructive',
            onPress: () => performLogout(),
          },
        ]
      );
    },
    [performLogout]
  );

  // Restore a saved session on app start
  useEffect(() => {
    setUnauthorizedHandler(() => performLogout());
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('token');
        const savedTimeStr = await AsyncStorage.getItem('last_active_time');
        const lastActive = savedTimeStr ? Number(savedTimeStr) : null;

        // Check if session was already expired while app was closed
        if (saved && lastActive && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('last_active_time');
        } else if (saved) {
          setToken(saved);
          try {
            const { user: me } = await api.get('/api/me');
            setUser(me);
            recordActivity();
          } catch (e) {
            // Only forget the token if the server said it is no longer valid.
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
  }, [performLogout, recordActivity]);

  // Monitor user inactivity session timeout (foreground interval + background wake check)
  useEffect(() => {
    if (!user) return undefined;

    recordActivity();

    // Check every 30 seconds while foregrounded
    const interval = setInterval(() => {
      const now = Date.now();
      const last = lastActiveRef.current;
      if (last && now - last > INACTIVITY_TIMEOUT_MS) {
        clearInterval(interval);
        performLogout('Your session has expired due to 15 minutes of inactivity. Please sign in again.');
      }
    }, 30000);

    // AppState change listener (e.g. app resumes after being in background or locked)
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const now = Date.now();
        const savedTimeStr = await AsyncStorage.getItem('last_active_time');
        const last = savedTimeStr ? Number(savedTimeStr) : lastActiveRef.current;
        if (last && now - last > INACTIVITY_TIMEOUT_MS) {
          performLogout('Your session has expired due to inactivity while away. Please sign in again.');
        } else {
          recordActivity();
        }
      } else {
        recordActivity();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [user, performLogout, recordActivity]);

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

  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/api/auth/login', { email, password });
      setToken(res.token);
      await AsyncStorage.setItem('token', res.token);
      setUser(res.user);
      recordActivity();
      return res;
    },
    [recordActivity]
  );

  const setSession = useCallback(
    async (token, me) => {
      setToken(token);
      await AsyncStorage.setItem('token', token);
      setUser(me);
      recordActivity();
    },
    [recordActivity]
  );

  const updateUser = useCallback((updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        socket,
        login,
        logout,
        performLogout,
        setSession,
        recordActivity,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
