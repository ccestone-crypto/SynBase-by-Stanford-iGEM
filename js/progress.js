// Progress tracking shared by the homepage and every module page. Progress
// lives in Supabase Postgres (progress_sections/progress_video), read and
// written directly from the browser via supabaseClient (see
// js/supabase-client.js) — there's no server in this build, so Row Level
// Security (supabase/migrations/0002_static_frontend_rls.sql) is what
// actually stops a user from reading or writing anyone else's progress, not
// this file. Each page must call bootstrapAuthAndProgress(fromRoot) once
// before any of the render helpers below are used — it populates
// CURRENT_USER and PROGRESS_CACHE, and redirects to the login page if
// there's no valid session.
let CURRENT_USER = null;
let PROGRESS_CACHE = {};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function loginPath(fromRoot) {
  return fromRoot ? "login.html" : "../login.html";
}

// Reconstructs the same { module1: { sections: {...}, videoWatched }, ... }
// shape the rest of this file (and every page's render code) already
// expects — this used to be server.js's store.readProgress().
async function loadProgressCache(userId) {
  const [{ data: sections }, { data: videos }] = await Promise.all([
    supabaseClient.from("progress_sections").select("module_id,section_id").eq("user_id", userId),
    supabaseClient.from("progress_video").select("module_id,watched").eq("user_id", userId)
  ]);
  const progress = {};
  (sections || []).forEach(row => {
    if (!progress[row.module_id]) progress[row.module_id] = { sections: {}, videoWatched: false };
    progress[row.module_id].sections[row.section_id] = true;
  });
  (videos || []).forEach(row => {
    if (!progress[row.module_id]) progress[row.module_id] = { sections: {}, videoWatched: false };
    progress[row.module_id].videoWatched = !!row.watched;
  });
  return progress;
}

async function loadCurrentUser(authUser) {
  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  if (!profile) {
    // The session token is still locally valid but its profile row is gone
    // (e.g. the account was deleted while the browser held onto the
    // session) — clear it rather than treating this as logged in.
    await supabaseClient.auth.signOut();
    return null;
  }
  return {
    id: authUser.id,
    name: profile.name,
    email: profile.email,
    isAdmin: !!profile.is_admin,
    taEligible: !!profile.ta_eligible
  };
}

async function bootstrapAuthAndProgress(fromRoot) {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `${loginPath(fromRoot)}?next=${next}`;
    return null;
  }

  CURRENT_USER = await loadCurrentUser(session.user);
  if (!CURRENT_USER) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `${loginPath(fromRoot)}?next=${next}`;
    return null;
  }
  PROGRESS_CACHE = await loadProgressCache(session.user.id);

  return CURRENT_USER;
}

// The local cache is already updated by the caller, so most callers don't
// wait on this round trip. It returns its promise, though, because
// completing the very last page of a module immediately navigates to the
// next module (or congratulations.html) in the same click handler — that
// specific caller awaits this so the section is actually persisted before
// the browser tears down the page.
function syncProgress(moduleId, patch) {
  const userId = CURRENT_USER && CURRENT_USER.id;
  if (!userId) return Promise.resolve();

  const ops = [];
  if (patch.sectionId) {
    ops.push(supabaseClient.from("progress_sections").upsert(
      { user_id: userId, module_id: moduleId, section_id: patch.sectionId, completed: true },
      { onConflict: "user_id,module_id,section_id" }
    ));
  }
  if (typeof patch.videoWatched === "boolean") {
    ops.push(supabaseClient.from("progress_video").upsert(
      { user_id: userId, module_id: moduleId, watched: patch.videoWatched },
      { onConflict: "user_id,module_id" }
    ));
  }
  return Promise.all(ops).catch(() => {});
}

function isSectionComplete(moduleId, sectionId) {
  const mod = PROGRESS_CACHE[moduleId];
  return !!(mod && mod.sections && mod.sections[sectionId]);
}

function markSectionComplete(moduleId, sectionId) {
  if (!PROGRESS_CACHE[moduleId]) PROGRESS_CACHE[moduleId] = { sections: {} };
  if (!PROGRESS_CACHE[moduleId].sections) PROGRESS_CACHE[moduleId].sections = {};
  PROGRESS_CACHE[moduleId].sections[sectionId] = true;
  return syncProgress(moduleId, { sectionId });
}

function moduleProgress(moduleId, sectionCount) {
  const mod = PROGRESS_CACHE[moduleId] || { sections: {} };
  // Clamped to sectionCount: a module's pages can be renumbered between a
  // student's visits, which can leave old, no-longer-existing section ids
  // marked complete alongside their current replacements — without this,
  // that stale overlap could push completed past total and show >100%.
  const completed = Math.min(sectionCount, Object.keys(mod.sections || {}).filter(k => mod.sections[k]).length);
  return { completed, total: sectionCount, pct: Math.round((completed / sectionCount) * 100) };
}

function overallProgress() {
  // Guards pages that show the header's progress pill (any page a logged-in
  // user can land on) but forget to load js/modules-meta.js — without this,
  // a missing script tag throws here and blanks the entire page instead of
  // just the pill, since this runs inside the same render call as the rest
  // of the header.
  if (typeof MODULES_META === "undefined") return { completed: 0, total: 0, pct: 0 };
  let completed = 0, total = 0;
  MODULES_META.forEach(m => {
    const p = moduleProgress(m.id, m.sectionCount);
    completed += p.completed;
    total += p.total;
  });
  return { completed, total, pct: total ? Math.round((completed / total) * 100) : 0 };
}

function moduleStatusLabel(pct) {
  if (pct >= 100) return "Complete";
  if (pct > 0) return "In Progress";
  return "Start";
}

// ---------- Module locking ----------
// Module 1 is always unlocked. Every later module requires the module right
// before it to be 100% complete (all sections passed + video marked watched).
// Admins bypass this entirely — they need to review the full curriculum
// without grinding through it as a student would.
const LOCK_ICON = `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9"/></svg>`;

function isModuleUnlocked(moduleId) {
  if (CURRENT_USER && CURRENT_USER.isAdmin) return true;
  const idx = MODULES_META.findIndex(m => m.id === moduleId);
  if (idx <= 0) return true;
  const prev = MODULES_META[idx - 1];
  return moduleProgress(prev.id, prev.sectionCount).pct >= 100;
}

function lockedModuleInfo(moduleId) {
  const idx = MODULES_META.findIndex(m => m.id === moduleId);
  const prev = MODULES_META[idx - 1];
  return { prev, prevProgress: moduleProgress(prev.id, prev.sectionCount) };
}

// ---------- Slide-deck accent cycle ----------
// The source slides badge their numbered items in a repeating teal/gold/cardinal
// sequence (see "Three Domains of Life", "Three Common Types of Cells"). Reused
// here for module chips and per-lesson index circles.
const MODULE_ACCENT_CYCLE = ["teal", "gold", "cardinal"];
function moduleAccentClass(number) {
  const len = MODULE_ACCENT_CYCLE.length;
  return MODULE_ACCENT_CYCLE[((number - 1) % len + len) % len];
}

// Small red-bar/gold-bar mark echoing the corner ornament repeated on every slide.
const BRAND_MARK = `<div class="brand-mark"><span class="bar1"></span><span class="bar2"></span></div>`;

// ---------- SiBRP split nav item ----------
// "SiBRP" itself links straight to the course application; the chevron
// opens a small dropdown for the related-but-secondary SiBRP links.
const CHEVRON_DOWN = `<svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l5 5 5-5"/></svg>`;

function sibrpNavHtml(prefix, user) {
  return `
    <div class="nav-dropdown">
      <a href="${prefix}application.html">SiBRP</a>
      <button type="button" class="nav-dropdown-toggle" aria-label="More SiBRP links">${CHEVRON_DOWN}</button>
      <div class="nav-dropdown-menu">
        <a href="${prefix}beyond-sibrp.html">Beyond SiBRP</a>
        <a href="${prefix}speaker-series.html">Speaker Series</a>
        ${user && user.taEligible ? `<a href="${prefix}ta-application.html">TA Application</a>` : ""}
      </div>
    </div>
  `;
}

function wireNavDropdowns(mountEl) {
  mountEl.querySelectorAll(".nav-dropdown-toggle").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = btn.closest(".nav-dropdown");
      const wasOpen = dropdown.classList.contains("open");
      mountEl.querySelectorAll(".nav-dropdown.open").forEach(d => d.classList.remove("open"));
      if (!wasOpen) dropdown.classList.add("open");
    });
  });
  document.addEventListener("click", () => {
    mountEl.querySelectorAll(".nav-dropdown.open").forEach(d => d.classList.remove("open"));
  });
}

// ---------- Shared header ----------
// Same nav markup regardless of entry point, so the header never reorders
// itself as a user moves between protected pages (renderHeader) and public
// pages (renderPublicHeader).
function headerNavHtml(prefix, user) {
  return `
    <a href="${prefix}${user ? "index.html" : "curriculum.html"}">Curriculum</a>
    ${sibrpNavHtml(prefix, user)}
    <a href="${prefix}about.html">About</a>
    ${user && user.isAdmin ? `<a href="${prefix}admin.html">Admin</a>` : ""}
  `;
}

function headerActionsHtml(prefix, user) {
  if (!user) {
    return `
      <a class="btn small secondary" href="${prefix}login.html">Log In</a>
      <a class="btn small" href="${prefix}signup.html">Sign Up Free</a>
    `;
  }
  const overall = overallProgress();
  const initial = escapeHtml((user.name || "?").trim().charAt(0).toUpperCase() || "?");
  return `
    <span class="header-progress-pill">Overall: ${overall.pct}%</span>
    <a class="header-avatar" href="${prefix}profile.html" title="${escapeHtml(user.name)}">${initial}</a>
  `;
}

function renderHeaderCore(mountEl, fromRoot, user) {
  const prefix = fromRoot ? "" : "../";
  mountEl.innerHTML = `
    <div class="header-inner">
      <a class="brand" href="${prefix}home.html"><img class="brand-wordmark-img" src="${prefix}assets/img/site/synbase-wordmark.png" alt="SynBase"><span class="brand-suffix">by Stanford iGEM</span></a>
      <nav class="header-nav">${headerNavHtml(prefix, user)}</nav>
      <div class="header-actions">${headerActionsHtml(prefix, user)}</div>
    </div>
  `;
  wireNavDropdowns(mountEl);
}

function renderHeader(mountEl, fromRoot) {
  renderHeaderCore(mountEl, fromRoot, CURRENT_USER);
}

// ---------- Public header (About / Beyond SiBRP — no login required) ----------
// Unlike bootstrapAuthAndProgress, this never redirects a logged-out visitor
// to login — these pages must render for anyone. But when a user IS logged
// in, it still needs their progress before rendering the header's "Overall"
// pill: skipping this left CURRENT_USER/PROGRESS_CACHE at their empty
// defaults, so the pill always read 0% here regardless of real progress —
// visibly inconsistent with index.html/module pages, which do load it.
async function renderPublicHeader(mountEl, fromRoot) {
  let user = null;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      user = await loadCurrentUser(session.user);
      if (user) {
        CURRENT_USER = user;
        PROGRESS_CACHE = await loadProgressCache(session.user.id);
      }
    }
  } catch (e) {}
  renderHeaderCore(mountEl, fromRoot, user);
}
