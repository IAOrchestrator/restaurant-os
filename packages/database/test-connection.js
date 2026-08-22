const { Client } = require('pg');

async function test(connStr, label) {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  try {
    console.log(`Testing ${label}...`);
    await client.connect();
    const res = await client.query('SELECT 1 as connected');
    console.log(`✅ Success for ${label}:`, res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(`❌ Failed for ${label}:`, err.message);
    try { await client.end(); } catch (_) {}
    return false;
  }
}

async function main() {
  const p1 = "2Psq!txDcLr&3Af";
  const p1Enc = encodeURIComponent(p1);
  console.log('Encoded password:', p1Enc);

  const urls = [
    { label: 'Pooler 6543 encoded', url: `postgresql://postgres.bekpovmboixaildjyreg:${p1Enc}@aws-0-us-west-2.pooler.supabase.com:6543/postgres` },
    { label: 'Pooler 5432 encoded', url: `postgresql://postgres.bekpovmboixaildjyreg:${p1Enc}@aws-0-us-west-2.pooler.supabase.com:5432/postgres` },
    { label: 'Direct encoded', url: `postgresql://postgres:${p1Enc}@db.bekpovmboixaildjyreg.supabase.co:5432/postgres` },
  ];

  for (const u of urls) {
    await test(u.url, u.label);
  }
}

main();
