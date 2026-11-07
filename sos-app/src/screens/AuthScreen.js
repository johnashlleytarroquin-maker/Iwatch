import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const { login, setSession } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('student');
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // OTP Verification States
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer countdown
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();

    // Check Gmail domain requirement
    if (!cleanEmail.endsWith('@gmail.com') || cleanEmail.length <= 10) {
      Alert.alert(
        'Valid Gmail Required',
        'All users must use an active, valid Gmail address (@gmail.com) for account verification and security notifications.'
      );
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      if (mode === 'login') {
        await login(cleanEmail, password);
      } else {
        const res = await api.post('/api/auth/register', {
          name: name.trim(),
          email: cleanEmail,
          password,
          role,
          idNumber: idNumber.trim(),
          phone: phone.trim(),
        });

        // Backend requires 6-digit OTP verification
        if (res.requiresOtp || res.status === 'unverified') {
          setVerifyingEmail(cleanEmail);
          setOtpMode(true);
          setOtpCode('');
          setResendCooldown(60);
          setNotice('Verification code sent to your Gmail. Please enter the 6 digits below.');
        } else {
          setNotice(res.message || 'Registration submitted! Please sign in.');
          setMode('login');
          setPassword('');
        }
      }
    } catch (e) {
      // Check if server rejected login because Gmail is not verified yet
      if (e.data && e.data.unverified) {
        setVerifyingEmail(cleanEmail);
        setOtpMode(true);
        setOtpCode('');
        setResendCooldown(60);
        Alert.alert(
          'Email Verification Required',
          'Your Gmail address has not been verified yet. We have sent a 6-digit verification code to your Gmail.'
        );
      } else {
        Alert.alert(mode === 'login' ? 'Authentication Failed' : 'Registration Failed', e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  // Submit 6-digit OTP code to verify Gmail
  const handleVerifyOtp = async () => {
    const code = otpCode.trim();
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit code sent to your Gmail.');
      return;
    }

    setBusy(true);
    try {
      const res = await api.post('/api/auth/verify-otp', {
        email: verifyingEmail,
        otp: code,
      });

      if (res.token && res.user) {
        // Auto sign-in for approved accounts
        Alert.alert('Verification Successful', 'Your Gmail has been verified! Welcome to Iwatch.');
        await setSession(res.token, res.user);
      } else {
        // Responder accounts pending admin approval
        Alert.alert(
          'Gmail Verified',
          res.message || 'Your Gmail is verified! An administrator must review and approve your responder account before you can sign in.'
        );
        setOtpMode(false);
        setMode('login');
        setPassword('');
        setNotice('Gmail verified! Awaiting administrator approval.');
      }
    } catch (err) {
      Alert.alert('Verification Failed', err.message || 'Incorrect code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Resend OTP Code
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setBusy(true);
    try {
      const res = await api.post('/api/auth/resend-otp', { email: verifyingEmail });
      setResendCooldown(60);
      Alert.alert('Code Sent', res.message || 'A fresh 6-digit verification code was sent to your Gmail.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not resend code. Please try again later.');
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

        {/* ---------------- OTP Verification View ---------------- */}
        {otpMode ? (
          <View style={s.card}>
            <View style={s.otpHeader}>
              <View style={s.otpIconContainer}>
                <Ionicons name="mail-unread-outline" size={32} color={C.forest} />
              </View>
              <Text style={s.otpTitle}>Verify Your Gmail</Text>
              <Text style={s.otpDesc}>
                We sent a 6-digit verification code to:
              </Text>
              <View style={s.emailBadge}>
                <Ionicons name="logo-google" size={14} color="#EA4335" style={{ marginRight: 6 }} />
                <Text style={s.emailBadgeText}>{verifyingEmail}</Text>
              </View>
            </View>

            <Text style={s.otpInputLabel}>ENTER 6-DIGIT CODE</Text>
            <TextInput
              style={s.otpInput}
              value={otpCode}
              onChangeText={(t) => setOtpCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={C.muted}
              autoFocus
            />

            <Btn
              title="VERIFY & CONTINUE"
              onPress={handleVerifyOtp}
              loading={busy}
              disabled={otpCode.trim().length !== 6}
              color={C.forest}
              icon={<Ionicons name="shield-checkmark-outline" size={18} color="#fff" />}
              style={{ marginTop: 12 }}
            />

            {/* Resend Code Button & Countdown */}
            <View style={s.resendContainer}>
              {resendCooldown > 0 ? (
                <Text style={s.resendTimerText}>
                  Resend code in <Text style={{ fontWeight: '700' }}>{resendCooldown}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOtp} disabled={busy}>
                  <Text style={s.resendActionText}>Didn't receive the code? Resend</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                setOtpMode(false);
                setOtpCode('');
              }}
              style={s.backToAuthBtn}
            >
              <Ionicons name="arrow-back" size={16} color={C.sub} style={{ marginRight: 4 }} />
              <Text style={s.backToAuthText}>Change Email / Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ---------------- Sign In / Register View ---------------- */
          <>
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
                        color={role === 'student' ? C.forest : C.muted}
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
                        color={role === 'responder' ? C.forest : C.muted}
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
                        Responder registrations must be verified by Gmail and approved by Campus Admin before sign-in.
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
                label={mode === 'register' ? 'Gmail Address (Must be @gmail.com)' : 'Gmail Address'}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                placeholder="yourname@gmail.com"
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
                title={mode === 'login' ? 'SIGN IN' : 'SEND VERIFICATION CODE'}
                onPress={submit}
                loading={busy}
                disabled={!ready}
                color={C.forest}
                icon={
                  <Ionicons
                    name={mode === 'login' ? 'log-in-outline' : 'mail-outline'}
                    size={18}
                    color="#fff"
                  />
                }
                style={{ marginTop: 8 }}
              />
            </View>
          </>
        )}

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
    marginBottom: 20,
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
    ...SHADOWS.md,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 12,
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
    color: C.forest,
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
    borderColor: C.forest,
    backgroundColor: C.greenBg,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginTop: 6,
  },
  roleTextActive: {
    color: C.forest,
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

  // OTP Styles
  otpHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  otpIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.greenBorder,
  },
  otpTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.forest,
    marginBottom: 4,
  },
  otpDesc: {
    fontSize: 13,
    color: C.sub,
    textAlign: 'center',
    marginBottom: 8,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emailBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  otpInputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  otpInput: {
    backgroundColor: C.bg,
    borderWidth: 2,
    borderColor: C.forest,
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '800',
    color: C.forest,
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 8,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendTimerText: {
    fontSize: 13,
    color: C.muted,
  },
  resendActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.forest,
    textDecorationLine: 'underline',
  },
  backToAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 8,
  },
  backToAuthText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.sub,
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
