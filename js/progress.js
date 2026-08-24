// Progress tracking shared by the homepage and every module page. Progress is
// now stored server-side per account (see server.js + server/store.js) instead
// of localStorage, so it follows a student across browsers/devices. Each page
// must call bootstrapAuthAndProgress(fromRoot) once before any of the render
// helpers below are used — it populates CURRENT_USER and PROGRESS_CACHE, and
// redirects to the login page if there's no valid session.
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
  if (!PROGRESS_CACHE[moduleId]) PROGRESS_CACHE[moduleId] = { sections: {} };
  if (!PROGRESS_CACHE[moduleId].sections) PROGRESS_CACHE[moduleId].sections = {};
  PROGRESS_CACHE[moduleId].sections[sectionId] = true;
  syncProgress(moduleId, { sectionId });
}

function moduleProgress(moduleId, sectionCount) {
  const mod = PROGRESS_CACHE[moduleId] || { sections: {} };
  const completed = Object.keys(mod.sections || {}).filter(k => mod.sections[k]).length;
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

// ---------- Nav dropdown (groups the SiBRP course + TA applications) ----------
const CHEVRON_DOWN = `<svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l5 5 5-5"/></svg>`;

function aboutNavDropdownHtml(prefix) {
  return `
    <div class="nav-dropdown">
      <button type="button" class="nav-dropdown-toggle">About ${CHEVRON_DOWN}</button>
      <div class="nav-dropdown-menu">
        <a href="${prefix}about.html">About SynBase</a>
        <a href="${prefix}stanford-igem-team.html">Stanford iGEM Team</a>
        <a href="${prefix}igem.html">What Is iGEM?</a>
      </div>
    </div>
  `;
}

function sibrpNavDropdownHtml(prefix, user) {
  return `
    <div class="nav-dropdown">
      <button type="button" class="nav-dropdown-toggle">SiBRP ${CHEVRON_DOWN}</button>
      <div class="nav-dropdown-menu">
        <a href="${prefix}beyond-sibrp.html">Beyond SiBRP</a>
        ${user ? `<a href="${prefix}application.html">Course Application</a>` : ""}
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
    ${aboutNavDropdownHtml(prefix)}
    <a href="${prefix}${user ? "index.html" : "curriculum.html"}">Curriculum</a>
    ${sibrpNavDropdownHtml(prefix, user)}
    <a href="${prefix}speaker-series.html">Speaker Series</a>
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
      <a class="brand" href="${prefix}about.html"><img class="brand-logo" src="${prefix}assets/img/site/logo.png" alt="SynBase"><span class="brand-suffix">by Stanford iGEM</span></a>
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
async function renderPublicHeader(mountEl, fromRoot) {
  let user = null;
  try {
    const res = await fetch("/api/me");
    const data = await res.json();
    user = data.user;
  } catch (e) {}
  renderHeaderCore(mountEl, fromRoot, user);
}
