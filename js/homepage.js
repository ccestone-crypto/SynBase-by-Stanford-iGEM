// Renders the homepage as a Khan-Academy-style course overview: a course
// header with jump pills, a progress legend, and a list of collapsible
// "unit" cards (one per module) whose lesson rows link into the matching
// module page. Depends on modules-meta.js, course-outline.js, and progress.js
// all being loaded first.

const ICONS = {
  chevron: `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8l4 4 4-4"/></svg>`,
  reading: `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h6l3.5 3.5V17H5z"/><path d="M11 3v3.5h3.5"/><path d="M7.3 10.2h5.4M7.3 13.2h5.4"/></svg>`,
  practice: `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.3"/><path d="M6.8 10.3l2.1 2.1 4.3-4.6"/></svg>`,
  statusDone: `<svg viewBox="0 0 20 20" width="15" height="15"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="M6 10.2l2.6 2.6L14.5 6.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  statusOpen: `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="8"/></svg>`
};

function renderCourseHeader(mountEl) {
  const overall = overallProgress();
  const totalLessons = MODULES_META.reduce((sum, m) => sum + m.sectionCount, 0);
  mountEl.innerHTML = `
    <div class="container">
      ${BRAND_MARK}
      <div class="course-eyebrow">SiBRP Academy &rsaquo; Science</div>
      <h1>Core Concepts in Molecular and Cellular Biology</h1>
      <div class="course-meta">${MODULES_META.length} MODULES &middot; ${totalLessons} LESSONS &middot; ${overall.pct}% COMPLETE</div>
      <p class="course-intro">A self-paced curriculum adapted from Stanford iGEM's SiBRP Session 2. Work through cells, DNA, engineering applications, and gene delivery — one lesson at a time, with a short check for understanding after each one.</p>
      <div class="jump-row">
        <div class="jump-pills">
          ${MODULES_META.map(m => `<a class="pill" href="#${m.id}">Module ${m.number}</a>`).join("")}
        </div>
        <a class="challenge-card" href="${MODULES_META[MODULES_META.length - 1].href}">
          <span class="challenge-label">Recap Challenge</span>
          <span class="challenge-title">Test what you remember across every module</span>
        </a>
      </div>
    </div>
  `;
}

function renderLegend(mountEl) {
  mountEl.innerHTML = `
    <div class="container legend-row">
      <span class="legend-item">${ICONS.statusDone} Complete</span>
      <span class="legend-item">${ICONS.statusOpen} Not started</span>
      <span class="legend-item">${ICONS.reading} Reading</span>
      <span class="legend-item">${ICONS.practice} Check your understanding</span>
    </div>
  `;
}

function renderUnitsAccordion(mountEl) {
  const firstIncompleteIdx = MODULES_META.findIndex(m => moduleProgress(m.id, m.sectionCount).pct < 100);
  const defaultOpenIdx = firstIncompleteIdx === -1 ? 0 : firstIncompleteIdx;

  mountEl.innerHTML = MODULES_META.map((m, idx) => {
    const p = moduleProgress(m.id, m.sectionCount);
    const outline = COURSE_OUTLINE[m.id] || [];
    const openAttr = idx === defaultOpenIdx ? "open" : "";

    if (!isModuleUnlocked(m.id)) {
      const { prev, prevProgress } = lockedModuleInfo(m.id);
      return `
        <div class="unit unit-locked" id="${m.id}">
          <div class="unit-summary">
            <span class="unit-chevron">${LOCK_ICON}</span>
            <span class="unit-heading">
              <span class="module-chip chip-locked">${m.number}</span>
              <span class="unit-title-group">
                <span class="unit-label">Module ${m.number}</span>
                <span class="unit-title">${m.title}</span>
              </span>
            </span>
            <span class="unit-progress">
              <span class="unit-progress-pct">${p.pct}%</span>
              <span class="progress-track light small"><span class="fill" style="width:${p.pct}%"></span></span>
            </span>
          </div>
          <div class="unit-body">
            <p class="unit-desc">Locked until you finish <strong>Module ${prev.number}: ${prev.title}</strong> (currently ${prevProgress.pct}% complete).</p>
          </div>
        </div>
      `;
    }

    const rows = outline.map(section => {
      const done = isSectionComplete(m.id, section.id);
      const href = `${m.href}#section-${section.id}`;
      return `
        <div class="lesson-group">
          <a class="lesson-row" href="${href}">
            <span class="lesson-icon">${ICONS.reading}</span>
            <span class="lesson-title">${section.title}</span>
          </a>
          <a class="lesson-row" href="${href}">
            <span class="lesson-icon">${ICONS.practice}</span>
            <span class="lesson-title">Check your understanding: ${section.title}</span>
            <span class="lesson-status ${done ? "is-done" : ""}">${done ? ICONS.statusDone : ICONS.statusOpen}</span>
          </a>
        </div>
      `;
    }).join("");

    return `
      <details class="unit" id="${m.id}" ${openAttr}>
        <summary class="unit-summary">
          <span class="unit-chevron">${ICONS.chevron}</span>
          <span class="unit-heading">
            <span class="module-chip chip-${moduleAccentClass(m.number)}">${m.number}</span>
            <span class="unit-title-group">
              <span class="unit-label">Module ${m.number}</span>
              <span class="unit-title">${m.title}</span>
            </span>
          </span>
          <span class="unit-progress">
            <span class="unit-progress-pct">${p.pct}%</span>
            <span class="progress-track light small"><span class="fill" style="width:${p.pct}%"></span></span>
          </span>
        </summary>
        <div class="unit-body">
          <p class="unit-desc">${m.description}</p>
          ${rows}
          <a class="btn small unit-open-btn" href="${m.href}">${p.pct === 0 ? "Start Module" : p.pct >= 100 ? "Review Module" : "Continue Module"}</a>
        </div>
      </details>
    `;
  }).join("");
}

function renderUpNext(mountEl) {
  const firstIncomplete = MODULES_META.find(m => moduleProgress(m.id, m.sectionCount).pct < 100);
  if (!firstIncomplete) {
    mountEl.innerHTML = `
      <div class="container">
        <div class="up-next-card">
          <div class="up-next-label">Up Next</div>
          <div class="up-next-title">You've completed every module — nice work!</div>
          <a class="btn" href="${MODULES_META[MODULES_META.length - 1].href}">Review the Recap</a>
        </div>
      </div>
    `;
    return;
  }
  const outline = COURSE_OUTLINE[firstIncomplete.id] || [];
  const nextSection = outline.find(s => !isSectionComplete(firstIncomplete.id, s.id)) || outline[0];
  mountEl.innerHTML = `
    <div class="container">
      <div class="up-next-card">
        <div class="up-next-label">Up Next</div>
        <div class="up-next-title">${firstIncomplete.title}${nextSection ? ": " + nextSection.title : ""}</div>
        <a class="btn" href="${firstIncomplete.href}#section-${nextSection ? nextSection.id : ""}">Continue</a>
      </div>
    </div>
  `;
}
