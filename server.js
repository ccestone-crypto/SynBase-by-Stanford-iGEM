require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const store = require("./server/store");
const mailer = require("./server/mailer");
const speakerStore = require("./server/speaker-store");
const portfolioStore = require("./server/portfolio-store");
const freeResponseStore = require("./server/free-response-store");
const { getFormativeFeedback } = require("./server/ai-feedback");
const { getSessionSecret } = require("./server/secret");
const { isCourseComplete, isValidSection } = require("./server/course-config");

const SESSION_SECRET = getSessionSecret();
const COOKIE_NAME = "sibrp_session";
const PORT = process.env.PORT || 8420;

// Only emails listed in the ADMIN_EMAILS env var (comma-separated) get admin
// access on signup — set this before anyone signs up on a fresh deploy.
// Additional admins can be granted later from the Admin dashboard itself.
function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

const app = express();
app.use(express.json());
app.use(cookieParser());

// ---------- Portfolio project photo uploads ----------
const PORTFOLIO_UPLOAD_DIR = path.join(__dirname, "assets", "img", "portfolio", "uploads");
if (!fs.existsSync(PORTFOLIO_UPLOAD_DIR)) fs.mkdirSync(PORTFOLIO_UPLOAD_DIR, { recursive: true });
const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const portfolioImageUpload = multer({
  storage: multer.diskStorage({
    destination: PORTFOLIO_UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_MIMES.has(file.mimetype)) return cb(new Error("Photo must be a JPEG, PNG, WebP, or GIF image."));
    cb(null, true);
  }
});

// ---------- Auth helpers ----------
function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id }, SESSION_SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function getUserFromRequest(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    return store.findUserById(payload.sub);
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  if (!user.isAdmin) return res.status(403).json({ error: "Admin access required." });
  req.user = user;
  next();
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ---------- Rate limiting ----------
// Generous enough that a classroom on one shared/school IP won't lock itself
// out, but tight enough to stop scripted credential-stuffing or reset-spam.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts from this network. Please try again in a few minutes." }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reset requests from this network. Please try again in a few minutes." }
});

// Each request is a paid AI API call, so cap it independently of the
// generous auth limiter above — still comfortably more than a student would
// hit while genuinely revising an answer.
const aiFeedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many feedback requests. Please wait a few minutes and try again." }
});

// On top of the per-IP limiter above, this stops any single email address
// from being re-sent a link more than once a minute (also doubles as basic
// "resend" throttling for the UI) — applied to any submitted address, real
// account or not, so it can't be used to probe which emails exist.
const RESET_COOLDOWN_MS = 60 * 1000;
const resetCooldowns = new Map(); // normalized email -> last request timestamp

function pruneResetCooldowns() {
  const cutoff = Date.now() - RESET_COOLDOWN_MS;
  for (const [email, ts] of resetCooldowns) {
    if (ts < cutoff) resetCooldowns.delete(email);
  }
}

// ---------- Auth API ----------
app.post("/api/signup", authLimiter, (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Please enter your name." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (store.findUserByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const isListedAdmin = getAdminEmails().includes(String(email).trim().toLowerCase());

  const passwordHash = bcrypt.hashSync(String(password), 10);
  let user;
  try {
    user = store.createUser({
      id: crypto.randomUUID(),
      name: String(name).trim(),
      email,
      passwordHash,
      isAdmin: isListedAdmin
    });
  } catch (e) {
    if (/UNIQUE constraint failed/.test(e.message)) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    throw e;
  }

  issueSession(res, user);
  res.json({ user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin, taEligible: !!user.taEligible } });
});

app.post("/api/login", authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const user = store.findUserByEmail(email);
  if (!user || !bcrypt.compareSync(String(password || ""), user.passwordHash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  issueSession(res, user);
  res.json({ user: { id: user.id, name: user.name, email: user.email, isAdmin: !!user.isAdmin, taEligible: !!user.taEligible } });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const user = getUserFromRequest(req);
  res.json({ user: user ? { id: user.id, name: user.name, email: user.email, isAdmin: !!user.isAdmin, taEligible: !!user.taEligible } : null });
});

// ---------- Forgot / reset password ----------
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

app.post("/api/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};
  const genericResponse = { ok: true, message: "If an account exists for that email, a reset link has been sent." };

  if (!isValidEmail(email)) return res.json(genericResponse);

  const normalizedEmail = String(email).trim().toLowerCase();
  const lastRequestAt = resetCooldowns.get(normalizedEmail);
  if (lastRequestAt && Date.now() - lastRequestAt < RESET_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESET_COOLDOWN_MS - (Date.now() - lastRequestAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSeconds}s before requesting another reset link.` });
  }
  resetCooldowns.set(normalizedEmail, Date.now());
  if (resetCooldowns.size > 1000) pruneResetCooldowns();

  const user = store.findUserByEmail(email);
  if (!user) return res.json(genericResponse); // don't reveal whether the account exists

  const rawToken = crypto.randomBytes(32).toString("hex");
  store.setResetToken(user.id, hashToken(rawToken), Date.now() + RESET_TOKEN_TTL_MS);

  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const resetUrl = `${baseUrl}/reset-password.html?token=${rawToken}`;

  const sent = await mailer.sendMail({
    to: user.email,
    subject: "Reset your SynBase password",
    text: `We received a request to reset your SynBase password.\n\nReset it here (this link expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`
  }).catch(() => false);

  // Only surfaced when SMTP isn't configured, so local/dev testing works without a real mail server.
  res.json(sent ? genericResponse : { ...genericResponse, devResetUrl: resetUrl });
});

app.post("/api/reset-password", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: "Missing reset token." });
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const user = store.findUserByResetTokenHash(hashToken(String(token)));
  if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired." });

  store.updatePassword(user.id, bcrypt.hashSync(String(password), 10));
  store.clearResetToken(user.id);
  res.json({ ok: true });
});

// ---------- Progress API ----------
app.get("/api/progress", requireAuth, (req, res) => {
  res.json({ progress: store.readProgress(req.user.id) });
});

// Body: { moduleId, sectionId } to mark a section complete,
// or { moduleId, videoWatched } to set the video-watched flag.
app.post("/api/progress", requireAuth, (req, res) => {
  const { moduleId, sectionId, videoWatched } = req.body || {};
  if (!moduleId) return res.status(400).json({ error: "moduleId is required." });

  if (sectionId) {
    if (!isValidSection(moduleId, sectionId)) {
      return res.status(400).json({ error: "Unknown section." });
    }
    store.markSectionComplete(req.user.id, moduleId, sectionId);
  }
  if (typeof videoWatched === "boolean") store.setVideoWatched(req.user.id, moduleId, videoWatched);

  res.json({ progress: store.readProgress(req.user.id) });
});

// ---------- Free-response AI feedback ----------
const FREE_RESPONSE_MAX_LEN = 4000;

// The discussion board (everyone's answers, anonymized) only unlocks once
// the requesting user has submitted their own answer for this section —
// enforced here, not on the client, since the client can't be trusted to
// hide data it was never supposed to receive.
app.get("/api/free-response/:moduleId/:sectionId", requireAuth, (req, res) => {
  const { moduleId, sectionId } = req.params;
  if (!isValidSection(moduleId, sectionId)) return res.status(400).json({ error: "Unknown section." });
  const response = freeResponseStore.getResponse(req.user.id, moduleId, sectionId);
  const board = response ? freeResponseStore.listAnswersForSection(moduleId, sectionId) : [];
  res.json({ response, board });
});

// Body: { moduleId, sectionId, prompt, rubric, answer }. prompt/rubric come
// from the (developer-authored, non-sensitive) module content and only
// shape the AI's feedback — they carry no completion-gating weight, so
// there's nothing to gain by tampering with them beyond worse feedback for
// yourself. answer is the only field with real limits.
app.post("/api/free-response", requireAuth, aiFeedbackLimiter, async (req, res) => {
  const { moduleId, sectionId, prompt, rubric, answer } = req.body || {};
  if (!isValidSection(moduleId, sectionId)) return res.status(400).json({ error: "Unknown section." });

  const trimmedAnswer = typeof answer === "string" ? answer.trim() : "";
  if (!trimmedAnswer) return res.status(400).json({ error: "Write a response before requesting feedback." });
  if (trimmedAnswer.length > FREE_RESPONSE_MAX_LEN) {
    return res.status(400).json({ error: `Keep your response under ${FREE_RESPONSE_MAX_LEN} characters.` });
  }

  const questionPrompt = typeof prompt === "string" ? prompt.slice(0, 2000) : "";
  const rubricText = typeof rubric === "string" ? rubric.slice(0, 2000) : "";

  try {
    const feedback = await getFormativeFeedback({ questionPrompt, rubric: rubricText, studentAnswer: trimmedAnswer });
    freeResponseStore.saveResponse({ userId: req.user.id, moduleId, sectionId, answer: trimmedAnswer, feedback });
    const board = freeResponseStore.listAnswersForSection(moduleId, sectionId);
    res.json({ feedback, board });
  } catch (e) {
    console.error("AI feedback error:", e);
    res.status(502).json({ error: "AI feedback is temporarily unavailable. Please try again in a moment." });
  }
});

// ---------- Application open/close windows ----------
// Admin can optionally bound each application kind to a date range (see
// /api/admin/application-window/:kind below). Either bound may be null,
// meaning no restriction on that side.
function windowStatus(window) {
  const now = Date.now();
  if (window.opensAt && now < new Date(window.opensAt).getTime()) return "not-open";
  if (window.closesAt && now > new Date(window.closesAt).getTime()) return "closed";
  return "open";
}

function windowClosedError(kind, status, window) {
  const label = kind === "ta" ? "TA applications" : "Applications";
  if (status === "not-open") return `${label} open ${new Date(window.opensAt).toLocaleString()}.`;
  if (status === "closed") return `${label} closed ${new Date(window.closesAt).toLocaleString()}.`;
  return null;
}

// ---------- Application API (students) ----------
// Questions are visible to any signed-in user (not sensitive); only admins
// can create/edit/delete them (see Admin API below).
app.get("/api/application/questions", requireAuth, (req, res) => {
  res.json({ questions: store.readApplicationQuestions() });
});

app.get("/api/application/me", requireAuth, (req, res) => {
  const progress = store.readProgress(req.user.id);
  const courseComplete = isCourseComplete(progress);
  const window = store.getApplicationWindow("sibrp");
  const status = windowStatus(window);
  res.json({
    courseComplete,
    window,
    windowStatus: status,
    eligible: courseComplete && status === "open",
    application: store.findApplicationByUserId(req.user.id)
  });
});

app.post("/api/application", requireAuth, (req, res) => {
  const progress = store.readProgress(req.user.id);
  if (!isCourseComplete(progress)) {
    return res.status(403).json({ error: "Finish every module before applying." });
  }
  const window = store.getApplicationWindow("sibrp");
  const status = windowStatus(window);
  if (status !== "open") {
    return res.status(403).json({ error: windowClosedError("sibrp", status, window) });
  }
  if (store.findApplicationByUserId(req.user.id)) {
    return res.status(409).json({ error: "You've already submitted an application." });
  }

  const questions = store.readApplicationQuestions();
  if (!questions.length) {
    return res.status(400).json({ error: "There's no application open right now." });
  }

  const answersIn = (req.body && req.body.answers) || {};
  const answers = {};
  for (const q of questions) {
    const answer = String(answersIn[q.id] || "").trim();
    if (!answer) return res.status(400).json({ error: `Please answer: "${q.prompt}"` });
    answers[q.id] = answer;
  }

  const application = store.saveApplication({
    userId: req.user.id,
    name: req.user.name,
    email: req.user.email,
    answers
  });
  res.json({ application });
});

// ---------- TA Application (students) ----------
// Eligibility here is granted per-user by an admin (see /api/admin/set-ta-eligible),
// not tied to course completion — a separate track from the SiBRP application above.
app.get("/api/ta-application/questions", requireAuth, (req, res) => {
  res.json({ questions: store.readApplicationQuestions("ta") });
});

app.get("/api/ta-application/me", requireAuth, (req, res) => {
  const invited = !!req.user.taEligible;
  const window = store.getApplicationWindow("ta");
  const status = windowStatus(window);
  res.json({
    invited,
    window,
    windowStatus: status,
    eligible: invited && status === "open",
    application: store.findApplicationByUserId(req.user.id, "ta")
  });
});

app.post("/api/ta-application", requireAuth, (req, res) => {
  if (!req.user.taEligible) {
    return res.status(403).json({ error: "You haven't been invited to apply for a TA position." });
  }
  const window = store.getApplicationWindow("ta");
  const status = windowStatus(window);
  if (status !== "open") {
    return res.status(403).json({ error: windowClosedError("ta", status, window) });
  }
  if (store.findApplicationByUserId(req.user.id, "ta")) {
    return res.status(409).json({ error: "You've already submitted a TA application." });
  }

  const questions = store.readApplicationQuestions("ta");
  if (!questions.length) {
    return res.status(400).json({ error: "There's no TA application open right now." });
  }

  const answersIn = (req.body && req.body.answers) || {};
  const answers = {};
  for (const q of questions) {
    const answer = String(answersIn[q.id] || "").trim();
    if (!answer) return res.status(400).json({ error: `Please answer: "${q.prompt}"` });
    answers[q.id] = answer;
  }

  const application = store.saveApplication({
    userId: req.user.id,
    name: req.user.name,
    email: req.user.email,
    answers
  }, "ta");
  res.json({ application });
});

// ---------- Speaker Series (optional — links out to YouTube, no hosting) ----------
// Accepts any common YouTube URL shape (or a bare 11-character video ID) and
// pulls out just the video ID; everything else (thumbnail, watch link) is
// derived from that ID rather than stored separately.
function extractYoutubeId(input) {
  const str = String(input || "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function talkWithUrls(talk) {
  return {
    ...talk,
    watchUrl: `https://www.youtube.com/watch?v=${talk.youtubeId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${talk.youtubeId}/hqdefault.jpg`
  };
}

app.get("/api/speaker-talks", requireAuth, (req, res) => {
  res.json({ talks: speakerStore.listTalks().map(talkWithUrls) });
});

app.post("/api/admin/speaker-talks", requireAdmin, (req, res) => {
  const { title, speakerName, description, youtubeUrl } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "Title is required." });
  }
  if (!speakerName || !String(speakerName).trim()) {
    return res.status(400).json({ error: "Speaker name is required." });
  }
  const youtubeId = extractYoutubeId(youtubeUrl);
  if (!youtubeId) {
    return res.status(400).json({ error: "Please enter a valid YouTube link." });
  }

  const talk = speakerStore.addTalk({
    id: crypto.randomUUID(),
    title: String(title).trim(),
    speakerName: String(speakerName).trim(),
    description: description ? String(description).trim() : "",
    youtubeId
  });
  res.json({ talk: talkWithUrls(talk) });
});

app.delete("/api/admin/speaker-talks/:id", requireAdmin, (req, res) => {
  const deleted = speakerStore.deleteTalk(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Talk not found." });
  res.json({ ok: true });
});

// ---------- Beyond SiBRP project stories ----------
const PORTFOLIO_ACCENTS = new Set(["teal", "gold", "cardinal"]);

// Validates the text fields shared by create/update; the photo itself is
// handled separately by multer (req.file) so admins can only ever set image
// to a server-generated upload path, never an arbitrary string.
function parsePortfolioFields(body) {
  const { student, title, year, tag, accent, shortDescription, fullStory, anecdote, link } = body || {};
  if (!student || !String(student).trim()) return { error: "Student name is required." };
  if (!title || !String(title).trim()) return { error: "Project title is required." };
  if (!shortDescription || !String(shortDescription).trim()) return { error: "A short summary is required." };
  const trimmedLink = link ? String(link).trim() : "";
  if (trimmedLink && !/^https?:\/\//i.test(trimmedLink)) {
    return { error: "Link must start with http:// or https://." };
  }
  return {
    fields: {
      student: String(student).trim(),
      title: String(title).trim(),
      year: year ? String(year).trim() : "",
      tag: tag ? String(tag).trim() : "",
      accent: PORTFOLIO_ACCENTS.has(accent) ? accent : "teal",
      shortDescription: String(shortDescription).trim(),
      fullStory: fullStory ? String(fullStory).trim() : "",
      anecdote: anecdote ? String(anecdote).trim() : "",
      link: trimmedLink
    }
  };
}

app.get("/api/portfolio-projects", (req, res) => {
  res.json({ projects: portfolioStore.listProjects() });
});

app.post("/api/admin/portfolio-projects", requireAdmin, portfolioImageUpload.single("image"), (req, res) => {
  const { error, fields } = parsePortfolioFields(req.body);
  if (error) return res.status(400).json({ error });
  if (req.file) fields.image = `assets/img/portfolio/uploads/${req.file.filename}`;
  const project = portfolioStore.addProject(fields);
  res.json({ project });
});

app.put("/api/admin/portfolio-projects/:id", requireAdmin, portfolioImageUpload.single("image"), (req, res) => {
  const existing = portfolioStore.findProjectById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Project not found." });
  const { error, fields } = parsePortfolioFields(req.body);
  if (error) return res.status(400).json({ error });
  if (req.file) fields.image = `assets/img/portfolio/uploads/${req.file.filename}`;
  const project = portfolioStore.updateProject(req.params.id, fields);
  res.json({ project });
});

app.delete("/api/admin/portfolio-projects/:id", requireAdmin, (req, res) => {
  const deleted = portfolioStore.deleteProject(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Project not found." });
  res.json({ ok: true });
});

// ---------- Admin API ----------
app.get("/api/admin/application-questions", requireAdmin, (req, res) => {
  res.json({ questions: store.readApplicationQuestions() });
});

app.post("/api/admin/application-questions", requireAdmin, (req, res) => {
  const { prompt, type } = req.body || {};
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "Question text is required." });
  }
  const question = store.addApplicationQuestion({
    id: crypto.randomUUID(),
    prompt: String(prompt).trim(),
    type: type === "long" ? "long" : "short"
  });
  res.json({ question });
});

app.put("/api/admin/application-questions/:id", requireAdmin, (req, res) => {
  const question = store.updateApplicationQuestion(req.params.id, req.body || {});
  if (!question) return res.status(404).json({ error: "Question not found." });
  res.json({ question });
});

app.delete("/api/admin/application-questions/:id", requireAdmin, (req, res) => {
  store.deleteApplicationQuestion(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/applications", requireAdmin, (req, res) => {
  res.json({
    questions: store.readApplicationQuestions(),
    applications: store.readApplications()
  });
});

function csvEscape(value) {
  let str = value == null ? "" : String(value);
  // Neutralize CSV formula injection: a leading =, +, -, or @ makes Excel/Sheets
  // interpret the cell as a formula. Prefixing with an apostrophe forces text.
  if (/^[=+\-@]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Shared by both the sibrp and ta application exports — same shape, different kind.
function buildApplicationsCsv(kind) {
  const questions = store.readApplicationQuestions(kind);
  const applications = store.readApplications(kind);

  // Column order follows the live question list; any answers left over from
  // since-deleted questions still get a column so no submitted data is lost.
  const questionOrder = questions.map(q => q.id);
  const promptById = {};
  questions.forEach(q => { promptById[q.id] = q.prompt; });
  const seen = new Set(questionOrder);
  applications.forEach(a => {
    Object.keys(a.answers || {}).forEach(qid => {
      if (!seen.has(qid)) {
        seen.add(qid);
        questionOrder.push(qid);
      }
    });
  });

  const headers = ["Name", "Email", "Submitted At", ...questionOrder.map(qid => promptById[qid] || "Question (removed)")];
  const lines = [headers.map(csvEscape).join(",")];
  applications.forEach(a => {
    const row = [
      a.name,
      a.email,
      new Date(a.submittedAt).toLocaleString(),
      ...questionOrder.map(qid => (a.answers || {})[qid] || "")
    ];
    lines.push(row.map(csvEscape).join(","));
  });

  return "﻿" + lines.join("\r\n");
}

app.get("/api/admin/applications/export.csv", requireAdmin, (req, res) => {
  const filename = `synbase-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buildApplicationsCsv("sibrp"));
});

app.post("/api/admin/applications/reset", requireAdmin, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId is required." });
  store.deleteApplication(userId);
  res.json({ ok: true });
});

// ---------- TA application (admin-managed questions, gated by admin-granted eligibility) ----------
app.get("/api/admin/ta-application-questions", requireAdmin, (req, res) => {
  res.json({ questions: store.readApplicationQuestions("ta") });
});

app.post("/api/admin/ta-application-questions", requireAdmin, (req, res) => {
  const { prompt, type } = req.body || {};
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "Question text is required." });
  }
  const question = store.addApplicationQuestion({
    id: crypto.randomUUID(),
    prompt: String(prompt).trim(),
    type: type === "long" ? "long" : "short"
  }, "ta");
  res.json({ question });
});

app.put("/api/admin/ta-application-questions/:id", requireAdmin, (req, res) => {
  const question = store.updateApplicationQuestion(req.params.id, req.body || {});
  if (!question) return res.status(404).json({ error: "Question not found." });
  res.json({ question });
});

app.delete("/api/admin/ta-application-questions/:id", requireAdmin, (req, res) => {
  store.deleteApplicationQuestion(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/ta-applications", requireAdmin, (req, res) => {
  res.json({
    questions: store.readApplicationQuestions("ta"),
    applications: store.readApplications("ta")
  });
});

app.get("/api/admin/ta-applications/export.csv", requireAdmin, (req, res) => {
  const filename = `synbase-ta-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buildApplicationsCsv("ta"));
});

app.post("/api/admin/ta-applications/reset", requireAdmin, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId is required." });
  store.deleteApplication(userId, "ta");
  res.json({ ok: true });
});

app.post("/api/admin/set-ta-eligible", requireAdmin, (req, res) => {
  const { userId, eligible } = req.body || {};
  if (!store.findUserById(userId)) return res.status(400).json({ error: "Unknown userId." });
  store.setTaEligible(userId, !!eligible);
  res.json({ ok: true });
});

const APPLICATION_KINDS = new Set(["sibrp", "ta"]);

app.get("/api/admin/application-window/:kind", requireAdmin, (req, res) => {
  if (!APPLICATION_KINDS.has(req.params.kind)) return res.status(400).json({ error: "Unknown application kind." });
  res.json({ window: store.getApplicationWindow(req.params.kind) });
});

app.post("/api/admin/application-window/:kind", requireAdmin, (req, res) => {
  if (!APPLICATION_KINDS.has(req.params.kind)) return res.status(400).json({ error: "Unknown application kind." });
  const { opensAt, closesAt } = req.body || {};
  const window = store.setApplicationWindow(req.params.kind, { opensAt, closesAt });
  res.json({ window });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = store.listUsers().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: !!u.isAdmin,
    taEligible: !!u.taEligible,
    createdAt: u.createdAt,
    progress: store.readProgress(u.id)
  }));
  res.json({ users });
});

app.post("/api/admin/set-admin", requireAdmin, (req, res) => {
  const { userId, isAdmin } = req.body || {};
  const target = store.findUserById(userId);
  if (!target) return res.status(400).json({ error: "Unknown userId." });
  if (target.id === req.user.id && !isAdmin) {
    return res.status(400).json({ error: "You can't remove your own admin access." });
  }
  store.setUserAdmin(userId, !!isAdmin);
  res.json({ ok: true });
});

app.post("/api/admin/reset-progress", requireAdmin, (req, res) => {
  const { userId } = req.body || {};
  if (!userId || !store.findUserById(userId)) {
    return res.status(400).json({ error: "Unknown userId." });
  }
  store.resetProgress(userId);
  res.json({ ok: true });
});

// ---------- Public landing ----------
// The bare domain shows About (public) instead of the curriculum home, so
// first-time visitors land on marketing content, not a login wall.
app.get("/", (req, res) => res.redirect("/about.html"));

// ---------- Protect the curriculum pages themselves ----------
// Client-side JS already redirects unauthenticated visitors, but this stops
// the HTML from being served at all without a valid session cookie.
const PUBLIC_PATHS = new Set([
  "/login.html", "/signup.html", "/about.html", "/stanford-igem-team.html", "/igem.html", "/beyond-sibrp.html", "/project.html",
  "/forgot-password.html", "/reset-password.html"
]);
const ADMIN_PATHS = new Set(["/admin.html"]);
app.get(/\.html$/, (req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  const user = getUserFromRequest(req);
  if (!user) {
    return res.redirect(`/login.html?next=${encodeURIComponent(req.originalUrl)}`);
  }
  if (ADMIN_PATHS.has(req.path) && !user.isAdmin) {
    return res.redirect("/index.html");
  }
  next();
});

// ---------- Static site ----------
app.use(express.static(path.join(__dirname), { extensions: ["html"] }));

// Multer throws (bad mimetype, file too large) as an error passed to next()
// rather than a normal response — without this handler Express would fall
// back to its default HTML error page instead of the JSON the frontend expects.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || (err && /image/i.test(err.message || ""))) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`SynBase running at http://localhost:${PORT}`);
});
