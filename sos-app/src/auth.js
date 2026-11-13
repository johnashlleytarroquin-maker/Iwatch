import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
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

  // Backward compatibility dummy: activity recording is no longer needed because sessions never expire
  const recordActivity = useCallback(() => {}, []);

  // Internal silent logout (for explicit logout or if account was disabled/removed by administrator)
  const performLogout = useCallback(async () => {
    try {
      await api.post('/api/me/remove-push-token').catch(() => {});
    } catch {}
    setToken(null);
    await AsyncStorage.multiRemove(['token', 'user_profile', 'last_active_time']).catch(() => {});
    setUser(null);
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

  // Restore saved session on app start - persistent login (never expires on app close)
  useEffect(() => {
    setUnauthorizedHandler(() => performLogout());
    (async () => {
      try {
        const [savedToken, savedUserJson] = await Promise.all([
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('user_profile'),
        ]);

        let initialUser = null;
        if (savedUserJson) {
          try {
            initialUser = JSON.parse(savedUserJson);
          } catch {}
        }

        if (savedToken) {
          setToken(savedToken);
          // If cached user profile exists, immediately set it so the app enters the dashboard with NO login screen
          if (initialUser) {
            setUser(initialUser);
          }

          // Asynchronously verify & sync latest user profile from server
          try {
            const { user: me } = await api.get('/api/me');
            setUser(me);
            await AsyncStorage.setItem('user_profile', JSON.stringify(me));
          } catch (e) {
            // Only clear credentials if server explicitly says the token is invalid or account disabled
            if (e.status === 401 || (e.status === 403 && e.data?.error === 'Account is not active')) {
              setToken(null);
              await AsyncStorage.multiRemove(['token', 'user_profile', 'last_active_time']).catch(() => {});
              setUser(null);
            }
            // For offline, slow network, or server cold start: keep user logged in with cached profile
          }
        }
      } catch (err) {
        console.warn('[auth] Error restoring session:', err);
      } finally {
        setReady(true);
      }
    })();
  }, [performLogout]);

  // Realtime connection while signed in
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
    async (identifier, password) => {
      const res = await api.post('/api/auth/login', {
        identifier,
        username: identifier,
        email: identifier,
        password,
      });
      setToken(res.token);
      await Promise.all([
        AsyncStorage.setItem('token', res.token),
        AsyncStorage.setItem('user_profile', JSON.stringify(res.user)),
      ]);
      setUser(res.user);
      return res;
    },
    []
  );

  const setSession = useCallback(
    async (token, me) => {
      setToken(token);
      await Promise.all([
        AsyncStorage.setItem('token', token),
        AsyncStorage.setItem('user_profile', JSON.stringify(me)),
      ]);
      setUser(me);
    },
    []
  );

  const updateUser = useCallback((updatedUser) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updatedUser };
      AsyncStorage.setItem('user_profile', JSON.stringify(merged)).catch(() => {});
      return merged;
    });
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
