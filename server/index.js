const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const {
  supabase,
  JWT_SECRET,
  findUserById,
  findUserByEmail,
  createUser,
  updateUser,
  getUsers,
  getApprovedRespondersWithPushToken,
  getReport,
  getReports,
  createReport,
  updateReport,
  hasActiveReport,
  audit,
  getTimeline,
  getAuditHistory,
  getStats,
} = require('./db');

const PORT = process.env.PORT || 3000;
const REPORT_TYPES = ['medical', 'fire', 'fight', 'accident', 'harassment', 'other'];
const ACTIVE = ['open', 'acknowledged', 'on_the_way'];
const RESPONDER_STATUSES = ['acknowledged', 'on_the_way', 'resolved'];
const STUDENT_NEEDS_APPROVAL = process.env.STUDENT_APPROVAL === 'true';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---------- helpers ----------
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  idNumber: u.id_number,
  phone: u.phone,
  avatar: u.avatar || null,
  createdAt: u.created_at,
});

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((e) => {
    console.error('[server error]', e);
    res.status(500).json({ error: e.message || 'Server error' });
  });
};

// ---------- auth middleware ----------
async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    // Re-read the user every request so a disabled account is cut off immediately
    const u = await findUserById(p.id);
    if (!u || u.status !== 'approved') return res.status(403).json({ error: 'Account is not active' });
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

const role = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Not allowed for your role' });

// ---------- auth routes ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, database: 'supabase' }));

app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password, role: wanted, idNumber, phone } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!['student', 'responder'].includes(wanted)) return res.status(400).json({ error: 'Role must be student or responder' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const em = String(email).trim().toLowerCase();
  const existing = await findUserByEmail(em);
  if (existing) return res.status(409).json({ error: 'That email is already registered' });

  // Responders ALWAYS need admin approval. Students are auto-approved unless STUDENT_APPROVAL=true.
  const status = wanted === 'student' && !STUDENT_NEEDS_APPROVAL ? 'approved' : 'pending';
  const newUser = await createUser({
    name: String(name).trim(),
    email: em,
    password_hash: bcrypt.hashSync(String(password), 10),
    role: wanted,
    status,
    id_number: idNumber || null,
    phone: phone || null,
  });

  await audit(newUser.id, 'register', 'user', newUser.id, `${wanted} registered (${status})`);

  if (status === 'pending') io.to('admins').emit('user:pending', { id: newUser.id, name: newUser.name, role: wanted });
  res.status(201).json({
    status,
    message: status === 'approved' ? 'Account created. You can sign in now.' : 'Registration sent. An admin must approve your account before you can sign in.',
  });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await findUserByEmail(email);
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash))
    return res.status(401).json({ error: 'Wrong email or password' });
  if (u.status === 'pending') return res.status(403).json({ error: 'Your account is waiting for admin approval' });
  if (u.status === 'rejected') return res.status(403).json({ error: 'Your registration was rejected. Contact the school admin.' });
  if (u.status === 'disabled') return res.status(403).json({ error: 'Your account has been disabled. Contact the school admin.' });
  const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(u) });
}));

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.patch('/api/me', auth, wrap(async (req, res) => {
  const { name, phone, idNumber, avatar } = req.body || {};
  const updates = {};

  if (typeof name === 'string' && name.trim()) {
    updates.name = name.trim();
  }
  if (phone !== undefined) {
    updates.phone = phone ? String(phone).trim() : null;
  }
  if (idNumber !== undefined) {
    updates.id_number = idNumber ? String(idNumber).trim() : null;
  }
  if (avatar !== undefined) {
    updates.avatar = avatar || null;
  }

  let updatedUser = req.user;
  if (Object.keys(updates).length > 0) {
    updatedUser = await updateUser(req.user.id, updates);
    await audit(req.user.id, 'profile_update', 'user', req.user.id, 'updated profile');
  }

  res.json({ user: publicUser(updatedUser) });
}));

// Save / remove Expo push token for emergency mobile alerts
app.post('/api/me/push-token', auth, wrap(async (req, res) => {
  const { pushToken } = req.body || {};
  if (pushToken && typeof pushToken === 'string') {
    await updateUser(req.user.id, { push_token: pushToken.trim() });
  }
  res.json({ ok: true });
}));

app.post('/api/me/remove-push-token', auth, wrap(async (req, res) => {
  await updateUser(req.user.id, { push_token: null });
  res.json({ ok: true });
}));

// Real-time presence inspection endpoint
app.get('/api/presence', auth, (_req, res) => {
  res.json(getPresenceSummary());
});

// Helper: Send Urgent Push Notification to all approved responders' devices
async function sendPushToResponders(report) {
  try {
    const responders = await getApprovedRespondersWithPushToken();
    if (!responders || responders.length === 0) return;

    const typeUpper = String(report.type || 'INCIDENT').toUpperCase();
    const studentName = report.studentName || 'Student';
    const loc = report.locationText ? ` at ${report.locationText}` : '';
    const note = report.note ? `\n"${report.note}"` : '';

    const messages = responders.map((r) => ({
      to: r.push_token,
      title: `🚨 EMERGENCY: ${typeUpper} ALERT!`,
      body: `${studentName} requested immediate SOS assistance${loc}.${note}`,
      sound: 'default',
      priority: 'high',
      channelId: 'emergency-alerts',
      data: {
        reportId: report.id,
        type: report.type,
        studentName,
        locationText: report.locationText,
      },
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      console.warn('[push] Expo push service HTTP', res.status);
    }
  } catch (err) {
    console.error('[push] Failed to send push notification to responders:', err.message);
  }
}

// ---------- reports ----------
app.get('/api/report-types', (_req, res) => res.json({ types: REPORT_TYPES }));

// Student presses SOS
app.post('/api/reports', auth, role('student'), wrap(async (req, res) => {
  const { type, locationText, lat, lng, note } = req.body || {};
  if (!REPORT_TYPES.includes(type)) return res.status(400).json({ error: 'Choose an emergency type' });
  const loc = String(locationText || '').trim().slice(0, 200);
  const hasGps = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
  if (!loc && !hasGps) return res.status(400).json({ error: 'Add a location (GPS or describe where you are)' });

  const activeReportId = await hasActiveReport(req.user.id);
  if (activeReportId) {
    const existingReport = await getReport(activeReportId);
    return res.status(409).json({ error: 'You already have an active report', report: existingReport });
  }

  const report = await createReport({
    studentId: req.user.id,
    type,
    locationText: loc || null,
    lat: hasGps ? lat : null,
    lng: hasGps ? lng : null,
    note: note ? String(note).slice(0, 500) : null,
  });
  await audit(req.user.id, 'created', 'report', report.id, `${type} at ${loc || 'GPS only'}`);

  io.to('staff').emit('report:new', report);
  sendPushToResponders(report);
  res.status(201).json({ report });
}));

// Student's own reports
app.get('/api/reports/mine', auth, role('student'), wrap(async (req, res) => {
  const reports = await getReports({ studentId: req.user.id });
  res.json({ reports });
}));

// Responders / admin: live board (scope=active) or everything (scope=all)
app.get('/api/reports', auth, role('responder', 'admin'), wrap(async (req, res) => {
  const reports = await getReports({ scope: req.query.scope });
  res.json({ reports });
}));

app.get('/api/reports/:id', auth, wrap(async (req, res) => {
  const report = await getReport(Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (req.user.role === 'student' && report.studentId !== req.user.id) return res.status(403).json({ error: 'Not your report' });
  const timeline = await getTimeline(report.id);
  res.json({ report, timeline });
}));

// Responder updates progress
app.patch('/api/reports/:id/status', auth, role('responder', 'admin'), wrap(async (req, res) => {
  const { status, note } = req.body || {};
  if (!RESPONDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const current = await getReport(Number(req.params.id));
  if (!current) return res.status(404).json({ error: 'Report not found' });
  if (!ACTIVE.includes(current.status)) return res.status(409).json({ error: `Report is already ${current.status}` });

  const updates = {
    status,
    responder_id: req.user.id,
  };
  if (status === 'resolved') {
    updates.resolved_at = new Date().toISOString();
  }

  const report = await updateReport(current.id, updates);
  await audit(req.user.id, status, 'report', current.id, note ? String(note).slice(0, 300) : null);

  io.to('staff').to(`user:${report.studentId}`).emit('report:update', report);
  res.json({ report });
}));

// Student cancels (false alarm / resolved themselves)
app.patch('/api/reports/:id/cancel', auth, role('student'), wrap(async (req, res) => {
  const current = await getReport(Number(req.params.id));
  if (!current || current.studentId !== req.user.id) return res.status(404).json({ error: 'Report not found' });
  if (!ACTIVE.includes(current.status)) return res.status(409).json({ error: `Report is already ${current.status}` });

  const report = await updateReport(current.id, { status: 'cancelled' });
  await audit(req.user.id, 'cancelled', 'report', current.id, 'cancelled by student');

  io.to('staff').to(`user:${req.user.id}`).emit('report:update', report);
  res.json({ report });
}));

// ---------- Presence & Active Users Registry ----------
const activeSockets = new Map(); // userId -> { user: { id, name, role, avatar }, sockets: Set<socketId> }

function getPresenceSummary() {
  let activeResponders = 0;
  let activeStudents = 0;
  let activeAdmins = 0;
  const onlineResponders = [];

  for (const [, data] of activeSockets.entries()) {
    if (data.sockets && data.sockets.size > 0) {
      if (data.user.role === 'responder') {
        activeResponders++;
        onlineResponders.push({ id: data.user.id, name: data.user.name, avatar: data.user.avatar });
      } else if (data.user.role === 'student') {
        activeStudents++;
      } else if (data.user.role === 'admin') {
        activeAdmins++;
      }
    }
  }

  const activeUsers = activeResponders + activeStudents + activeAdmins;
  return {
    activeResponders,
    activeStudents,
    activeAdmins,
    activeUsers,
    onlineResponders,
    timestamp: new Date().toISOString(),
  };
}

function broadcastPresence() {
  const summary = getPresenceSummary();
  io.emit('presence:update', summary);
}

// ---------- admin ----------
app.get('/api/admin/stats', auth, role('admin'), wrap(async (_req, res) => {
  const stats = await getStats();
  const presence = getPresenceSummary();
  res.json({
    pendingResponders: stats.pendingResponders,
    responders: presence.activeResponders, // Live on-duty responders online right now!
    totalResponders: stats.totalResponders,
    students: presence.activeStudents, // Live active students online right now!
    totalStudents: stats.totalStudents,
    activeUsers: presence.activeUsers, // Live total active users across the campus!
    activeReports: stats.activeReports,
    reportsToday: stats.reportsToday,
    totalReports: stats.totalReports,
  });
}));

app.get('/api/admin/users', auth, role('admin'), wrap(async (req, res) => {
  const { status, role: r, q } = req.query;
  const rows = await getUsers({ status, role: r, q });

  const onlineUserIds = new Set(
    Array.from(activeSockets.keys()).filter((id) => activeSockets.get(id)?.sockets?.size > 0)
  );

  res.json({
    users: rows.map((u) => ({
      ...publicUser(u),
      isOnline: onlineUserIds.has(u.id),
    })),
  });
}));

// Approve / reject / disable / re-enable an account
app.patch('/api/admin/users/:id', auth, role('admin'), wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'disabled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const target = await findUserById(Number(req.params.id));
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be changed here' });

  const updated = await updateUser(target.id, { status });
  const verb = { approved: target.status === 'pending' ? 'approved' : 'enabled', rejected: 'rejected', disabled: 'disabled' }[status];
  await audit(req.user.id, verb, 'user', target.id, `${target.name} (${target.role})`);
  if (status !== 'approved') io.in(`user:${target.id}`).disconnectSockets(true);
  res.json({ user: publicUser(updated) });
}));

app.post('/api/admin/users/:id/reset-password', auth, role('admin'), wrap(async (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const target = await findUserById(Number(req.params.id));
  if (!target || target.role === 'admin') return res.status(404).json({ error: 'User not found' });
  await updateUser(target.id, { password_hash: bcrypt.hashSync(String(password), 10) });
  await audit(req.user.id, 'password_reset', 'user', target.id, target.name);
  res.json({ ok: true });
}));

// Full history: account events + report events
app.get('/api/admin/history', auth, role('admin'), wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const type = ['user', 'report'].includes(req.query.type) ? req.query.type : null;
  const history = await getAuditHistory(limit, offset, type);
  res.json({ history });
}));

// ---------- realtime ----------
io.use(async (socket, next) => {
  try {
    const p = jwt.verify(socket.handshake.auth?.token, JWT_SECRET);
    const u = await findUserById(p.id);
    if (!u || u.status !== 'approved') return next(new Error('inactive'));
    socket.user = u;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const u = socket.user;
  socket.join(`user:${u.id}`);
  if (u.role !== 'student') socket.join('staff');
  if (u.role === 'admin') socket.join('admins');

  // Track user presence
  if (!activeSockets.has(u.id)) {
    activeSockets.set(u.id, {
      user: { id: u.id, name: u.name, role: u.role, avatar: u.avatar || null },
      sockets: new Set(),
    });
  }
  const entry = activeSockets.get(u.id);
  entry.sockets.add(socket.id);
  entry.user.name = u.name;
  entry.user.role = u.role;
  entry.user.avatar = u.avatar || null;

  // Send immediate presence snapshot to newly connected client
  socket.emit('presence:update', getPresenceSummary());
  // Broadcast live updated presence to all clients
  broadcastPresence();

  socket.on('disconnect', () => {
    const userEntry = activeSockets.get(u.id);
    if (userEntry) {
      userEntry.sockets.delete(socket.id);
      if (userEntry.sockets.size === 0) {
        activeSockets.delete(u.id);
      }
    }
    broadcastPresence();
  });
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => console.log(`School SOS server running on port ${PORT} (connected to Supabase)`));
}
module.exports = { app, server };
