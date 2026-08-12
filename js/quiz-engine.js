// Renders a full module page (video block, topic articles, quizzes, nav)
// from a plain-data MODULE object defined inline in each modules/moduleN.html.
//
// MODULE shape:
// {
//   id, number, title, lede,
//   sections: [
//     {
//       id, title,
//       img, imgAlt, caption,
//       html: "<p>...</p>",              // article body, already-safe static HTML
//       question: {
//         prompt: "...",
//         options: [{ text: "...", correct: true|false }, ...],
//         explanation: "..."
//       },
//       freeResponse: {                    // optional, alongside or instead of `question`
//         prompt: "..."                    // shown to the student; posting unlocks the discussion board
//       }
//     }, ...
//   ]
// }

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
  renderVideoBlock(MODULE);
  renderSections(MODULE);
  renderFooterNav(MODULE);

  document.title = `${MODULE.title} — SynBase`;
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
  document.getElementById("video-block").innerHTML = "";
  document.getElementById("topic-sections").innerHTML = `
    <div class="locked-panel">
      <div class="locked-icon">${LOCK_ICON}</div>
      <h2>This module is locked</h2>
      <p>Finish <strong>Module ${prev.number}: ${prev.title}</strong> (currently ${prevProgress.pct}% complete) to unlock Module ${MODULE.number}.</p>
      <a class="btn" href="${prev.id}.html">Go to Module ${prev.number}</a>
    </div>
  `;
  document.getElementById("module-footer-nav").innerHTML = `
    <div><a class="btn secondary" href="${prev.id}.html">&larr; Module ${prev.number}: ${prev.title}</a></div>
    <div><a class="btn secondary" href="../index.html">Back to Home &rarr;</a></div>
  `;
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

function renderVideoBlock(MODULE) {
  const el = document.getElementById("video-block");
  const watched = isVideoWatched(MODULE.id);
  el.innerHTML = `
    <div class="container narrow">
      <div class="video-block">
        <h2>Preliminary Teaching Video</h2>
        <p class="hint">Insert this module's teaching video here before class. Drop a file at
          <code>assets/video/${MODULE.id}.mp4</code> and it will play automatically instead of this placeholder.</p>
        <div class="video-placeholder">
          <div class="icon">&#9654;</div>
          <div><strong>No video uploaded yet</strong></div>
          <div>Place a file named <code>${MODULE.id}.mp4</code> in <code>assets/video/</code></div>
        </div>
        <label class="watched-toggle">
          <input type="checkbox" id="video-watched-checkbox" ${watched ? "checked" : ""}>
          I watched the teaching video for this module
        </label>
      </div>
    </div>
  `;

  // If a real video file exists, swap the placeholder for a <video> element.
  const probe = new Image();
  const videoSrc = `../assets/video/${MODULE.id}.mp4`;
  fetch(videoSrc, { method: "HEAD" }).then(res => {
    if (res.ok) {
      const placeholder = el.querySelector(".video-placeholder");
      placeholder.outerHTML = `<video controls src="${videoSrc}"></video>`;
    }
  }).catch(() => {});

  const checkbox = document.getElementById("video-watched-checkbox");
  checkbox.addEventListener("change", () => {
    setVideoWatched(MODULE.id, checkbox.checked);
    const meta = MODULES_META.find(m => m.id === MODULE.id);
    refreshModuleProgressBar(MODULE, meta);
  });
}

function renderSections(MODULE) {
  const el = document.getElementById("topic-sections");
  el.innerHTML = MODULE.sections.map((section, i) => sectionTemplate(MODULE, section, i)).join("");

  MODULE.sections.forEach(section => {
    wireQuiz(MODULE, section);
    wireFreeResponse(MODULE, section);
  });
}

function sectionTemplate(MODULE, section, index) {
  const complete = isSectionComplete(MODULE.id, section.id);
  const tint = moduleAccentClass(MODULE.number);
  return `
    <article class="topic-article ${complete ? "is-complete" : ""}" id="section-${section.id}" data-section-id="${section.id}">
      <div class="topic-article-header">
        <span class="topic-index tint-${tint}">${complete ? "&#10003;" : index + 1}</span>
        <h2>${section.title}</h2>
      </div>
      <div class="topic-body">
        <figure class="topic-figure">
          <img src="${section.img}" alt="${section.imgAlt}" loading="lazy">
          <figcaption>${section.caption}</figcaption>
        </figure>
        <div class="topic-text">${section.html}</div>
        ${section.question ? quizTemplate(section) : ""}
        ${section.freeResponse ? freeResponseTemplate(section) : ""}
      </div>
    </article>
  `;
}

function quizTemplate(section) {
  const q = section.question;
  return `
    <div class="quiz-box" data-quiz-for="${section.id}">
      <div class="quiz-label">Check Your Understanding</div>
      <p class="quiz-question">${q.prompt}</p>
      <div class="quiz-options">
        ${q.options.map((opt, i) => `
          <label class="quiz-option" data-option-index="${i}">
            <input type="radio" name="quiz-${section.id}" value="${i}">
            <span>${opt.text}</span>
          </label>
        `).join("")}
      </div>
      <div class="quiz-actions">
        <button class="btn small" data-check-btn>Check Answer</button>
        <span class="quiz-feedback" data-feedback></span>
      </div>
      <div class="quiz-explanation" data-explanation>${q.explanation}</div>
    </div>
  `;
}

function wireQuiz(MODULE, section) {
  if (!section.question) return;
  const box = document.querySelector(`.quiz-box[data-quiz-for="${section.id}"]`);
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
    const isCorrect = !!section.question.options[idx].correct;

    options.forEach((opt, i) => {
      opt.classList.remove("correct", "incorrect");
      if (section.question.options[i].correct) opt.classList.add("correct");
      else if (i === idx) opt.classList.add("incorrect");
    });

    feedback.textContent = isCorrect ? "Correct!" : "Not quite — see the explanation below.";
    feedback.className = "quiz-feedback " + (isCorrect ? "correct" : "incorrect");
    explanation.classList.add("show");

    if (isCorrect) {
      markSectionComplete(MODULE.id, section.id);
      const articleEl = document.getElementById(`section-${section.id}`);
      articleEl.classList.add("is-complete");
      articleEl.querySelector(".topic-index").innerHTML = "&#10003;";
      const meta = MODULES_META.find(m => m.id === MODULE.id);
      refreshModuleProgressBar(MODULE, meta);
    }
  });
}

function freeResponseTemplate(section) {
  const fr = section.freeResponse;
  return `
    <div class="free-response-box" data-fr-for="${section.id}">
      <div class="free-response-label">Reflection <span class="fr-badge">Post to see what classmates wrote</span></div>
      <p class="free-response-question">${fr.prompt}</p>
      <textarea class="free-response-input" data-fr-input rows="5" placeholder="Type your response here..." maxlength="4000"></textarea>
      <div class="free-response-actions">
        <button class="btn small" data-fr-submit>Post Response</button>
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

function wireFreeResponse(MODULE, section) {
  if (!section.freeResponse) return;
  const box = document.querySelector(`.free-response-box[data-fr-for="${section.id}"]`);
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
  fetch(`/api/free-response/${encodeURIComponent(MODULE.id)}/${encodeURIComponent(section.id)}`)
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
          sectionId: section.id,
          answer
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      status.textContent = "Posted! Revise and resubmit anytime.";
      status.className = "free-response-status correct";
      renderBoardEntries(boardList, data.board);

      markSectionComplete(MODULE.id, section.id);
      const articleEl = document.getElementById(`section-${section.id}`);
      articleEl.classList.add("is-complete");
      articleEl.querySelector(".topic-index").innerHTML = "&#10003;";
      const meta = MODULES_META.find(m => m.id === MODULE.id);
      refreshModuleProgressBar(MODULE, meta);
    } catch (err) {
      status.textContent = err.message || "Couldn't post your response. Please try again.";
      status.className = "free-response-status incorrect";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function renderFooterNav(MODULE) {
  const el = document.getElementById("module-footer-nav");
  const idx = MODULES_META.findIndex(m => m.id === MODULE.id);
  const prev = MODULES_META[idx - 1];
  const next = MODULES_META[idx + 1];
  el.innerHTML = `
    <div>${prev ? `<a class="btn secondary" href="${prev.id}.html">&larr; Module ${prev.number}: ${prev.title}</a>` : `<a class="btn secondary" href="../index.html">&larr; Home</a>`}</div>
    <div>${next ? `<a class="btn" href="${next.id}.html">Module ${next.number}: ${next.title} &rarr;</a>` : `<a class="btn" href="../index.html">Back to Home &rarr;</a>`}</div>
  `;
}
