const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env if present
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[db] Warning: SUPABASE_URL or SUPABASE_KEY environment variables are missing.');
}

const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder', {
  auth: { persistSession: false },
});

// JWT secret: from env, or generated once and kept in .secret
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(__dirname, '.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}
const JWT_SECRET = loadSecret();

// ---------- Supabase User Helpers ----------
async function findUserById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) console.error('[db] findUserById error:', error.message);
  return data;
}

async function findUserByEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  const { data, error } = await supabase.from('users').select('*').eq('email', em).maybeSingle();
  if (error) console.error('[db] findUserByEmail error:', error.message);
  return data;
}

async function createUser({ name, email, password_hash, role, status, id_number, phone }) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name,
      email: String(email).trim().toLowerCase(),
      password_hash,
      role,
      status: status || 'approved',
      id_number: id_number || null,
      phone: phone || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateUser(id, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getUsers({ status, role, q } = {}) {
  let query = supabase.from('users').select('*').order('id', { ascending: false }).limit(500);
  if (status) query = query.eq('status', status);
  if (role) query = query.eq('role', role);
  if (q) {
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,id_number.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const list = (data || []).slice();
  list.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return b.id - a.id;
  });
  return list;
}

async function getApprovedRespondersWithPushToken() {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, push_token')
    .eq('role', 'responder')
    .eq('status', 'approved')
    .not('push_token', 'is', null);
  if (error) return [];
  return (data || []).filter((r) => r.push_token && r.push_token.length > 5);
}

// ---------- Supabase Report Helpers ----------
function formatSupabaseReport(r) {
  if (!r) return null;
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    locationText: r.location_text,
    lat: r.lat,
    lng: r.lng,
    note: r.note,
    studentId: r.student_id,
    studentName: r.student?.name || null,
    studentPhone: r.student?.phone || null,
    studentIdNumber: r.student?.id_number || null,
    studentAvatar: r.student?.avatar || null,
    responderId: r.responder_id || null,
    responderName: r.responder?.name || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    resolvedAt: r.resolved_at,
  };
}

const REPORT_SELECT_REL = `
  *,
  student:users!student_id(name, phone, id_number, avatar),
  responder:users!responder_id(name)
`;

async function getReport(id) {
  const { data, error } = await supabase
    .from('reports')
    .select(REPORT_SELECT_REL)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return formatSupabaseReport(data);
}

async function getReports({ studentId, scope } = {}) {
  let query = supabase.from('reports').select(REPORT_SELECT_REL).order('id', { ascending: false });

  if (studentId) {
    query = query.eq('student_id', studentId).limit(50);
  } else if (scope !== 'all') {
    query = query.in('status', ['open', 'acknowledged', 'on_the_way']).limit(300);
  } else {
    query = query.limit(300);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(formatSupabaseReport);
}

async function createReport({ studentId, type, locationText, lat, lng, note }) {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      student_id: studentId,
      type,
      location_text: locationText || null,
      lat: lat || null,
      lng: lng || null,
      note: note || null,
      status: 'open',
    })
    .select()
    .single();
  if (error) throw error;
  return getReport(data.id);
}

async function updateReport(id, updates) {
  const { data, error } = await supabase
    .from('reports')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return getReport(data.id);
}

async function hasActiveReport(studentId) {
  const { data } = await supabase
    .from('reports')
    .select('id')
    .eq('student_id', studentId)
    .in('status', ['open', 'acknowledged', 'on_the_way'])
    .limit(1)
    .maybeSingle();
  return data ? data.id : null;
}

// ---------- Audit Log Helpers ----------
async function audit(actorId, action, targetType, targetId, details = null) {
  try {
    await supabase.from('audit_log').insert({
      actor_id: actorId || null,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ? String(details).slice(0, 500) : null,
    });
  } catch (err) {
    console.error('[db] audit error:', err.message);
  }
}

async function getTimeline(reportId) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, details, created_at, actor:users!actor_id(name, role)')
    .eq('target_type', 'report')
    .eq('target_id', reportId)
    .order('id', { ascending: true });
  if (error) return [];
  return (data || []).map((a) => ({
    id: a.id,
    action: a.action,
    details: a.details,
    createdAt: a.created_at,
    actorName: a.actor?.name || null,
    actorRole: a.actor?.role || null,
  }));
}

async function getAuditHistory(limit = 100, offset = 0, type = null) {
  let query = supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, details, created_at, actor:users!actor_id(name, role)')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);
  if (type) query = query.eq('target_type', type);
  const { data, error } = await query;
  if (error) return [];
  return (data || []).map((a) => ({
    id: a.id,
    action: a.action,
    targetType: a.target_type,
    targetId: a.target_id,
    details: a.details,
    createdAt: a.created_at,
    actorName: a.actor?.name || null,
    actorRole: a.actor?.role || null,
  }));
}

// ---------- Stats Helpers ----------
async function getStats() {
  const today = new Date().toISOString().split('T')[0];

  const [pendingRes, totalRes, totalStud, activeRep, totalRep, reportsToday] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'responder').eq('status', 'approved'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'approved'),
    supabase.from('reports').select('*', { count: 'exact', head: true }).in('status', ['open', 'acknowledged', 'on_the_way']),
    supabase.from('reports').select('*', { count: 'exact', head: true }),
    supabase.from('reports').select('*', { count: 'exact', head: true }).gte('created_at', today),
  ]);

  return {
    pendingResponders: pendingRes.count || 0,
    totalResponders: totalRes.count || 0,
    totalStudents: totalStud.count || 0,
    activeReports: activeRep.count || 0,
    reportsToday: reportsToday.count || 0,
    totalReports: totalRep.count || 0,
  };
}

module.exports = {
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
};
