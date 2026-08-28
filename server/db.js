// Single Supabase client for the whole app. Uses the service_role/secret key,
// which bypasses Row Level Security entirely — Express is the sole gatekeeper
// (via requireAuth/requireAdmin in server.js), exactly as it was with SQLite,
// so RLS on every table stays enabled-with-no-policies as defense-in-depth
// rather than as the actual access-control layer.
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env — see .env.example.");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = supabase;
