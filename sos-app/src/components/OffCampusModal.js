import React from 'react';
import {
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Btn } from '../ui';
import { C, SHADOWS } from '../theme';
import { CAMPUS_CONFIG } from '../config';

/**
 * Intelligent 911 Fallback Modal.
 * Appears when a student triggers SOS from outside the SNSU 500m campus boundary.
 */
export default function OffCampusModal({
  visible,
  distanceFormatted = 'several kilometers',
  onProceedRecord,
  onDismiss,
}) {
  const call911 = () => {
    Linking.openURL(`tel:${CAMPUS_CONFIG.emergencyHotline}`).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <View style={s.card}>
          {/* Header Icon */}
          <View style={s.iconCircle}>
            <Ionicons name="location-outline" size={38} color="#DC2626" />
          </View>

          {/* Title */}
          <Text style={s.title}>OUTSIDE CAMPUS BOUNDARY</Text>
          <Text style={s.subTitle}>Surigao del Norte State University (Main Campus)</Text>

          {/* Distance Badge */}
          <View style={s.distanceBadge}>
            <Ionicons name="navigate" size={14} color="#B45309" style={{ marginRight: 6 }} />
            <Text style={s.distanceText}>
              You are approximately {distanceFormatted} from campus grounds
            </Text>
          </View>

          {/* Explanation Text */}
          <View style={s.infoBox}>
            <Text style={s.infoText}>
              Iwatch emergency dispatch is configured for <Text style={s.bold}>on-campus response (500m boundary)</Text>.
              Campus safety officers cannot physically deploy off-campus.
            </Text>
            <Text style={[s.infoText, { marginTop: 8 }]}>
              For off-campus emergencies, please contact the <Text style={s.bold}>National Emergency Hotline (911)</Text> immediately.
            </Text>
          </View>

          {/* Action Buttons */}
          <Btn
            title="📞 CALL 911 EMERGENCY NOW"
            onPress={call911}
            color="#DC2626"
            style={{ width: '100%', paddingVertical: 16, marginBottom: 10, ...SHADOWS.md }}
            textStyle={{ fontWeight: '900', fontSize: 16 }}
            icon={<Ionicons name="call" size={20} color="#fff" />}
          />

          {onProceedRecord ? (
            <Btn
              title="Submit Incident Record Only (Off-Campus)"
              onPress={onProceedRecord}
              color={C.blue}
              outline
              style={{ width: '100%', marginBottom: 10 }}
              textStyle={{ fontWeight: '700', fontSize: 13 }}
            />
          ) : null}

          <TouchableOpacity onPress={onDismiss} style={s.dismissBtn}>
            <Text style={s.dismissText}>Dismiss & Return</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.green,
    textAlign: 'center',
    marginTop: 4,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  infoBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
  },
  infoText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    textAlign: 'center',
  },
  bold: {
    fontWeight: '800',
    color: '#111827',
  },
  dismissBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.sub,
  },
});
