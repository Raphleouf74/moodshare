const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || null;

let pool = null;
if (connectionString) {
  pool = new Pool({
    connectionString,
    // Render / certains fournisseurs exigent SSL ; éviter rejectUnauthorized pour compatibilité
    ssl: { rejectUnauthorized: false }
  });
} else {
  console.warn('⚠️  DATABASE_URL not set — DB disabled, using file-based fallback if implemented.');
}

// Test de connexion non bloquant
(async () => {
  if (!pool) return;
  try {
    const client = await pool.connect();
    client.release();
    console.log('✅ Postgres connecté');
  } catch (err) {
    console.error('❌ Postgres connection error:', err);
  }
})();

module.exports = {
  pool,
  query: async (text, params) => {
    if (!pool) throw new Error('No database pool configured');
    return pool.query(text, params);
  }
};