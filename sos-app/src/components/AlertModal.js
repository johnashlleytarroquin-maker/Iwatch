import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Btn, TypeIcon } from '../ui';
import { C, SHADOWS, typeInfo } from '../theme';
import { stopEmergencyAlarmSound, stopResponderVibration } from '../services/notifications';
import { ResponderService } from '../services/responderService';

// Full-screen takeover shown to responders and admins when a new SOS arrives.
export default function AlertModal({ report, onView, onDismiss }) {
  if (!report) return null;
  const t = typeInfo(report.type);

  const handleAccept = () => {
    stopEmergencyAlarmSound();
    stopResponderVibration();
    ResponderService.silence();
    onView();
  };

  const handleDismiss = () => {
    stopEmergencyAlarmSound();
    stopResponderVibration();
    ResponderService.silence();
    onDismiss();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={s.overlay}>
        <View style={s.container}>
          {/* Beacon Header */}
          <View style={s.beaconPill}>
            <View style={s.beaconDot} />
            <Text style={s.beaconText}>CRITICAL EMERGENCY DISPATCH</Text>
          </View>

          {/* Central Pulsing Icon */}
          <View style={s.iconRingOuter}>
            <View style={s.iconRingInner}>
              <TypeIcon typeKey={report.type} size={48} color="#fff" />
            </View>
          </View>

          {/* Emergency Type & Title */}
          <Text style={s.emergencyTitle}>{t.label.toUpperCase()}</Text>
          <Text style={s.caseId}>Case #{report.id} • Immediate Action Required</Text>

          {/* Location & Reporter Card */}
          <View style={s.detailsCard}>
            <View style={s.detailRow}>
              <Ionicons name="location" size={20} color={C.red} style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.detailLabel}>REPORTED LOCATION</Text>
                <Text style={s.detailValue}>{report.locationText || 'GPS Coordinates Only'}</Text>
              </View>
            </View>

            <View
              style={[
                s.detailRow,
                { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 10 },
              ]}
            >
              <Ionicons name="person" size={18} color="#FCA5A5" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.detailLabel}>REPORTED BY</Text>
                <Text style={s.reporterName}>
                  {report.studentName}
                  {report.studentIdNumber ? ` (${report.studentIdNumber})` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={s.actionBox}>
            <Btn
              title="ACCEPT & RESPOND NOW"
              onPress={handleAccept}
              color="#fff"
              textStyle={{ color: C.redDark, fontWeight: '900' }}
              icon={<Ionicons name="flash" size={18} color={C.redDark} />}
              style={{ marginBottom: 12, ...SHADOWS.md }}
            />
            <Btn
              title="Dismiss Notification"
              onPress={handleDismiss}
              color="#fff"
              outline
              textStyle={{ color: '#fff' }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#7F1D1D',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    alignItems: 'center',
  },
  beaconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  beaconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  beaconText: {
    color: '#FEE2E2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  iconRingOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconRingInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.redDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  emergencyTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  caseId: {
    fontSize: 13,
    color: '#FCA5A5',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 24,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FCA5A5',
    letterSpacing: 1,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  reporterName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  actionBox: {
    width: '100%',
  },
});
