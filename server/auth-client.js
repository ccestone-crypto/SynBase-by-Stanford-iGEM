// A fresh Supabase client for every auth.* call that establishes or changes
// "the current session" (signUp, signInWithPassword, refreshSession) —
// supabase-js mutates that state ON THE CLIENT INSTANCE, and since server.js
// keeps one singleton service_role client (server/db.js) for every table
// query across every request, calling those methods on it would silently
// swap its authorization from service_role to whichever user just signed
// in — corrupting every other request sharing that client. A throwaway
// client per call keeps auth operations fully isolated from table access.
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env — see .env.example.");
}

function freshAuthClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

module.exports = { freshAuthClient };
