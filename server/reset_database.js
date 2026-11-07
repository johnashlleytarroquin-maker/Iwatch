const { supabase } = require('./db');

async function resetDatabase() {
  console.log('--- STARTING DATABASE RESET ---');

  // 1. Delete all emergency reports
  console.log('1. Clearing emergency reports...');
  const { error: repErr } = await supabase.from('reports').delete().neq('id', 0);
  if (repErr) {
    console.error('Failed to clear reports:', repErr.message);
  } else {
    console.log('✓ All emergency reports cleared.');
  }

  // 2. Delete all audit logs
  console.log('2. Clearing audit and activity logs...');
  const { error: audErr } = await supabase.from('audit_log').delete().neq('id', 0);
  if (audErr) {
    console.error('Failed to clear audit_log:', audErr.message);
  } else {
    console.log('✓ All audit logs cleared.');
  }

  // 3. Delete all non-admin users (keeps the admin account intact)
  console.log('3. Clearing non-admin users (students & responders)...');
  const { error: usrErr } = await supabase.from('users').delete().neq('role', 'admin');
  if (usrErr) {
    console.error('Failed to clear users:', usrErr.message);
  } else {
    console.log('✓ All non-admin users cleared.');
  }

  // 4. Verify remaining users
  const { data: remainingUsers } = await supabase.from('users').select('id, name, email, role');
  console.log('\n--- RESET COMPLETE ---');
  console.log('Preserved Admin Account(s):', remainingUsers);
  console.log('\nYou can now register fresh Gmail users!');
  process.exit(0);
}

resetDatabase().catch((err) => {
  console.error('Reset error:', err);
  process.exit(1);
});
