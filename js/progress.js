// Progress tracking shared by the homepage and every module page. Progress is
// now stored server-side per account (see server.js + server/store.js) instead
// of localStorage, so it follows a student across browsers/devices. Each page
// must call bootstrapAuthAndProgress(fromRoot) once before any of the render
// helpers below are used — it populates CURRENT_USER and PROGRESS_CACHE, and
// redirects to the login page if there's no valid session.
let CURRENT_USER = null;
let PROGRESS_CACHE = {};

function loginPath(fromRoot) {
  return fromRoot ? "login.html" : "../login.html";
}

async function bootstrapAuthAndProgress(fromRoot) {
  const meRes = await fetch("/api/me");
  const me = await meRes.json();

  if (!me.user) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `${loginPath(fromRoot)}?next=${next}`;
    return null;
  }

  CURRENT_USER = me.user;

  const progRes = await fetch("/api/progress");
  const data = await progRes.json();
  PROGRESS_CACHE = data.progress || {};

  return CURRENT_USER;
}

// Fire-and-forget persistence — the local cache is already updated by the
// caller, so the UI never waits on this network round trip.
function syncProgress(moduleId, patch) {
  fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moduleId, ...patch })
  }).catch(() => {});
}

function isSectionComplete(moduleId, sectionId) {
  const mod = PROGRESS_CACHE[moduleId];
  return !!(mod && mod.sections && mod.sections[sectionId]);
}

function markSectionComplete(moduleId, sectionId) {
  if (!PROGRESS_CACHE[moduleId]) PROGRESS_CACHE[moduleId] = { sections: {}, videoWatched: false };
  if (!PROGRESS_CACHE[moduleId].sections) PROGRESS_CACHE[moduleId].sections = {};
  PROGRESS_CACHE[moduleId].sections[sectionId] = true;
  syncProgress(moduleId, { sectionId });
}

function isVideoWatched(moduleId) {
  const mod = PROGRESS_CACHE[moduleId];
  return !!(mod && mod.videoWatched);
}

function setVideoWatched(moduleId, watched) {
  if (!PROGRESS_CACHE[moduleId]) PROGRESS_CACHE[moduleId] = { sections: {}, videoWatched: false };
  PROGRESS_CACHE[moduleId].videoWatched = watched;
  syncProgress(moduleId, { videoWatched: watched });
}

// total units = sections + 1 (the intro video) so watching the video counts toward progress
function moduleProgress(moduleId, sectionCount) {
  const mod = PROGRESS_CACHE[moduleId] || { sections: {}, videoWatched: false };
  const completedSections = Object.keys(mod.sections || {}).filter(k => mod.sections[k]).length;
  const total = sectionCount + 1;
  const completed = completedSections + (mod.videoWatched ? 1 : 0);
  return { completed, total, pct: Math.round((completed / total) * 100) };
}

function overallProgress() {
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
const LOCK_ICON = `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9"/></svg>`;

function isModuleUnlocked(moduleId) {
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
  return MODULE_ACCENT_CYCLE[(number - 1) % MODULE_ACCENT_CYCLE.length];
}

// Small red-bar/gold-bar mark echoing the corner ornament repeated on every slide.
const BRAND_MARK = `<div class="brand-mark"><span class="bar1"></span><span class="bar2"></span></div>`;

// ---------- Shared header ----------
function renderHeader(mountEl, fromRoot) {
  const overall = overallProgress();
  const homeHref = fromRoot ? "index.html" : "../index.html";
  const prefix = fromRoot ? "" : "../";
  const name = CURRENT_USER ? CURRENT_USER.name : "";
  mountEl.innerHTML = `
    <div class="header-inner">
      <a class="brand" href="${homeHref}"><span class="dot"></span> SiBRP Academy</a>
      <nav class="header-nav">
        <a href="${homeHref}">Home</a>
        <a href="${prefix}about.html">About</a>
        <a href="${prefix}beyond-sibrp.html">Beyond SiBRP</a>
        <a href="${prefix}application.html">Apply</a>
        <a href="${prefix}speaker-series.html">Speaker Series</a>
        ${CURRENT_USER && CURRENT_USER.isAdmin ? `<a href="${prefix}admin.html">Admin</a>` : ""}
        <span class="header-progress-pill">Overall: ${overall.pct}%</span>
        ${name ? `<span class="header-user">${name}</span>` : ""}
        <a href="#" id="logout-link">Log out</a>
      </nav>
    </div>
  `;

  const logoutLink = mountEl.querySelector("#logout-link");
  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    location.href = loginPath(fromRoot);
  });
}

// ---------- Public header (About / Beyond SiBRP — no login required) ----------
async function renderPublicHeader(mountEl, fromRoot) {
  const homeHref = fromRoot ? "index.html" : "../index.html";
  const prefix = fromRoot ? "" : "../";

  let user = null;
  try {
    const res = await fetch("/api/me");
    const data = await res.json();
    user = data.user;
  } catch (e) {}

  mountEl.innerHTML = `
    <div class="header-inner">
      <a class="brand" href="${prefix}about.html"><span class="dot"></span> SiBRP Academy</a>
      <nav class="header-nav">
        <a href="${prefix}about.html">About</a>
        <a href="${prefix}beyond-sibrp.html">Beyond SiBRP</a>
        ${user ? `
          <a href="${homeHref}">Home</a>
          <a href="${prefix}application.html">Apply</a>
          <a href="${prefix}speaker-series.html">Speaker Series</a>
          ${user.isAdmin ? `<a href="${prefix}admin.html">Admin</a>` : ""}
          <span class="header-user">${user.name}</span>
          <a href="#" id="logout-link">Log out</a>
        ` : `
          <a href="${prefix}login.html">Log In</a>
          <a class="btn small" href="${prefix}signup.html">Sign Up</a>
        `}
      </nav>
    </div>
  `;

  if (user) {
    mountEl.querySelector("#logout-link").addEventListener("click", async (e) => {
      e.preventDefault();
      await fetch("/api/logout", { method: "POST" }).catch(() => {});
      location.reload();
    });
  }
}
