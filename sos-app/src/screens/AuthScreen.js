import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
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

  // Sign In inputs
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Create Account inputs
  const [name, setName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [username, setUsername] = useState('');
  const [idYear, setIdYear] = useState('');
  const [idNumberPart, setIdNumberPart] = useState('');
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

  // Input refs for keyboard navigation & auto-scrolling
  const scrollViewRef = useRef(null);
  const loginUsernameRef = useRef(null);
  const loginPasswordRef = useRef(null);
  const nameInputRef = useRef(null);
  const suffixInputRef = useRef(null);
  const usernameInputRef = useRef(null);
  const idYearRef = useRef(null);
  const idRestRef = useRef(null);
  const phoneInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  // Soft keyboard height & visibility tracking
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates?.height || 280);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Smooth scroll helpers to prevent keyboard covering input fields
  const scrollToInput = (yOffset) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 100);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const submit = async () => {
    setBusy(true);
    setNotice('');

    try {
      if (mode === 'login') {
        const cleanLogin = loginUsername.trim();
        if (!cleanLogin) {
          Alert.alert('Required', 'Please enter your username.');
          setBusy(false);
          return;
        }
        if (!loginPassword) {
          Alert.alert('Required', 'Please enter your password.');
          setBusy(false);
          return;
        }
        await login(cleanLogin, loginPassword);
      } else {
        const cleanEmail = email.trim().toLowerCase();

        // Require valid Gmail address
        if (!cleanEmail.endsWith('@gmail.com') || cleanEmail.length <= 10) {
          Alert.alert(
            'Valid Gmail Required',
            'All new accounts must use an active, valid Gmail address (@gmail.com) for verification and security notices.'
          );
          setBusy(false);
          return;
        }

        // Validate password length (at least 8 characters)
        if (password.length < 8) {
          Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
          setBusy(false);
          return;
        }

        // Validate username
        const cleanUsername = username.trim().toLowerCase();
        if (cleanUsername.length < 3) {
          Alert.alert('Invalid Username', 'Username must be at least 3 characters long.');
          setBusy(false);
          return;
        }

        // Validate ID Number
        if (idYear.trim().length !== 4 || idNumberPart.trim().length < 3) {
          Alert.alert(
            'Incomplete ID Number',
            'Please enter a valid 4-digit year and ID number (e.g. 2024 - 12345).'
          );
          setBusy(false);
          return;
        }

        const fullIdNumber = `${idYear.trim()} - ${idNumberPart.trim()}`;

        const res = await api.post('/api/auth/register', {
          name: name.trim(),
          suffix: suffix.trim(),
          username: cleanUsername,
          email: cleanEmail,
          password,
          role,
          idNumber: fullIdNumber,
          phone: phone.trim(),
        });

        // Backend requires 6-digit OTP verification
        if (res.requiresOtp || res.status === 'unverified') {
          setVerifyingEmail(cleanEmail);
          setOtpMode(true);
          setResendCooldown(60);
          if (res.devOtp) {
            setOtpCode(res.devOtp);
            setNotice(`Verification code: ${res.devOtp} (auto-filled for quick testing)`);
          } else {
            setOtpCode('');
            setNotice('Verification code sent to your Gmail. Please enter the 6 digits below.');
          }
        } else {
          setNotice(res.message || 'Registration submitted! Please sign in.');
          setLoginUsername(cleanUsername);
          setLoginPassword('');
          setMode('login');
        }
      }
    } catch (e) {
      // Check if server rejected login because Gmail is not verified yet
      if (e.data && e.data.unverified) {
        setVerifyingEmail(e.data.email || loginUsername.trim());
        setOtpMode(true);
        setResendCooldown(60);
        if (e.data.devOtp) {
          setOtpCode(e.data.devOtp);
          setNotice(`Verification code: ${e.data.devOtp} (auto-filled for quick testing)`);
          Alert.alert(
            'Email Verification Required',
            `Your Gmail has not been verified yet.\n\nVerification Code: ${e.data.devOtp}`
          );
        } else {
          setOtpCode('');
          Alert.alert(
            'Email Verification Required',
            'Your Gmail address has not been verified yet. We have sent a 6-digit verification code to your Gmail.'
          );
        }
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
        Alert.alert('Verification Successful', 'Your account has been verified! Welcome to Iwatch.');
        await setSession(res.token, res.user);
      } else {
        // Responder accounts pending admin approval
        Alert.alert(
          'Email Verified',
          res.message || 'Your email is verified! An administrator must review and approve your responder account before you can sign in.'
        );
        setOtpMode(false);
        setLoginUsername(username.trim() || verifyingEmail);
        setLoginPassword('');
        setMode('login');
        setNotice('Email verified! Awaiting administrator approval.');
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
      if (res.devOtp) {
        setOtpCode(res.devOtp);
        setNotice(`New verification code: ${res.devOtp} (auto-filled)`);
        Alert.alert('Code Ready', `Your verification code is: ${res.devOtp}`);
      } else {
        Alert.alert('Code Sent', res.message || 'A fresh 6-digit verification code was sent to your Gmail.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not resend code. Please try again later.');
    } finally {
      setBusy(false);
    }
  };

  const ready =
    mode === 'login'
      ? Boolean(loginUsername.trim() && loginPassword)
      : Boolean(
          name.trim() &&
            username.trim().length >= 3 &&
            idYear.trim().length === 4 &&
            idNumberPart.trim().length >= 3 &&
            phone.trim().length >= 10 &&
            email.trim().length > 5 &&
            password.length >= 8
        );

  const dynamicPaddingBottom = keyboardVisible ? Math.max(keyboardHeight + 80, 360) : 48;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: TOP + (keyboardVisible ? 6 : 16),
          paddingBottom: dynamicPaddingBottom,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Shield & Title (Compact when keyboard is active to maximize typing space) */}
        {!keyboardVisible ? (
          <View style={s.hero}>
            <View style={s.shieldBadge}>
              <MaterialCommunityIcons name="hospital-box" size={40} color={C.gold} />
            </View>
            <Text style={s.brandTitle}>Iwatch</Text>
            <Text style={s.brandSubtitle}>Campus Emergency Response Network</Text>
          </View>
        ) : (
          <View style={s.heroCompact}>
            <View style={s.shieldBadgeCompact}>
              <MaterialCommunityIcons name="hospital-box" size={18} color={C.gold} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.brandTitleCompact}>Iwatch</Text>
              <Text style={s.brandSubtitleCompact}>Campus Emergency Network</Text>
            </View>
          </View>
        )}

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
              <Text style={s.otpTitle}>Verify Your Email</Text>
              <Text style={s.otpDesc}>
                We sent a 6-digit verification code to:
              </Text>
              <View style={s.emailBadge}>
                <Ionicons name="mail" size={14} color={C.forest} style={{ marginRight: 6 }} />
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
              {mode === 'login' ? (
                /* ---------- Sign In Form ---------- */
                <>
                  <Field
                    ref={loginUsernameRef}
                    label="Username"
                    value={loginUsername}
                    onChangeText={setLoginUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Enter your username"
                    returnKeyType="next"
                    onFocus={() => scrollToInput(40)}
                    onSubmitEditing={() => loginPasswordRef.current?.focus()}
                  />

                  <Field
                    ref={loginPasswordRef}
                    label="Password"
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="Enter your password"
                    returnKeyType={ready ? 'done' : 'default'}
                    onFocus={() => scrollToInput(110)}
                    onSubmitEditing={() => {
                      if (ready) submit();
                    }}
                  />
                </>
              ) : (
                /* ---------- Create Account Form ---------- */
                <>
                  {/* Account Type Selector */}
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
                        Responder registrations must be verified by email and approved by Campus Admin before sign-in.
                      </Text>
                    </View>
                  )}

                  {/* 1. Full Name (No placeholder) */}
                  <Field
                    ref={nameInputRef}
                    label="Full Name"
                    value={name}
                    onChangeText={setName}
                    placeholder=""
                    returnKeyType="next"
                    onFocus={() => scrollToInput(50)}
                    onSubmitEditing={() => suffixInputRef.current?.focus()}
                  />

                  {/* 2. Suffix (optional) */}
                  <Field
                    ref={suffixInputRef}
                    label="Suffix (optional)"
                    value={suffix}
                    onChangeText={setSuffix}
                    placeholder=""
                    maxLength={15}
                    returnKeyType="next"
                    onFocus={() => scrollToInput(110)}
                    onSubmitEditing={() => usernameInputRef.current?.focus()}
                  />

                  {/* 3. Username */}
                  <Field
                    ref={usernameInputRef}
                    label="Username"
                    value={username}
                    onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_.-]/g, ''))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Choose a username"
                    returnKeyType="next"
                    onFocus={() => scrollToInput(170)}
                    onSubmitEditing={() => idYearRef.current?.focus()}
                  />

                  {/* 4. Student ID Number (No placeholder, unchangeable dash separation) */}
                  <View style={s.fieldWrapper}>
                    <Text style={s.fieldLabel}>
                      {role === 'student' ? 'Student ID Number' : 'Responder ID Number'}
                    </Text>
                    <View style={s.idCompoundContainer}>
                      <TextInput
                        ref={idYearRef}
                        style={s.idYearInput}
                        value={idYear}
                        onChangeText={(val) => {
                          const clean = val.replace(/[^0-9]/g, '').slice(0, 4);
                          setIdYear(clean);
                          if (clean.length === 4) {
                            idRestRef.current?.focus();
                          }
                        }}
                        placeholder=""
                        placeholderTextColor={C.muted}
                        keyboardType="number-pad"
                        maxLength={4}
                        returnKeyType="next"
                        onFocus={() => scrollToInput(230)}
                      />
                      <View style={s.idDashContainer}>
                        <Text style={s.idDashText}>-</Text>
                      </View>
                      <TextInput
                        ref={idRestRef}
                        style={s.idRestInput}
                        value={idNumberPart}
                        onChangeText={(val) => {
                          const clean = val.replace(/[^0-9A-Za-z]/g, '').slice(0, 7);
                          setIdNumberPart(clean);
                        }}
                        onKeyPress={({ nativeEvent }) => {
                          if (nativeEvent.key === 'Backspace' && idNumberPart === '') {
                            idYearRef.current?.focus();
                          }
                        }}
                        placeholder=""
                        placeholderTextColor={C.muted}
                        keyboardType="number-pad"
                        maxLength={7}
                        returnKeyType="next"
                        onFocus={() => scrollToInput(230)}
                        onSubmitEditing={() => phoneInputRef.current?.focus()}
                      />
                    </View>
                  </View>

                  {/* 5. Phone Number */}
                  <Field
                    ref={phoneInputRef}
                    label="Phone Number"
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 11))}
                    placeholder="09XXXXXXXXX"
                    keyboardType="phone-pad"
                    maxLength={11}
                    returnKeyType="next"
                    onFocus={() => scrollToInput(290)}
                    onSubmitEditing={() => emailInputRef.current?.focus()}
                  />

                  {/* 6. Email Address */}
                  <Field
                    ref={emailInputRef}
                    label="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    placeholder="yourname@gmail.com"
                    returnKeyType="next"
                    onFocus={() => scrollToInput(360)}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />

                  {/* 7. Password (At least 8 characters) */}
                  <Field
                    ref={passwordInputRef}
                    label="Password (At least 8 characters)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="At least 8 characters"
                    returnKeyType={ready ? 'done' : 'default'}
                    onFocus={scrollToBottom}
                    onSubmitEditing={() => {
                      if (ready) submit();
                    }}
                  />
                </>
              )}

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
  heroCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    ...SHADOWS.sm,
  },
  shieldBadgeCompact: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.forest,
    borderWidth: 1.5,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleCompact: {
    fontSize: 18,
    fontWeight: '900',
    color: C.forest,
    letterSpacing: 0.5,
  },
  brandSubtitleCompact: {
    fontSize: 11,
    color: C.sub,
    fontWeight: '600',
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

  // Compound ID Input Styles
  fieldWrapper: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  idCompoundContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  idYearInput: {
    width: 86,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  idDashContainer: {
    width: 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  idDashText: {
    fontSize: 18,
    fontWeight: '900',
    color: C.forest,
  },
  idRestInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
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
