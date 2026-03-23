const { getSupabase } = require('./supabase');

/**
 * Compatibility wrapper around Supabase JS client.
 * Provides the same db.query(sql, params) interface that all route files expect,
 * but executes via the query_json RPC function over HTTPS (no direct PG connection needed).
 */
function getDB() {
  const supabase = getSupabase();

  return {
    async query(sql, params = []) {
      // Serialize params: convert Date objects to ISO strings, keep nulls as null
      const serialized = params.map((p) => {
        if (p === null || p === undefined) return null;
        if (p instanceof Date) return p.toISOString();
        return p;
      });

      const { data, error } = await supabase.rpc('query_json', {
        sql_text: sql.trim(),
        params: serialized,
      });

      if (error) {
        const err = new Error(error.message);
        err.code = error.code;
        throw err;
      }

      const rows = data || [];

      // Handle non-RETURNING DML (UPDATE/DELETE without RETURNING)
      if (rows.length === 1 && rows[0]._affected_rows !== undefined) {
        return { rows: [], rowCount: rows[0]._affected_rows };
      }

      return { rows, rowCount: rows.length };
    },
  };
}

async function connectDB() {
  // Verify connection by running a simple query
  const db = getDB();
  await db.query('SELECT 1 AS ok');
  console.log('PostgreSQL connected (via Supabase RPC)');
}

module.exports = { connectDB, getDB };
