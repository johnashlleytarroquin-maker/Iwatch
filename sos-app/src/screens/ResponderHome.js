import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth';
import { useReports } from '../useReports';
import { Avatar, Badge, Btn, Card, Field, Header, TabBar, TOP } from '../ui';
import { ACTIVE, C, SHADOWS, fmtTime } from '../theme';
import { api, getToken } from '../api';
import AlertModal from '../components/AlertModal';
import ReportDetail from '../components/ReportDetail';
import ReportList, { sortActive } from '../components/ReportList';
import { registerResponderPushToken, stopEmergencyAlarmSound, stopResponderVibration } from '../services/notifications';
import { ResponderService } from '../services/responderService';

export default function ResponderHome() {
  const { user, logout, socket, updateUser } = useAuth();
  const { reports, loading, reload, patch, alertReport, dismissAlert } = useReports();
  const [tab, setTab] = useState('live');
  const [selectedId, setSelectedId] = useState(null);
  const [presence, setPresence] = useState({ activeResponders: 1, activeUsers: 1 });
  const [profileOpen, setProfileOpen] = useState(false);

  // Register push token and start 24/7 background responder monitoring
  useEffect(() => {
    if (user?.role === 'responder') {
      registerResponderPushToken(user).catch(() => {});
      const token = getToken();
      if (token) {
        ResponderService.start(token);
      }
    }
  }, [user]);

  // Realtime active responder presence
  useEffect(() => {
    if (!socket) return undefined;
    const onPresence = (data) => {
      if (data) setPresence(data);
    };
    socket.on('presence:update', onPresence);
    return () => socket.off('presence:update', onPresence);
  }, [socket]);

  useEffect(() => {
    return () => {
      stopEmergencyAlarmSound();
      stopResponderVibration();
      ResponderService.silence();
    };
  }, []);

  const handleLogout = async () => {
    stopEmergencyAlarmSound();
    stopResponderVibration();
    ResponderService.stop();
    try {
      await api.post('/api/me/remove-push-token');
    } catch {}
    logout();
  };

  const active = sortActive(reports.filter((r) => ACTIVE.includes(r.status)));
  const history = reports.filter((r) => !ACTIVE.includes(r.status));
  const selected = reports.find((r) => r.id === selectedId) || null;
  const waiting = active.filter((r) => r.status === 'open').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Top Header */}
      <View style={s.topHeader}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setProfileOpen(true)}
          style={s.profileHeaderBtn}
        >
          <View style={{ position: 'relative' }}>
            <Avatar uri={user?.avatar} name={user?.name} size="md" color={C.forest} />
            <View style={s.onlineDot} />
          </View>
          <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={s.greetingName} numberOfLines={1}>
                {user?.name}
              </Text>
              <View style={s.dutyBadge}>
                <View style={s.greenDotMini} />
                <Text style={s.dutyBadgeText}>ON DUTY</Text>
              </View>
            </View>
            <Text style={s.greetingSub} numberOfLines={1}>
              Responder Dispatch • {presence.activeResponders} Online
            </Text>
          </View>
        </TouchableOpacity>

        <View style={s.headerActions}>
          <TouchableOpacity
            onPress={() => setProfileOpen(true)}
            style={s.headerCircleBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="person" size={17} color={C.forest} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            style={s.headerSignOutBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dispatch Metrics Dashboard Card */}
      <View style={s.metricsContainer}>
        <View style={[s.metricCard, waiting > 0 && s.metricCardUrgent]}>
          <View style={s.metricHeader}>
            <Ionicons name="notifications-outline" size={13} color={waiting > 0 ? C.red : C.sub} />
            <Text style={[s.metricLabel, waiting > 0 && { color: C.red }]}>WAITING</Text>
          </View>
          <Text style={[s.metricVal, waiting > 0 && { color: C.red }]}>{waiting}</Text>
        </View>

        <View style={s.metricCard}>
          <View style={s.metricHeader}>
            <Ionicons name="flash-outline" size={13} color={C.sub} />
            <Text style={s.metricLabel}>ACTIVE</Text>
          </View>
          <Text style={s.metricVal}>{active.length}</Text>
        </View>

        <View style={s.metricCard}>
          <View style={s.metricHeader}>
            <View style={s.pulseGreenMini} />
            <Text style={[s.metricLabel, { color: C.green }]}>ON DUTY</Text>
          </View>
          <Text style={[s.metricVal, { color: C.green }]}>{presence.activeResponders}</Text>
        </View>

        <View style={s.metricCard}>
          <View style={s.metricHeader}>
            <Ionicons name="people-outline" size={13} color={C.sub} />
            <Text style={s.metricLabel}>CAMPUS</Text>
          </View>
          <Text style={s.metricVal}>{presence.activeUsers}</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'live' ? (
          <ReportList
            data={active}
            loading={loading}
            onRefresh={reload}
            onPress={(r) => setSelectedId(r.id)}
            empty={
              <View style={s.allClearBox}>
                <View style={s.allClearIconCircle}>
                  <Ionicons name="shield-checkmark" size={42} color={C.forest} />
                </View>
                <Text style={s.allClearTitle}>Campus Perimeter All Clear</Text>
                <Text style={s.allClearSub}>
                  No active emergencies reported. You are actively on duty to receive incoming SOS alerts.
                </Text>
                <View style={s.liveMonitorPill}>
                  <View style={s.pulseDotGreen} />
                  <Text style={s.liveMonitorText}>24/7 BACKGROUND MONITORING ACTIVE</Text>
                </View>
              </View>
            }
          />
        ) : (
          <ReportList
            data={history}
            loading={loading}
            onRefresh={reload}
            onPress={(r) => setSelectedId(r.id)}
            empty="No closed reports in archive."
          />
        )}
      </View>

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'live', label: 'Live Alerts', badge: waiting },
          { key: 'history', label: 'History' },
        ]}
      />

      <ReportDetail report={selected} onClose={() => setSelectedId(null)} onChanged={patch} />
      <AlertModal
        report={alertReport}
        onDismiss={dismissAlert}
        onView={() => {
          setSelectedId(alertReport.id);
          setTab('live');
          dismissAlert();
        }}
      />

      {/* Responder Profile Dashboard Modal */}
      <ResponderProfileModal
        visible={profileOpen}
        user={user}
        onClose={() => setProfileOpen(false)}
        onUpdated={updateUser}
        onLogout={handleLogout}
      />
    </View>
  );
}

// Responder Profile Dashboard Modal Component
function ResponderProfileModal({ visible, user, onClose, onUpdated, onLogout }) {
  const [name, setName] = useState(user?.name || '');
  const [idNumber, setIdNumber] = useState(user?.idNumber || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setName(user.name || '');
      setIdNumber(user.idNumber || '');
      setPhone(user.phone || '');
      setAvatar(user.avatar || null);
    }
  }, [visible, user]);

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow photo library access in your settings to upload a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAvatar(base64Data);
      }
    } catch (e) {
      Alert.alert('Image Selection Failed', e.message);
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow camera access in your settings to take a profile picture.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setAvatar(base64Data);
      }
    } catch (e) {
      Alert.alert('Camera Capture Failed', e.message);
    }
  };

  const chooseAvatarOption = () => {
    Alert.alert(
      'Officer Profile Picture',
      'Select how you want to update your photo:',
      [
        { text: 'Choose from Gallery', onPress: pickFromGallery },
        { text: 'Take a Photo', onPress: takePhotoWithCamera },
        avatar ? { text: 'Remove Photo', style: 'destructive', onPress: () => setAvatar(null) } : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean)
    );
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Officer full name is required.');
      return;
    }
    setSaving(true);
    try {
      const { user: updated } = await api.patch('/api/me', {
        name: name.trim(),
        idNumber: idNumber.trim(),
        phone: phone.trim(),
        avatar,
      });
      onUpdated(updated);
      Alert.alert('Profile Saved', 'Your officer profile details have been successfully updated.');
      onClose();
    } catch (e) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Profile Header */}
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} style={s.closeModalBtn}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.modalTitle}>OFFICER PROFILE</Text>
            <Text style={s.modalSub}>Emergency Dispatch & Responder ID</Text>
          </View>
          <TouchableOpacity onPress={saveProfile} disabled={saving} style={s.saveHeaderBtn}>
            {saving ? (
              <ActivityIndicator size="small" color={C.blue} />
            ) : (
              <Text style={s.saveHeaderText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Hero Banner */}
          <View style={s.avatarCard}>
            <View style={s.avatarContainer}>
              <Avatar uri={avatar} name={name} size="xl" color={C.forest} />
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={chooseAvatarOption}
                style={s.cameraBadge}
              >
                <Ionicons name="camera" size={18} color="#0E2012" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={chooseAvatarOption}
              style={s.uploadPhotoBtn}
            >
              <Ionicons name="image-outline" size={16} color={C.blue} style={{ marginRight: 6 }} />
              <Text style={s.uploadPhotoText}>
                {avatar ? 'Change Profile Picture' : 'Upload Officer Photo'}
              </Text>
            </TouchableOpacity>

            <View style={s.verifiedRow}>
              <Ionicons name="shield-checkmark" size={16} color={C.blue} style={{ marginRight: 5 }} />
              <Text style={s.verifiedText}>Verified Campus Emergency Responder</Text>
            </View>
          </View>

          {/* Profile Form */}
          <Text style={s.profileSectionTitle}>OFFICER CREDENTIALS</Text>

          <Field
            label="Officer Full Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Officer Juan Dela Cruz"
          />

          <Field
            label="Badge / Responder ID Number"
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="e.g. SEC-2024-001"
            autoCapitalize="characters"
            helper="Displayed to students when you acknowledge or accept their emergency SOS."
          />

          <Field
            label="Dispatch Mobile / Radio Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 0917-123-4567"
            keyboardType="phone-pad"
            helper="Coordination line used by administrators and dispatchers during active operations."
          />

          {/* Account Details Card */}
          <Text style={[s.profileSectionTitle, { marginTop: 10 }]}>SYSTEM CREDENTIALS</Text>
          <View style={s.infoCard}>
            <View style={s.infoRow}>
              <Ionicons name="mail-outline" size={18} color={C.sub} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>REGISTERED EMAIL</Text>
                <Text style={s.infoValue}>{user?.email}</Text>
              </View>
              <Badge text="AUTHORIZED" color={C.green} bg={C.greenBg} size="sm" />
            </View>
            <View style={[s.infoRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: C.borderLight, paddingTop: 10 }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={C.sub} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>DISPATCH ROLE</Text>
                <Text style={s.infoValue}>Campus Emergency Responder</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <Btn
            title="SAVE OFFICER PROFILE"
            onPress={saveProfile}
            color={C.blue}
            loading={saving}
            icon={<Ionicons name="checkmark-circle-outline" size={18} color="#fff" />}
            style={{ marginTop: 22, ...SHADOWS.md }}
          />

          <Btn
            title="Sign Out of Dispatch Console"
            onPress={() => {
              onClose();
              onLogout();
            }}
            outline
            color={C.red}
            icon={<Ionicons name="log-out-outline" size={18} color={C.red} />}
            style={{ marginTop: 12 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  profileHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.forestBg,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.forestBorder,
  },
  topHeader: {
    paddingTop: TOP,
    paddingBottom: 14,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: '#fff',
  },
  greetingName: {
    fontSize: 17,
    fontWeight: '900',
    color: C.text,
    marginRight: 6,
  },
  dutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  greenDotMini: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
    marginRight: 4,
  },
  dutyBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: '600',
    color: C.sub,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSignOutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Metrics dashboard
  metricsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  metricCardUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECDD3',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.sub,
    marginLeft: 3,
    letterSpacing: 0.4,
  },
  metricVal: {
    fontSize: 17,
    fontWeight: '900',
    color: C.text,
  },
  pulseGreenMini: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },

  // All clear empty state
  allClearBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  allClearIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#DCFCE7',
    borderWidth: 3,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  allClearTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  allClearSub: {
    fontSize: 13,
    color: C.sub,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 20,
  },
  liveMonitorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pulseDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  liveMonitorText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },

  // Modal Header Styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  closeModalBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.cardSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 0.5,
  },
  modalSub: {
    fontSize: 11,
    color: C.sub,
    marginTop: 1,
    fontWeight: '600',
  },
  saveHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.blueBg,
  },
  saveHeaderText: {
    color: C.blue,
    fontWeight: '800',
    fontSize: 14,
  },

  // Avatar Card Styles
  avatarCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.borderLight,
    ...SHADOWS.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: C.gold,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    ...SHADOWS.md,
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.blueBg,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  uploadPhotoText: {
    color: C.blue,
    fontWeight: '800',
    fontSize: 13,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  verifiedText: {
    color: C.blue,
    fontWeight: '700',
    fontSize: 11,
  },

  // Profile Section Styles
  profileSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: C.sub,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.muted,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginTop: 2,
  },
});
