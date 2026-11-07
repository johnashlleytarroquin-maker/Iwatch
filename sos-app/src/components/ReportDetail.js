import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { Avatar, Badge, Btn, Card, Header, TypeIcon } from '../ui';
import { ACTIVE, C, SHADOWS, STATUS, fmtTime, typeInfo } from '../theme';

const ORDER = ['open', 'acknowledged', 'on_the_way'];

const ACTION_TEXT = {
  created: 'SOS Alert Triggered',
  acknowledged: 'Dispatched & Acknowledged',
  on_the_way: 'Responder En Route',
  resolved: 'Incident Resolved & Closed',
  cancelled: 'Cancelled by Student',
};

export default function ReportDetail({ report, onClose, onChanged }) {
  const [timeline, setTimeline] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!report) return;
    let alive = true;
    api
      .get(`/api/reports/${report.id}`)
      .then((d) => alive && setTimeline(d.timeline || []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [report?.id, report?.status]);

  if (!report) return null;
  const t = typeInfo(report.type);
  const st = STATUS[report.status] || STATUS.open;
  const active = ACTIVE.includes(report.status);
  const idx = ORDER.indexOf(report.status);

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const { report: updated } = await api.patch(`/api/reports/${report.id}/status`, { status });
      onChanged(updated);
    } catch (e) {
      Alert.alert('Status Update Failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmResolve = () =>
    Alert.alert(
      'Resolve & Close Incident?',
      'This marks the emergency as handled and resolves the alert for student and responders.',
      [
        { text: 'Keep Active', style: 'cancel' },
        { text: 'Resolve Incident', onPress: () => setStatus('resolved') },
      ]
    );

  const hasGps = report.lat != null && report.lng != null;
  const openMap = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lng}`);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Header
          title={t.label}
          subtitle={`Case #${report.id} • ${fmtTime(report.createdAt)}`}
          right={
            <TouchableOpacity
              onPress={onClose}
              style={s.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={C.text} />
            </TouchableOpacity>
          }
        />

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }}>
          {/* Status Progression Bar */}
          <View style={s.statusBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.statusIconCircle, { backgroundColor: st.bg }]}>
                <Ionicons name={st.icon || 'alert-circle'} size={24} color={st.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statusBannerLabel}>INCIDENT STATUS</Text>
                <Text style={[s.statusBannerTitle, { color: st.color }]}>{st.label.toUpperCase()}</Text>
              </View>
              <Badge text={st.short} color={st.color} bg={st.bg} />
            </View>
          </View>

          {/* Location Section */}
          <Text style={s.sectionHeader}>INCIDENT LOCATION</Text>
          <Card style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={s.cardIcon}>
                <Ionicons name="location" size={22} color={C.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.locTitle}>Reported Location</Text>
                <Text style={s.locText}>{report.locationText || 'No specific room/floor entered'}</Text>
                {hasGps ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={s.gpsCoordsText}>
                      COORDINATES: {report.lat.toFixed(6)}, {report.lng.toFixed(6)}
                    </Text>
                    <Btn
                      title="Open in Google Maps / Navigation"
                      onPress={openMap}
                      outline
                      color={C.blue}
                      small
                      icon={<Ionicons name="map-outline" size={16} color={C.blue} />}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                ) : (
                  <Text style={s.noGpsText}>No GPS fix recorded from student device.</Text>
                )}
              </View>
            </View>
          </Card>

          {/* Student Profile Section */}
          <Text style={s.sectionHeader}>REPORTED BY (STUDENT)</Text>
          <Card style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar
                uri={report.studentAvatar}
                name={report.studentName}
                size="md"
                color={C.indigo}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.studentName}>{report.studentName}</Text>
                <Text style={s.studentMeta}>
                  {report.studentIdNumber ? `ID: ${report.studentIdNumber}` : 'Student'}
                </Text>
              </View>
            </View>
            {report.studentPhone ? (
              <Btn
                title={`Call ${report.studentPhone}`}
                onPress={() => Linking.openURL(`tel:${report.studentPhone}`)}
                color={C.green}
                small
                icon={<Ionicons name="call" size={16} color="#fff" />}
                style={{ marginTop: 12 }}
              />
            ) : null}
          </Card>

          {/* Note / Details */}
          {report.note ? (
            <>
              <Text style={s.sectionHeader}>STUDENT BRIEF / REMARKS</Text>
              <Card style={s.card}>
                <Text style={s.noteText}>{report.note}</Text>
              </Card>
            </>
          ) : null}

          {/* Assigned Responder */}
          {report.responderName ? (
            <>
              <Text style={s.sectionHeader}>ASSIGNED RESPONDER</Text>
              <Card style={s.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="shield-checkmark" size={22} color={C.blue} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.responderNameText}>{report.responderName}</Text>
                    <Text style={s.responderSubText}>Campus Safety Officer</Text>
                  </View>
                </View>
              </Card>
            </>
          ) : null}

          {/* Action Deck for Active Incidents */}
          {active && (
            <View style={s.actionDeck}>
              <Text style={s.sectionHeader}>DISPATCH ACTIONS</Text>
              {idx < 1 && (
                <Btn
                  title="I RECEIVED & ACKNOWLEDGED THIS"
                  onPress={() => setStatus('acknowledged')}
                  color={C.amber}
                  loading={busy}
                  icon={<Ionicons name="eye" size={18} color="#0E2012" />}
                  style={{ marginBottom: 10 }}
                />
              )}
              {idx < 2 && (
                <Btn
                  title="I AM ON THE WAY TO LOCATION"
                  onPress={() => setStatus('on_the_way')}
                  color={C.blue}
                  loading={busy}
                  icon={<Ionicons name="navigate" size={18} color="#fff" />}
                  style={{ marginBottom: 10 }}
                />
              )}
              <Btn
                title="MARK INCIDENT AS RESOLVED"
                onPress={confirmResolve}
                color={C.green}
                loading={busy}
                icon={<Ionicons name="checkmark-done" size={18} color="#fff" />}
              />
            </View>
          )}

          {/* Timeline Audit Log */}
          <Text style={s.sectionHeader}>AUDIT TRAIL & DISPATCH LOG</Text>
          <Card style={s.card}>
            {timeline.length === 0 ? (
              <Text style={{ color: C.sub, fontSize: 13 }}>No events logged yet.</Text>
            ) : (
              timeline.map((e, i) => (
                <View key={e.id || i} style={s.timelineItem}>
                  <View style={s.timelineBullet}>
                    <View style={s.timelineDot} />
                    {i < timeline.length - 1 && <View style={s.timelineLine} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 16 }}>
                    <Text style={s.timelineAction}>{ACTION_TEXT[e.action] || e.action}</Text>
                    <Text style={s.timelineMeta}>
                      {fmtTime(e.createdAt)} {e.actorName ? `• ${e.actorName} (${e.actorRole || 'System'})` : ''}
                    </Text>
                    {e.details ? <Text style={s.timelineDetails}>{e.details}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.cardSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
  },
  statusBanner: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderLight,
    ...SHADOWS.sm,
  },
  statusIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.5,
  },
  statusBannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 1,
  },
  card: {
    padding: 14,
    borderRadius: 16,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.cardSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.5,
  },
  locText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginTop: 2,
  },
  gpsCoordsText: {
    fontSize: 11,
    color: C.sub,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noGpsText: {
    color: C.sub,
    fontSize: 12,
    marginTop: 4,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
  },
  studentMeta: {
    fontSize: 13,
    color: C.sub,
    marginTop: 2,
  },
  noteText: {
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
  },
  responderNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  responderSubText: {
    fontSize: 12,
    color: C.sub,
  },
  actionDeck: {
    marginTop: 6,
  },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
  },
  timelineBullet: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.blue,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: C.border,
    marginVertical: 4,
  },
  timelineAction: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },
  timelineMeta: {
    fontSize: 11,
    color: C.sub,
    marginTop: 2,
  },
  timelineDetails: {
    fontSize: 12,
    color: C.textSecondary,
    backgroundColor: C.bg,
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
  },
});
