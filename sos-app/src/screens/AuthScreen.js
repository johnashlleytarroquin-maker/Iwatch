import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { useAuth } from '../auth';
import { API_URL } from '../config';
import { Btn, Field, TOP } from '../ui';
import { C, SHADOWS } from '../theme';

export default function AuthScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('student');
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const submit = async () => {
    setBusy(true);
    setNotice('');
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        const res = await api.post('/api/auth/register', {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          idNumber: idNumber.trim(),
          phone: phone.trim(),
        });
        setNotice(res.message || 'Registration submitted! Please sign in.');
        setMode('login');
        setPassword('');
      }
    } catch (e) {
      Alert.alert(mode === 'login' ? 'Authentication Failed' : 'Registration Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const ready =
    email.trim() && password && (mode === 'login' || (name.trim() && password.length >= 6));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: TOP + 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Shield & Title */}
        <View style={s.hero}>
          <View style={s.shieldBadge}>
            <MaterialCommunityIcons name="hospital-box" size={40} color={C.gold} />
          </View>
          <Text style={s.brandTitle}>Iwatch</Text>
          <Text style={s.brandSubtitle}>Campus Emergency Response Network</Text>
        </View>

        {/* Notice Banner */}
        {notice ? (
          <View style={s.noticeBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#15803D" style={{ marginRight: 8 }} />
            <Text style={s.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {/* Mode Selector Tabs */}
        <View style={s.segmentedContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setMode('login');
              setNotice('');
            }}
            style={[s.segmentedTab, mode === 'login' && s.segmentedTabActive]}
          >
            <Text style={[s.segmentedText, mode === 'login' && s.segmentedTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setMode('register');
              setNotice('');
            }}
            style={[s.segmentedTab, mode === 'register' && s.segmentedTabActive]}
          >
            <Text style={[s.segmentedText, mode === 'register' && s.segmentedTextActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Card */}
        <View style={s.card}>
          {mode === 'register' && (
            <>
              {/* Role Picker */}
              <Text style={s.sectionLabel}>ACCOUNT TYPE</Text>
              <View style={s.roleGrid}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setRole('student')}
                  style={[s.roleCard, role === 'student' && s.roleCardActive]}
                >
                  <Ionicons
                    name="school"
                    size={22}
                    color={role === 'student' ? C.blue : C.muted}
                  />
                  <Text style={[s.roleText, role === 'student' && s.roleTextActive]}>Student</Text>
                  <Text style={s.roleDesc}>Instant SOS alerts</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setRole('responder')}
                  style={[s.roleCard, role === 'responder' && s.roleCardActive]}
                >
                  <MaterialCommunityIcons
                    name="account-hard-hat"
                    size={24}
                    color={role === 'responder' ? C.blue : C.muted}
                  />
                  <Text style={[s.roleText, role === 'responder' && s.roleTextActive]}>
                    Responder
                  </Text>
                  <Text style={s.roleDesc}>Safety Personnel</Text>
                </TouchableOpacity>
              </View>

              {role === 'responder' && (
                <View style={s.approvalNotice}>
                  <Ionicons name="information-circle" size={18} color={C.amber} style={{ marginRight: 6 }} />
                  <Text style={s.approvalText}>
                    Responder registrations must be reviewed and approved by Campus Admin before sign-in.
                  </Text>
                </View>
              )}

              <Field
                label="Full Name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. George B Elipe"
              />

              <Field
                label={role === 'student' ? 'Student ID Number' : 'Staff / Responder ID'}
                value={idNumber}
                onChangeText={setIdNumber}
                placeholder="e.g. 2024-10892"
                autoCapitalize="characters"
              />

              <Field
                label="Contact Phone (for emergency callback)"
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 0917-123-4567"
                keyboardType="phone-pad"
              />
            </>
          )}

          <Field
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            placeholder="john@school.edu"
          />

          <Field
            label={mode === 'register' ? 'Password (min. 6 characters)' : 'Password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="••••••••"
          />

          <Btn
            title={mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            onPress={submit}
            loading={busy}
            disabled={!ready}
            color={C.forest}
            icon={<Ionicons name={mode === 'login' ? 'log-in-outline' : 'person-add-outline'} size={18} color="#fff" />}
            style={{ marginTop: 8 }}
          />
        </View>

        {/* Footer info */}
        <View style={s.footer}>
          <View style={s.encryptedPill}>
            <Ionicons name="shield-checkmark" size={14} color={C.gold} />
            <Text style={s.encryptedText}>Authorized Campus Security Protocol</Text>
          </View>
          <Text style={s.serverInfo}>Connected to {API_URL}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  shieldBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: C.forest,
    borderWidth: 3,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...SHADOWS.glow(C.forestGlow),
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: C.forest,
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 13,
    color: C.sub,
    fontWeight: '600',
    marginTop: 4,
  },

  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: C.cardSubtle,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentedTabActive: {
    backgroundColor: '#fff',
    ...SHADOWS.sm,
  },
  segmentedText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sub,
  },
  segmentedTextActive: {
    color: C.text,
  },

  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.greenBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.greenBorder,
  },
  noticeText: {
    flex: 1,
    color: '#15803D',
    fontWeight: '600',
    fontSize: 13,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.borderLight,
    ...SHADOWS.md,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  roleCard: {
    flex: 1,
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  roleCardActive: {
    borderColor: C.blue,
    backgroundColor: C.blueBg,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginTop: 6,
  },
  roleTextActive: {
    color: C.blue,
  },
  roleDesc: {
    fontSize: 11,
    color: C.sub,
    marginTop: 2,
    textAlign: 'center',
  },

  approvalNotice: {
    flexDirection: 'row',
    backgroundColor: C.amberBg,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.amberBorder,
  },
  approvalText: {
    flex: 1,
    fontSize: 12,
    color: C.amberDark,
    lineHeight: 16,
    fontWeight: '500',
  },

  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  encryptedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.greenBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.greenBorder,
    marginBottom: 10,
  },
  encryptedText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  serverInfo: {
    fontSize: 11,
    color: C.muted,
  },
});
