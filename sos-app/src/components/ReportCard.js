import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card, TypeIcon } from '../ui';
import { C, SHADOWS, STATUS, timeAgo, typeInfo } from '../theme';

export default function ReportCard({ report, onPress, showStudent = true }) {
  const t = typeInfo(report.type);
  const st = STATUS[report.status] || STATUS.open;
  const isUrgent = report.status === 'open';

  return (
    <Card
      onPress={onPress}
      style={[
        s.card,
        isUrgent ? { borderColor: C.red, borderWidth: 1.5, ...SHADOWS.glow(C.red) } : s.normalBorder,
      ]}
    >
      {/* Top Bar: Icon, Title, Case ID, Status Badge */}
      <View style={s.topRow}>
        <View style={[s.iconBox, { backgroundColor: t.bg }]}>
          <TypeIcon typeKey={report.type} size={22} color={t.color} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.title}>{t.label}</Text>
            {isUrgent && <View style={s.urgentDot} />}
          </View>
          <Text style={s.sub}>
            Case #{report.id} • {timeAgo(report.createdAt)}
          </Text>
        </View>

        <Badge text={st.short} color={st.color} bg={st.bg} size="sm" />
      </View>

      {/* Location row */}
      <View style={s.locationRow}>
        <Ionicons name="location-sharp" size={15} color={C.red} style={{ marginRight: 6 }} />
        <Text style={s.locationText} numberOfLines={1}>
          {report.locationText || (report.lat != null ? 'GPS Coordinates Shared' : 'No location specified')}
        </Text>
      </View>

      {/* Student & Responder Info Footer */}
      {showStudent && (
        <View style={s.footerRow}>
          <View style={s.studentInfo}>
            <Avatar
              uri={report.studentAvatar}
              name={report.studentName}
              size="sm"
              style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, marginRight: 6 }}
            />
            <Text style={s.studentText} numberOfLines={1}>
              {report.studentName}
              {report.studentIdNumber ? ` (${report.studentIdNumber})` : ''}
            </Text>
          </View>

          {report.responderName ? (
            <View style={s.responderPill}>
              <Ionicons name="shield-checkmark" size={13} color={C.blue} style={{ marginRight: 4 }} />
              <Text style={s.responderText} numberOfLines={1}>
                {report.responderName}
              </Text>
            </View>
          ) : isUrgent ? (
            <View style={s.unassignedPill}>
              <Text style={s.unassignedText}>UNASSIGNED</Text>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  normalBorder: {
    borderColor: C.borderLight,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  urgentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.red,
    marginLeft: 6,
  },
  sub: {
    fontSize: 12,
    color: C.sub,
    fontWeight: '600',
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 8,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  studentText: {
    fontSize: 12,
    color: C.sub,
    fontWeight: '600',
  },
  responderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.blueBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  responderText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.blueDark,
    maxWidth: 120,
  },
  unassignedPill: {
    backgroundColor: C.redBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unassignedText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.red,
    letterSpacing: 0.5,
  },
});
