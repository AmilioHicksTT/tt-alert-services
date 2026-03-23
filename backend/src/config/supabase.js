const { createClient } = require('@supabase/supabase-js');

let client;

function getSupabase() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY  // service role key — server-side only
    );
  }
  return client;
}

module.exports = { getSupabase };
