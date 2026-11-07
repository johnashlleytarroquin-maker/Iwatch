import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth';
import AuthScreen from './src/screens/AuthScreen';
import StudentHome from './src/screens/StudentHome';
import ResponderHome from './src/screens/ResponderHome';
import AdminHome from './src/screens/AdminHome';
import { C } from './src/theme';
import { setupNotificationChannels } from './src/services/notifications';

// One app, three experiences: what you see depends on the role of the signed-in account.
function Root() {
  const { user, ready } = useAuth();

  useEffect(() => {
    setupNotificationChannels().catch(() => {});
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }
  if (!user) return <AuthScreen />;
  if (user.role === 'admin') return <AdminHome />;
  if (user.role === 'responder') return <ResponderHome />;
  return <StudentHome />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F9F6" />
      <Root />
    </AuthProvider>
  );
}
