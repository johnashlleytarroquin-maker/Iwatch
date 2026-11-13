const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { sendOtpEmail } = require('./mailer');
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

// Helper: check if a user has verified their Gmail address
async function isEmailVerified(u) {
  if (!u) return false;
  if (u.status === 'approved') return true;
  const { data, error } = await supabase
    .from('audit_log')
    .select('id')
    .eq('target_type', 'user')
    .eq('action', 'email_verified')
    .eq('target_id', u.id)
    .limit(1);
  return Boolean(!error && data && data.length > 0);
}

// ---------- auth routes ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, database: 'supabase' }));

app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password, role: wanted, idNumber, phone } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!['student', 'responder'].includes(wanted)) return res.status(400).json({ error: 'Role must be student or responder' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  // Require valid Gmail address
  const em = String(email).trim().toLowerCase();
  if (!em.endsWith('@gmail.com') || em.length <= 10) {
    return res.status(400).json({ error: 'A valid Gmail address (@gmail.com) is required for registration.' });
  }

  const existing = await findUserByEmail(em);
  if (existing) {
    const verified = await isEmailVerified(existing);
    if (!verified) {
      // Allow unverified users to get a fresh OTP and complete verification
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from('audit_log').insert({
        actor_id: existing.id,
        action: 'otp_request',
        target_type: 'otp',
        target_id: existing.id,
        details: JSON.stringify({ otp, expiresAt, email: em, role: existing.role }),
      });
      const mailRes = await sendOtpEmail(em, otp, existing.name);
      return res.status(200).json({
        status: 'pending',
        requiresOtp: true,
        email: em,
        userId: existing.id,
        message: 'This Gmail is registered but not yet verified. A fresh 6-digit code has been sent to your Gmail.',
        devOtp: mailRes.simulated ? otp : undefined,
      });
    }
    return res.status(409).json({ error: 'That Gmail address is already registered.' });
  }

  // Create user with status 'pending' (satisfies DB constraint until OTP verified)
  const newUser = await createUser({
    name: String(name).trim(),
    email: em,
    password_hash: bcrypt.hashSync(String(password), 10),
    role: wanted,
    status: 'pending',
    id_number: idNumber || null,
    phone: phone || null,
  });

  await audit(newUser.id, 'register', 'user', newUser.id, `${wanted} registered (pending verification)`);

  // Generate 6-digit verification code (valid for 10 minutes)
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase.from('audit_log').insert({
    actor_id: newUser.id,
    action: 'otp_request',
    target_type: 'otp',
    target_id: newUser.id,
    details: JSON.stringify({ otp, expiresAt, email: em, role: wanted }),
  });

  const mailRes = await sendOtpEmail(em, otp, newUser.name);

  res.status(201).json({
    status: 'pending',
    requiresOtp: true,
    email: em,
    userId: newUser.id,
    message: 'A 6-digit verification code has been sent to your Gmail. Please enter it to complete registration.',
    devOtp: mailRes.simulated ? otp : undefined,
  });
}));

// Verify 6-digit OTP code sent to user's Gmail
app.post('/api/auth/verify-otp', wrap(async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP verification code are required.' });

  const em = String(email).trim().toLowerCase();
  const u = await findUserByEmail(em);
  if (!u) return res.status(404).json({ error: 'No account found with this Gmail address.' });

  if (await isEmailVerified(u)) {
    return res.json({ message: 'Your Gmail is already verified. You can sign in now.' });
  }

  // Retrieve latest OTP record
  const { data: logs, error: logErr } = await supabase
    .from('audit_log')
    .select('*')
    .eq('target_type', 'otp')
    .eq('target_id', u.id)
    .order('id', { ascending: false })
    .limit(1);

  if (logErr || !logs || logs.length === 0) {
    return res.status(400).json({ error: 'No verification code found. Please tap "Resend Code".' });
  }

  let record = {};
  try {
    record = JSON.parse(logs[0].details || '{}');
  } catch {}

  if (new Date() > new Date(record.expiresAt)) {
    return res.status(400).json({ error: 'Verification code has expired. Please tap "Resend Code".' });
  }

  if (record.otp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Incorrect verification code. Please check your Gmail and try again.' });
  }

  // OTP verified! Record in audit_log
  await audit(u.id, 'email_verified', 'user', u.id, `${u.email} verified via Gmail OTP`);

  // Activate student or notify admin for responder
  const isApproved = u.role === 'student' && !STUDENT_NEEDS_APPROVAL;
  const newStatus = isApproved ? 'approved' : 'pending';
  const updated = isApproved ? await updateUser(u.id, { status: newStatus }) : u;

  if (!isApproved) {
    io.to('admins').emit('user:pending', { id: u.id, name: u.name, role: u.role });
    return res.json({
      status: 'pending',
      user: publicUser(updated),
      message: 'Gmail verified! Your responder account is waiting for school administrator approval before you can sign in.',
    });
  }

  // Auto-approved student: issue JWT token immediately (permanent 10-year session)
  const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '3650d' });
  res.json({
    status: 'approved',
    token,
    user: publicUser(updated),
    message: 'Gmail verified successfully! Welcome to Iwatch.',
  });
}));

// Resend 6-digit OTP code to Gmail
app.post('/api/auth/resend-otp', wrap(async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const em = String(email).trim().toLowerCase();
  const u = await findUserByEmail(em);
  if (!u) return res.status(404).json({ error: 'No account found with this Gmail address.' });

  if (await isEmailVerified(u)) {
    return res.status(400).json({ error: 'Your account is already verified. Please sign in.' });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase.from('audit_log').insert({
    actor_id: u.id,
    action: 'otp_request',
    target_type: 'otp',
    target_id: u.id,
    details: JSON.stringify({ otp, expiresAt, email: u.email, role: u.role }),
  });

  const mailRes = await sendOtpEmail(u.email, otp, u.name);

  res.json({
    success: true,
    message: 'A fresh 6-digit verification code has been sent to your Gmail.',
    devOtp: mailRes.simulated ? otp : undefined,
  });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = await findUserByEmail(email);
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash))
    return res.status(401).json({ error: 'Wrong email or password' });

  const verified = await isEmailVerified(u);
  if (!verified) {
    // Send a fresh OTP code so they can verify easily
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('audit_log').insert({
      actor_id: u.id,
      action: 'otp_request',
      target_type: 'otp',
      target_id: u.id,
      details: JSON.stringify({ otp, expiresAt, email: u.email, role: u.role }),
    });
    const mailRes = await sendOtpEmail(u.email, otp, u.name);

    return res.status(403).json({
      error: 'Your Gmail address is not verified yet. We sent a verification code to your Gmail.',
      unverified: true,
      email: u.email,
      userId: u.id,
      devOtp: mailRes.simulated ? otp : undefined,
    });
  }

  if (u.status === 'pending') return res.status(403).json({ error: 'Your account is waiting for admin approval' });
  if (u.status === 'rejected') return res.status(403).json({ error: 'Your registration was rejected. Contact the school admin.' });
  if (u.status === 'disabled') return res.status(403).json({ error: 'Your account has been disabled. Contact the school admin.' });
  // Permanent 10-year session (does not expire when user closes app)
  const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '3650d' });
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
      sound: 'emergency_alarm.mp3',
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

// ---------- reports & campus geofence ----------
const CAMPUS_GEOFENCE = {
  name: 'Surigao del Norte State University - Main Campus',
  lat: 9.78724,
  lng: 125.49437,
  radiusMeters: 150,
};

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number') return 0;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

app.get('/api/report-types', (_req, res) => res.json({ types: REPORT_TYPES }));

// Student presses SOS
app.post('/api/reports', auth, role('student'), wrap(async (req, res) => {
  const { type, locationText, lat, lng, note, isOffCampus: clientOffCampus } = req.body || {};
  if (!REPORT_TYPES.includes(type)) return res.status(400).json({ error: 'Choose an emergency type' });
  const loc = String(locationText || '').trim().slice(0, 200);
  const hasGps = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
  if (!loc && !hasGps) return res.status(400).json({ error: 'Add a location (GPS or describe where you are)' });

  const activeReportId = await hasActiveReport(req.user.id);
  if (activeReportId) {
    const existingReport = await getReport(activeReportId);
    return res.status(409).json({ error: 'You already have an active report', report: existingReport });
  }

  let isOffCampus = false;
  let distanceMeters = 0;
  if (hasGps) {
    distanceMeters = calculateDistanceMeters(lat, lng, CAMPUS_GEOFENCE.lat, CAMPUS_GEOFENCE.lng);
    isOffCampus = distanceMeters > CAMPUS_GEOFENCE.radiusMeters;
  }
  if (clientOffCampus) isOffCampus = true;

  const geofenceTag = hasGps
    ? isOffCampus
      ? ` [Off-Campus: ~${(distanceMeters / 1000).toFixed(1)}km from SNSU]`
      : ` [SNSU Campus: within ${distanceMeters}m]`
    : '';

  const finalLocation = loc ? `${loc}${geofenceTag}` : (geofenceTag.trim() || 'GPS Coordinates');

  const report = await createReport({
    studentId: req.user.id,
    type,
    locationText: finalLocation,
    lat: hasGps ? lat : null,
    lng: hasGps ? lng : null,
    note: note ? String(note).slice(0, 500) : null,
  });
  report.isOffCampus = isOffCampus;
  report.distanceToCampus = distanceMeters;

  await audit(req.user.id, 'created', 'report', report.id, `${type} at ${finalLocation}`);

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
