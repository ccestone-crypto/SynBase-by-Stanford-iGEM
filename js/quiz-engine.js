// Renders a full module page as a Khan Academy-style, one-page-at-a-time
// lesson flow, from a plain-data MODULE object defined inline in each
// modules/moduleN.html.
//
// MODULE shape:
// {
//   id, number, title, lede,
//   pages: [
//     {
//       id, title,
//       type: "read",                      // an article page
//       html: "<p>...</p>"                  // already-safe static HTML
//     },
//     {
//       id, title,
//       type: "practice",                  // a check-your-understanding page
//       part: "Part 2: Exploring DNA",      // optional — groups consecutive pages
//       question: {
//         prompt: "...",
//         options: [{ text: "...", correct: true|false }, ...],
//         explanation: "..."
//       }
//     },
//     {
//       id, title,
//       type: "freeresponse",              // a discussion-board reflection page
//       freeResponse: { prompt: "..." }     // posting unlocks the discussion board
//     }, ...
//   ]
// }
//
// `part` is optional per page — consecutive pages sharing the same `part`
// string are grouped under one "Part X of Y" breadcrumb with their own dot
// row, so a long module doesn't render one unreadable 30-dot bar. Pages with
// no `part` are all treated as a single unlabeled group.

let CURRENT_PAGE_INDEX = 0;

function renderModulePage(MODULE) {
  const headerMount = document.getElementById("site-header");
  renderHeader(headerMount, false);

  const meta = MODULES_META.find(m => m.id === MODULE.id);

  if (!isModuleUnlocked(MODULE.id)) {
    renderLockedModule(MODULE);
    document.title = `Locked — ${MODULE.title} — SynBase`;
    return;
  }

  renderModuleHero(MODULE, meta);

  CURRENT_PAGE_INDEX = resolveStartPageIndex(MODULE);
  renderPageAt(MODULE, CURRENT_PAGE_INDEX);

  document.title = `${MODULE.title} — SynBase`;
}

function resolveStartPageIndex(MODULE) {
  const hash = location.hash.replace(/^#page-/, "");
  if (hash) {
    const idx = MODULE.pages.findIndex(p => p.id === hash);
    if (idx !== -1) return idx;
  }
  const firstIncomplete = MODULE.pages.findIndex(p => !isSectionComplete(MODULE.id, p.id));
  return firstIncomplete === -1 ? 0 : firstIncomplete;
}

function renderLockedModule(MODULE) {
  const { prev, prevProgress } = lockedModuleInfo(MODULE.id);

  document.getElementById("module-hero").innerHTML = `
    <div class="container">
      ${BRAND_MARK}
      <div class="breadcrumb"><a href="../index.html">Home</a> &rsaquo; Module ${MODULE.number}</div>
      <div class="module-chip-row">
        <span class="module-chip chip-locked">${MODULE.number}</span>
        <h1 style="margin:0">Module ${MODULE.number}: ${MODULE.title}</h1>
      </div>
    </div>
  `;
  document.getElementById("page-nav-mount").innerHTML = "";
  document.getElementById("page-viewport").innerHTML = `
    <div class="locked-panel">
      <div class="locked-icon">${LOCK_ICON}</div>
      <h2>This module is locked</h2>
      <p>Finish <strong>Module ${prev.number}: ${prev.title}</strong> (currently ${prevProgress.pct}% complete) to unlock Module ${MODULE.number}.</p>
      <a class="btn" href="${prev.id}.html">Go to Module ${prev.number}</a>
    </div>
  `;
  document.getElementById("page-footer-nav").innerHTML = "";
}

function refreshModuleProgressBar(MODULE, meta) {
  const p = moduleProgress(MODULE.id, meta.sectionCount);
  const bar = document.getElementById("module-progress-fill");
  const pct = document.getElementById("module-progress-pct");
  const count = document.getElementById("module-progress-count");
  if (bar) bar.style.width = p.pct + "%";
  if (pct) pct.textContent = p.pct + "%";
  if (count) count.textContent = `${p.completed}/${p.total} complete`;
  // keep the header's overall pill in sync too
  const headerMount = document.getElementById("site-header");
  if (headerMount) renderHeader(headerMount, false);
}

function renderModuleHero(MODULE, meta) {
  const el = document.getElementById("module-hero");
  el.innerHTML = `
    <div class="container">
      ${BRAND_MARK}
      <div class="breadcrumb"><a href="../index.html">Home</a> &rsaquo; Module ${MODULE.number}</div>
      <div class="module-chip-row">
        <span class="module-chip chip-${moduleAccentClass(MODULE.number)}">${MODULE.number}</span>
        <h1 style="margin:0">Module ${MODULE.number}: ${MODULE.title}</h1>
      </div>
      <p class="lede">${MODULE.lede}</p>
      <div class="module-progress-bar-wrap">
        <div class="progress-track"><div class="fill" id="module-progress-fill" style="width:0%"></div></div>
        <span class="pct" id="module-progress-pct">0%</span>
      </div>
      <p style="margin:8px 0 0;font-size:0.82rem;color:var(--ink-soft)" id="module-progress-count"></p>
    </div>
  `;
  refreshModuleProgressBar(MODULE, meta);
}

// ---------- Page grouping (for the "Part X of Y" breadcrumb + dot rows) ----------
function computePageGroups(MODULE) {
  const groups = [];
  MODULE.pages.forEach((page, i) => {
    const label = page.part || null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.end = i;
    else groups.push({ label, start: i, end: i });
  });
  return groups;
}

function renderPageNavMount(MODULE, index) {
  const groups = computePageGroups(MODULE);
  const groupIdx = groups.findIndex(g => index >= g.start && index <= g.end);
  const group = groups[groupIdx];
  const mount = document.getElementById("page-nav-mount");

  const breadcrumb = (groups.length > 1 && group.label)
    ? `<div class="page-part-label">Part ${groupIdx + 1} of ${groups.length} &middot; ${group.label}</div>`
    : "";

  const dots = [];
  for (let i = group.start; i <= group.end; i++) {
    const p = MODULE.pages[i];
    const state = i === index ? "current" : isSectionComplete(MODULE.id, p.id) ? "done" : "";
    dots.push(`<button type="button" class="page-dot ${state}" data-page-index="${i}" title="${p.title}" aria-label="${p.title}"></button>`);
  }

  mount.innerHTML = `${breadcrumb}<div class="page-dot-row">${dots.join("")}</div>`;
  mount.querySelectorAll(".page-dot").forEach(btn => {
    btn.addEventListener("click", () => renderPageAt(MODULE, Number(btn.dataset.pageIndex)));
  });
}

// ---------- Page body (one page visible at a time) ----------
function renderPageAt(MODULE, index) {
  CURRENT_PAGE_INDEX = index;
  const page = MODULE.pages[index];
  history.replaceState(null, "", `#page-${page.id}`);

  renderPageNavMount(MODULE, index);

  const el = document.getElementById("page-viewport");
  if (page.type === "read") {
    el.innerHTML = `
      <article class="page-card page-read">
        <h2>${page.title}</h2>
        <div class="topic-text">${page.html}</div>
      </article>
    `;
  } else if (page.type === "practice") {
    el.innerHTML = `
      <article class="page-card page-practice">
        <div class="quiz-label">Check Your Understanding</div>
        <h2>${page.title}</h2>
        ${quizTemplate(page)}
      </article>
    `;
    wireQuiz(MODULE, page, index);
  } else if (page.type === "freeresponse") {
    el.innerHTML = `
      <article class="page-card page-practice">
        <div class="quiz-label">Reflection</div>
        <h2>${page.title}</h2>
        ${freeResponseTemplate(page)}
      </article>
    `;
    wireFreeResponse(MODULE, page, index);
  }
  window.scrollTo(0, 0);

  renderPageFooterNav(MODULE, index);
}

function renderPageFooterNav(MODULE, index) {
  const mount = document.getElementById("page-footer-nav");
  const isFirst = index === 0;
  const isLast = index === MODULE.pages.length - 1;
  const metaIdx = MODULES_META.findIndex(m => m.id === MODULE.id);
  const nextModule = MODULES_META[metaIdx + 1];

  const continueLabel = !isLast
    ? "Continue &rarr;"
    : nextModule
      ? `Finish Module &rarr; Module ${nextModule.number}`
      : "Finish Module &rarr; Home";

  mount.innerHTML = `
    <button type="button" class="btn secondary" data-page-back ${isFirst ? "disabled" : ""}>&larr; Back</button>
    <button type="button" class="btn" data-page-continue>${continueLabel}</button>
  `;

  mount.querySelector("[data-page-back]").addEventListener("click", () => {
    if (!isFirst) renderPageAt(MODULE, index - 1);
  });
  mount.querySelector("[data-page-continue]").addEventListener("click", () => {
    const page = MODULE.pages[index];
    if (page.type === "read" && !isSectionComplete(MODULE.id, page.id)) {
      markSectionComplete(MODULE.id, page.id);
      const meta = MODULES_META.find(m => m.id === MODULE.id);
      refreshModuleProgressBar(MODULE, meta);
    }
    if (!isLast) {
      renderPageAt(MODULE, index + 1);
    } else if (nextModule) {
      location.href = `${nextModule.id}.html`;
    } else {
      location.href = "../index.html";
    }
  });
}

// ---------- Practice (multiple-choice) pages ----------
function quizTemplate(page) {
  const q = page.question;
  return `
    <div class="quiz-box" data-quiz-for="${page.id}">
      <p class="quiz-question">${q.prompt}</p>
      <div class="quiz-options">
        ${q.options.map((opt, i) => `
          <label class="quiz-option" data-option-index="${i}">
            <input type="radio" name="quiz-${page.id}" value="${i}">
            <span>${opt.text}</span>
          </label>
        `).join("")}
      </div>
      <div class="quiz-actions">
        <button type="button" class="btn small" data-check-btn>Check Answer</button>
        <span class="quiz-feedback" data-feedback></span>
      </div>
      <div class="quiz-explanation" data-explanation>${q.explanation}</div>
    </div>
  `;
}

function wireQuiz(MODULE, page, index) {
  if (!page.question) return;
  const box = document.querySelector(`.quiz-box[data-quiz-for="${page.id}"]`);
  if (!box) return;
  const checkBtn = box.querySelector("[data-check-btn]");
  const feedback = box.querySelector("[data-feedback]");
  const explanation = box.querySelector("[data-explanation]");
  const options = Array.from(box.querySelectorAll(".quiz-option"));

  checkBtn.addEventListener("click", () => {
    const selected = box.querySelector("input[type=radio]:checked");
    if (!selected) {
      feedback.textContent = "Select an answer first.";
      feedback.className = "quiz-feedback incorrect";
      return;
    }
    const idx = Number(selected.value);
    const isCorrect = !!page.question.options[idx].correct;

    options.forEach((opt, i) => {
      opt.classList.remove("correct", "incorrect");
      if (page.question.options[i].correct) opt.classList.add("correct");
      else if (i === idx) opt.classList.add("incorrect");
    });

    feedback.textContent = isCorrect ? "Correct!" : "Not quite — see the explanation below.";
    feedback.className = "quiz-feedback " + (isCorrect ? "correct" : "incorrect");
    explanation.classList.add("show");

    if (isCorrect && !isSectionComplete(MODULE.id, page.id)) {
      markSectionComplete(MODULE.id, page.id);
      const meta = MODULES_META.find(m => m.id === MODULE.id);
      refreshModuleProgressBar(MODULE, meta);
      renderPageNavMount(MODULE, index);
    }
  });
}

// ---------- Free-response / discussion-board pages ----------
function freeResponseTemplate(page) {
  const fr = page.freeResponse;
  return `
    <div class="free-response-box" data-fr-for="${page.id}">
      <div class="free-response-label"><span class="fr-badge">Post to see what classmates wrote</span></div>
      <p class="free-response-question">${fr.prompt}</p>
      <textarea class="free-response-input" data-fr-input rows="5" placeholder="Type your response here..." maxlength="4000"></textarea>
      <div class="free-response-actions">
        <button type="button" class="btn small" data-fr-submit>Post Response</button>
        <span class="free-response-status" data-fr-status></span>
      </div>
      <div class="discussion-board" data-fr-board>
        <div class="discussion-board-label">Class Responses</div>
        <div class="discussion-board-list" data-fr-board-list></div>
      </div>
    </div>
  `;
}

function renderBoardLocked(el) {
  el.innerHTML = `<p class="discussion-board-locked">Submit your response above to see what other students wrote.</p>`;
}

// board entries are anonymous, user-submitted text — build the skeleton via
// innerHTML, then fill each entry via textContent (same XSS-safe pattern as
// the AI feedback box) rather than interpolating the text into the template.
function renderBoardEntries(el, board) {
  if (!board || !board.length) {
    el.innerHTML = `<p class="discussion-board-empty">No responses yet — be the first!</p>`;
    return;
  }
  el.innerHTML = board.map((_, i) => `
    <div class="discussion-board-entry">
      <div class="discussion-board-entry-label">Response ${i + 1}</div>
      <div class="discussion-board-entry-text" data-entry-text></div>
    </div>
  `).join("");
  el.querySelectorAll("[data-entry-text]").forEach((node, i) => {
    node.textContent = board[i].answer;
  });
}

function wireFreeResponse(MODULE, page, index) {
  if (!page.freeResponse) return;
  const box = document.querySelector(`.free-response-box[data-fr-for="${page.id}"]`);
  if (!box) return;
  const input = box.querySelector("[data-fr-input]");
  const submitBtn = box.querySelector("[data-fr-submit]");
  const status = box.querySelector("[data-fr-status]");
  const boardList = box.querySelector("[data-fr-board-list]");

  // Prefill from a previous attempt, if any, so students can see and revise
  // their last answer instead of starting from a blank box every visit. The
  // discussion board only arrives in the response once they've already
  // answered — gated server-side, not something the client decides.
  renderBoardLocked(boardList);
  fetch(`/api/free-response/${encodeURIComponent(MODULE.id)}/${encodeURIComponent(page.id)}`)
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && data.response) {
        input.value = data.response.answer || "";
        renderBoardEntries(boardList, data.board);
      }
    })
    .catch(() => {});

  submitBtn.addEventListener("click", async () => {
    const answer = input.value.trim();
    if (!answer) {
      status.textContent = "Write a response first.";
      status.className = "free-response-status incorrect";
      return;
    }

    submitBtn.disabled = true;
    status.textContent = "Posting…";
    status.className = "free-response-status";

    try {
      const res = await fetch("/api/free-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: MODULE.id,
          sectionId: page.id,
          answer
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      status.textContent = "Posted! Revise and resubmit anytime.";
      status.className = "free-response-status correct";
      renderBoardEntries(boardList, data.board);

      if (!isSectionComplete(MODULE.id, page.id)) {
        markSectionComplete(MODULE.id, page.id);
        const meta = MODULES_META.find(m => m.id === MODULE.id);
        refreshModuleProgressBar(MODULE, meta);
        renderPageNavMount(MODULE, index);
      }
    } catch (err) {
      status.textContent = err.message || "Couldn't post your response. Please try again.";
      status.className = "free-response-status incorrect";
    } finally {
      submitBtn.disabled = false;
    }
  });
}
