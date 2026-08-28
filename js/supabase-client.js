// Shared Supabase client for every page. Requires the supabase-js UMD
// script tag to be loaded first (see any page's <head>/<body> top for the
// exact <script src="https://cdn.jsdelivr.net/...supabase-js..."> tag).
//
// Session persistence is handled entirely by supabase-js itself
// (localStorage-backed, auto-refreshing) — there's no server anymore to
// hold an httpOnly cookie, so this IS the session mechanism now. The
// publishable/anon key is safe to ship in this file: it has no table
// access beyond what supabase/migrations/0002_static_frontend_rls.sql
// explicitly grants.
const supabaseClient = supabase.createClient(
  "https://mbravmycmxvqfzrixthz.supabase.co",
  "sb_publishable_h8W87aAIjsZTLhu9DP_ZSA_OdyRtxfM",
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
);
