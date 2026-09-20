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

// Password-recovery links always land here with a #access_token=...&type=
// recovery fragment, but Supabase's own redirect_to resolution ignores the
// specific path we ask for and always sends the browser to the bare site
// origin — so the link can land on any page, not just reset-password.html.
// reset-password.html's own onAuthStateChange listener only fires
// PASSWORD_RECOVERY when supabase-js consumes this fragment itself, so we
// have to hand it the fragment intact (not just navigate there plain) —
// this has to run before supabase-js gets a chance to consume it here.
if (location.hash.includes("type=recovery") && !location.pathname.endsWith("reset-password.html")) {
  const fromRoot = !location.pathname.includes("/modules/");
  location.replace((fromRoot ? "reset-password.html" : "../reset-password.html") + location.hash);
}

const supabaseClient = supabase.createClient(
  "https://mbravmycmxvqfzrixthz.supabase.co",
  "sb_publishable_h8W87aAIjsZTLhu9DP_ZSA_OdyRtxfM",
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
);
