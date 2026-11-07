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
import { Avatar, Badge, Btn, Card, Field, Header, TabBar } from '../ui';
import { ACTIVE, C, SHADOWS, fmtTime } from '../theme';
import { api } from '../api';
import AlertModal from '../components/AlertModal';
import ReportDetail from '../components/ReportDetail';
import ReportList, { sortActive } from '../components/ReportList';
import { registerResponderPushToken, stopEmergencyAlarmSound, stopResponderVibration } from '../services/notifications';

export default function ResponderHome() {
  const { user, logout, socket, updateUser } = useAuth();
  const { reports, loading, reload, patch, alertReport, dismissAlert } = useReports();
  const [tab, setTab] = useState('live');
  const [selectedId, setSelectedId] = useState(null);
  const [presence, setPresence] = useState({ activeResponders: 1, activeUsers: 1 });
  const [profileOpen, setProfileOpen] = useState(false);

  // Register push notification token on device startup so responders get alerts even if app is closed
  useEffect(() => {
    if (user?.role === 'responder') {
      registerResponderPushToken(user).catch(() => {});
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
    };
  }, []);

  const handleLogout = async () => {
    stopEmergencyAlarmSound();
    stopResponderVibration();
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
      <Header
        title="Responder Dispatch"
        subtitle={`${user.name} • On Duty (🟢 ${presence.activeResponders} Online)`}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setProfileOpen(true)}
              style={s.profileHeaderPill}
            >
              <Avatar uri={user.avatar} name={user.name} size="sm" color={C.forest} style={{ marginRight: 6 }} />
              <Text style={s.profileHeaderPillText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              style={s.signOutBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="log-out-outline" size={16} color={C.sub} style={{ marginRight: 4 }} />
              <Text style={{ color: C.sub, fontWeight: '700', fontSize: 13 }}>Sign out</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Dispatch Status Bar */}
      <View style={s.summaryBar}>
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, waiting > 0 && { color: C.red }]}>{waiting}</Text>
          <Text style={s.summaryLabel}>WAITING DISPATCH</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{active.length}</Text>
          <Text style={s.summaryLabel}>TOTAL ACTIVE</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={s.greenDot} />
            <Text style={[s.summaryVal, { color: C.green }]}>{presence.activeResponders}</Text>
          </View>
          <Text style={s.summaryLabel}>ON-DUTY NOW</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: C.text }]}>{presence.activeUsers}</Text>
          <Text style={s.summaryLabel}>CAMPUS USERS</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'live' ? (
          <ReportList
            data={active}
            loading={loading}
            onRefresh={reload}
            onPress={(r) => setSelectedId(r.id)}
            empty="No active emergencies on campus. All clear."
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
  profileHeaderPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.forest,
    marginRight: 4,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: C.cardSubtle,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryVal: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: '70%',
    backgroundColor: C.border,
    alignSelf: 'center',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
    marginRight: 4,
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
