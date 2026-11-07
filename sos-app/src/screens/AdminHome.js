import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../api';
import { useAuth } from '../auth';
import { useReports } from '../useReports';
import { Avatar, Badge, Btn, Card, Chip, Empty, Field, Header, TabBar } from '../ui';
import { ACTIVE, C, SHADOWS, fmtTime, timeAgo } from '../theme';
import AlertModal from '../components/AlertModal';
import ReportDetail from '../components/ReportDetail';
import ReportList, { sortActive } from '../components/ReportList';

export default function AdminHome() {
  const { user, logout, socket } = useAuth();
  const { reports, loading, reload, patch, alertReport, dismissAlert } = useReports();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.get('/api/admin/stats'));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 30000);
    return () => clearInterval(t);
  }, [loadStats]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('user:pending', loadStats);
    socket.on('report:new', loadStats);
    socket.on('report:update', loadStats);
    socket.on('presence:update', (data) => {
      if (data) {
        setStats((prev) => ({
          ...prev,
          responders: data.activeResponders,
          students: data.activeStudents,
          activeUsers: data.activeUsers,
        }));
      }
    });
    return () => {
      socket.off('user:pending', loadStats);
      socket.off('report:new', loadStats);
      socket.off('report:update', loadStats);
      socket.off('presence:update');
    };
  }, [socket, loadStats]);

  const active = sortActive(reports.filter((r) => ACTIVE.includes(r.status)));
  const selected = reports.find((r) => r.id === selectedId) || null;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Admin Console"
        subtitle={`${user.name} • System Administrator`}
        right={
          <TouchableOpacity
            onPress={logout}
            style={s.signOutBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="log-out-outline" size={16} color={C.sub} style={{ marginRight: 4 }} />
            <Text style={{ color: C.sub, fontWeight: '700', fontSize: 13 }}>Sign out</Text>
          </TouchableOpacity>
        }
      />

      <View style={{ flex: 1 }}>
        {tab === 'overview' && (
          <ReportList
            data={active}
            loading={loading}
            onRefresh={() => {
              reload();
              loadStats();
            }}
            onPress={(r) => setSelectedId(r.id)}
            empty="No active campus emergencies at this time."
            header={<Overview stats={stats} />}
          />
        )}
        {tab === 'approvals' && <Approvals onChanged={loadStats} />}
        {tab === 'accounts' && <Accounts onChanged={loadStats} />}
        {tab === 'history' && <History />}
      </View>

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview', badge: stats?.activeReports || 0 },
          { key: 'approvals', label: 'Approvals', badge: stats?.pendingResponders || 0 },
          { key: 'accounts', label: 'Accounts' },
          { key: 'history', label: 'Audit Log' },
        ]}
      />

      <ReportDetail report={selected} onClose={() => setSelectedId(null)} onChanged={patch} />
      <AlertModal
        report={alertReport}
        onDismiss={dismissAlert}
        onView={() => {
          setSelectedId(alertReport.id);
          setTab('overview');
          dismissAlert();
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------- Overview
function Overview({ stats }) {
  const tiles = [
    { label: 'Active Now', value: stats?.activeReports ?? 0, color: C.red, bg: C.redBg, icon: 'warning-outline' },
    { label: 'Active Responders', value: stats?.responders ?? 0, color: C.forest, bg: C.forestBg, icon: 'shield-checkmark' },
    { label: 'Active Users', value: stats?.activeUsers ?? 0, color: C.goldDark, bg: C.goldBg, icon: 'pulse' },
    { label: 'Reports Today', value: stats?.reportsToday ?? 0, color: C.forest, bg: C.forestBg, icon: 'today-outline' },
    { label: 'Pending Approval', value: stats?.pendingResponders ?? 0, color: C.goldDark, bg: C.goldBg, icon: 'hourglass-outline' },
    { label: 'Enrolled Total', value: (stats?.totalStudents || 0) + (stats?.totalResponders || 0), color: C.sub, bg: C.cardSubtle, icon: 'people-outline' },
  ];

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={s.statsGrid}>
        {tiles.map((t) => (
          <View key={t.label} style={s.statCol}>
            <View style={s.statCard}>
              <View style={[s.statIconCircle, { backgroundColor: t.bg }]}>
                <Ionicons name={t.icon} size={18} color={t.color} />
              </View>
              <Text style={[s.statNumber, { color: t.color }]}>
                {stats ? t.value : '–'}
              </Text>
              <Text style={s.statLabel} numberOfLines={1}>{t.label}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={s.sectionHeader}>LIVE EMERGENCY DISPATCHES</Text>
    </View>
  );
}

// --------------------------------------------------------------- Approvals
function Approvals({ onChanged }) {
  const { socket } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { users: list } = await api.get('/api/admin/users?status=pending');
      setUsers(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('user:pending', load);
    return () => socket.off('user:pending', load);
  }, [socket, load]);

  const act = async (u, status) => {
    try {
      await api.patch(`/api/admin/users/${u.id}`, { status });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      onChanged();
    } catch (e) {
      Alert.alert('Action Failed', e.message);
    }
  };

  const confirmReject = (u) =>
    Alert.alert('Reject Registration?', `${u.name} will not be granted access to the responder portal.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => act(u, 'rejected') },
    ]);

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => String(u.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.blue} />}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
        ) : (
          <Empty icon="checkmark-done-circle-outline" text="All registrations reviewed." subtext="No pending responder approvals." />
        )
      }
      renderItem={({ item: u }) => (
        <Card style={s.approvalCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Avatar uri={u.avatar} name={u.name} size="sm" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.userName}>{u.name}</Text>
              <Text style={s.userEmail}>{u.email}</Text>
            </View>
            <Badge text={u.role.toUpperCase()} color={C.blue} />
          </View>

          <View style={s.metaRow}>
            <Ionicons name="card-outline" size={14} color={C.sub} style={{ marginRight: 4 }} />
            <Text style={s.metaText}>
              {u.idNumber ? `ID: ${u.idNumber}` : 'No ID given'}
              {u.phone ? ` • Phone: ${u.phone}` : ''}
            </Text>
          </View>
          <Text style={s.timeAgoText}>Requested {timeAgo(u.createdAt)}</Text>

          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <Btn
              title="Approve Responder"
              color={C.green}
              small
              icon={<Ionicons name="checkmark" size={16} color="#fff" />}
              onPress={() => act(u, 'approved')}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Btn
              title="Reject"
              color={C.red}
              outline
              small
              icon={<Ionicons name="close" size={16} color={C.red} />}
              onPress={() => confirmReject(u)}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}
    />
  );
}

// ---------------------------------------------------------------- Accounts
const STATUS_COLOR = { approved: C.green, pending: C.amber, rejected: C.red, disabled: C.gray };

function Accounts({ onChanged }) {
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetFor, setResetFor] = useState(null);
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = [];
      if (role) params.push(`role=${role}`);
      if (q.trim()) params.push(`q=${encodeURIComponent(q.trim())}`);
      const { users: list } = await api.get(`/api/admin/users${params.length ? '?' + params.join('&') : ''}`);
      setUsers(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [role, q]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const setStatus = async (u, status) => {
    try {
      const { user: updated } = await api.patch(`/api/admin/users/${u.id}`, { status });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
      onChanged();
    } catch (e) {
      Alert.alert('Status Update Failed', e.message);
    }
  };

  const confirmDisable = (u) =>
    Alert.alert('Disable Account?', `${u.name} will be immediately signed out and restricted from accessing the system.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disable', style: 'destructive', onPress: () => setStatus(u, 'disabled') },
    ]);

  const savePassword = async () => {
    setSaving(true);
    try {
      await api.post(`/api/admin/users/${resetFor.id}/reset-password`, { password: pw });
      Alert.alert('Password Reset Complete', `New credentials set for ${resetFor.name}.`);
      setResetFor(null);
      setPw('');
    } catch (e) {
      Alert.alert('Could Not Reset Password', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 6 }}>
        <View style={s.searchBar}>
          <Ionicons name="search" size={18} color={C.muted} style={{ marginRight: 8 }} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by name, email or ID number"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            style={s.searchInput}
          />
          {q ? (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={C.sub} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <Chip label="All Accounts" selected={role === ''} onPress={() => setRole('')} />
          <Chip label="Students" selected={role === 'student'} onPress={() => setRole('student')} />
          <Chip label="Responders" selected={role === 'responder'} onPress={() => setRole('responder')} />
        </View>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.blue} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
          ) : (
            <Empty icon="people-outline" text="No accounts match filter criteria." />
          )
        }
        renderItem={({ item: u }) => (
          <Card style={s.accountCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Avatar uri={u.avatar} name={u.name} size="sm" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={s.userName}>{u.name}</Text>
                  {u.isOnline && (
                    <View style={s.onlinePill}>
                      <View style={s.onlineDotSmall} />
                      <Text style={s.onlinePillText}>ONLINE</Text>
                    </View>
                  )}
                </View>
                <Text style={s.userEmail}>
                  {u.role.toUpperCase()} • {u.email}
                </Text>
              </View>
              <Badge text={u.status.toUpperCase()} color={STATUS_COLOR[u.status] || C.gray} />
            </View>

            <View style={s.metaRow}>
              <Ionicons name="information-circle-outline" size={14} color={C.sub} style={{ marginRight: 4 }} />
              <Text style={s.metaText}>
                {u.idNumber ? `ID: ${u.idNumber}` : 'No ID'}
                {u.phone ? ` • ${u.phone}` : ''} • Joined {fmtTime(u.createdAt)}
              </Text>
            </View>

            {u.role !== 'admin' && (
              <View style={{ flexDirection: 'row', marginTop: 12, borderTopWidth: 1, borderTopColor: C.borderLight, paddingTop: 10 }}>
                {u.status === 'approved' && (
                  <>
                    <Btn title="Disable" small outline color={C.red} onPress={() => confirmDisable(u)} style={{ marginRight: 8 }} />
                    <Btn title="Reset Password" small outline color={C.blue} onPress={() => setResetFor(u)} />
                  </>
                )}
                {u.status === 'disabled' && (
                  <Btn title="Re-enable Account" small color={C.green} onPress={() => setStatus(u, 'approved')} />
                )}
                {u.status === 'pending' && (
                  <>
                    <Btn title="Approve" small color={C.green} onPress={() => setStatus(u, 'approved')} style={{ marginRight: 8 }} />
                    <Btn title="Reject" small outline color={C.red} onPress={() => setStatus(u, 'rejected')} />
                  </>
                )}
                {u.status === 'rejected' && (
                  <Btn title="Approve Anyway" small color={C.green} onPress={() => setStatus(u, 'approved')} />
                )}
              </View>
            )}
          </Card>
        )}
      />

      {/* Password Reset Modal */}
      <Modal visible={!!resetFor} transparent animationType="fade" onRequestClose={() => setResetFor(null)}>
        <View style={s.modalOverlay}>
          <View style={s.resetCard}>
            <Text style={s.resetTitle}>Reset Password</Text>
            <Text style={s.resetSub}>Setting new password for {resetFor?.name}</Text>
            <Field
              label="New Password (min. 6 characters)"
              value={pw}
              onChangeText={setPw}
              autoCapitalize="none"
              secureTextEntry
              placeholder="••••••••"
            />
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <Btn
                title="Cancel"
                outline
                color={C.sub}
                small
                onPress={() => {
                  setResetFor(null);
                  setPw('');
                }}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Btn
                title="Save Password"
                small
                loading={saving}
                disabled={pw.length < 6}
                onPress={savePassword}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ----------------------------------------------------------------- History
const REPORT_VERB = {
  created: 'sent SOS alert',
  acknowledged: 'acknowledged incident',
  on_the_way: 'is on the way to',
  resolved: 'resolved & closed',
  cancelled: 'cancelled alert for',
};

const USER_TEXT = {
  register: (who) => `${who} registered new account`,
  approved: (who, d) => `${who} approved ${d}`,
  enabled: (who, d) => `${who} re-enabled ${d}`,
  rejected: (who, d) => `${who} rejected ${d}`,
  disabled: (who, d) => `${who} disabled ${d}`,
  password_reset: (who, d) => `${who} reset password for ${d}`,
  seed_admin: () => 'System seed: default admin initialized',
};

function describe(h) {
  const who = h.actorName || 'System';
  if (h.targetType === 'report') {
    const verb = REPORT_VERB[h.action] || h.action;
    return `${who} ${verb} Case #${h.targetId}`;
  }
  const fn = USER_TEXT[h.action];
  return fn ? fn(who, h.details) : `${who}: ${h.action}`;
}

function History() {
  const [type, setType] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { history } = await api.get(`/api/admin/history?limit=200${type ? `&type=${type}` : ''}`);
      setRows(history);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', padding: 16, paddingBottom: 6 }}>
        <Chip label="All Logs" selected={type === ''} onPress={() => setType('')} />
        <Chip label="User Accounts" selected={type === 'user'} onPress={() => setType('user')} />
        <Chip label="Incidents" selected={type === 'report'} onPress={() => setType('report')} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.blue} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={C.blue} style={{ marginTop: 40 }} />
          ) : (
            <Empty icon="time-outline" text="No audit history recorded." />
          )
        }
        renderItem={({ item: h }) => (
          <View style={s.historyRow}>
            <View style={s.historyDot} />
            <View style={{ flex: 1 }}>
              <Text style={s.historyDesc}>{describe(h)}</Text>
              {h.targetType === 'report' && h.details ? (
                <Text style={s.historyDetails}>{h.details}</Text>
              ) : null}
              <Text style={s.historyTime}>{fmtTime(h.createdAt)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: C.cardSubtle,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: C.sub,
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  statCol: {
    width: '33.33%',
    padding: 4,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    ...SHADOWS.sm,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    color: C.sub,
    fontWeight: '600',
    marginTop: 2,
  },

  // Approvals & accounts
  approvalCard: {
    marginBottom: 10,
    padding: 14,
  },
  accountCard: {
    marginBottom: 10,
    padding: 14,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: C.blue,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text,
  },
  userEmail: {
    fontSize: 12,
    color: C.sub,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: C.sub,
  },
  timeAgoText: {
    fontSize: 11,
    color: C.muted,
    marginTop: 4,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    paddingVertical: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  resetCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    ...SHADOWS.lg,
  },
  resetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: C.text,
  },
  resetSub: {
    fontSize: 13,
    color: C.sub,
    marginBottom: 14,
    marginTop: 2,
  },

  // Audit Log
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.blue,
    marginTop: 6,
    marginRight: 12,
  },
  historyDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    lineHeight: 18,
  },
  historyDetails: {
    fontSize: 12,
    color: C.sub,
    backgroundColor: C.bg,
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
  },
  historyTime: {
    fontSize: 11,
    color: C.muted,
    marginTop: 3,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.greenBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  onlineDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
    marginRight: 4,
  },
  onlinePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.green,
  },
});
