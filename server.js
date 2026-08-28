require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const supabase = require("./server/db");
const { freshAuthClient } = require("./server/auth-client");
const store = require("./server/store");
const speakerStore = require("./server/speaker-store");
const portfolioStore = require("./server/portfolio-store");
const freeResponseStore = require("./server/free-response-store");
const { isCourseComplete, isValidSection } = require("./server/course-config");

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

// Express 4 doesn't catch a rejected promise from an async route handler —
// left alone, one thrown error (a network blip talking to Supabase, say)
// crashes the whole Node process instead of just failing that one request.
// Wrapping every handler registered via app.get/post/put/delete here, once,
// means every route added below is automatically protected without having
// to remember a try/catch in each one individually.
function wrapAsync(fn) {
  if (typeof fn !== "function" || fn.constructor.name !== "AsyncFunction") return fn;
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
["get", "post", "put", "delete"].forEach(method => {
  const original = app[method].bind(app);
  app[method] = (path, ...handlers) => original(path, ...handlers.map(wrapAsync));
});

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
// Session = a Supabase access token + refresh token, stored together as one
// JSON cookie. Access tokens are short-lived (~1hr); getUserFromRequest
// transparently refreshes using the refresh token so the 30-day "stay logged
// in" behavior users had before still holds, without a separate signed JWT
// of our own — Supabase Auth is the one issuing and verifying tokens now.
function issueSession(res, session) {
  res.cookie(COOKIE_NAME, JSON.stringify({ at: session.access_token, rt: session.refresh_token }), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

async function getUserFromRequest(req, res) {
  const raw = req.cookies && req.cookies[COOKIE_NAME];
  if (!raw) return null;

  let tokens;
  try {
    tokens = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!tokens || !tokens.at) return null;

  let authUser = null;
  const { data, error } = await freshAuthClient().auth.getUser(tokens.at);
  if (!error && data.user) {
    authUser = data.user;
  } else if (tokens.rt) {
    // Access token expired/invalid — try the refresh token before giving up.
    const { data: refreshed, error: refreshError } = await freshAuthClient().auth.refreshSession({ refresh_token: tokens.rt });
    if (!refreshError && refreshed.session) {
      authUser = refreshed.user;
      if (res) issueSession(res, refreshed.session); // silently rotate the cookie forward
    }
  }
  if (!authUser) return null;

  return store.findUserById(authUser.id);
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromRequest(req, res);
    if (!user) return res.status(401).json({ error: "Not signed in." });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = await getUserFromRequest(req, res);
    if (!user) return res.status(401).json({ error: "Not signed in." });
    if (!user.isAdmin) return res.status(403).json({ error: "Admin access required." });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
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

// Keeps the discussion board from being spammed with rapid resubmissions —
// still comfortably more than a student would hit while genuinely revising
// an answer.
const freeResponsePostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many posts. Please wait a few minutes and try again." }
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
app.post("/api/signup", authLimiter, async (req, res) => {
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

  const normalizedEmail = String(email).trim().toLowerCase();
  const isListedAdmin = getAdminEmails().includes(normalizedEmail);
  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

  const { data, error } = await freshAuthClient().auth.signUp({
    email: normalizedEmail,
    password: String(password),
    options: {
      data: { name: String(name).trim(), is_admin: isListedAdmin },
      emailRedirectTo: `${baseUrl}/confirm-email.html`
    }
  });

  if (error) {
    if (/already registered|already exists|already been registered/i.test(error.message)) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    return res.status(400).json({ error: error.message });
  }

  // "Confirm email" is on for this project — signUp() creates the account but
  // doesn't log them in yet. confirm-email.html finishes the job once they
  // click the link Supabase just emailed them.
  if (!data.session) {
    return res.json({ needsConfirmation: true, message: "Check your email to confirm your account, then log in." });
  }

  issueSession(res, data.session);
  const user = await store.findUserById(data.user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin, taEligible: user.taEligible } });
});

app.post("/api/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const { data, error } = await freshAuthClient().auth.signInWithPassword({
    email: String(email || "").trim().toLowerCase(),
    password: String(password || "")
  });
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return res.status(401).json({ error: "Please confirm your email first — check your inbox for the confirmation link." });
    }
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  if (!data.session) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  issueSession(res, data.session);
  const user = await store.findUserById(data.user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin, taEligible: user.taEligible } });
});

// Finishes the email-confirmation flow: confirm-email.html establishes a
// Supabase session client-side from the link Supabase emailed, then hands us
// those tokens here so we can set our own httpOnly session cookie exactly
// like /api/login does — same server-side session mechanism regardless of
// how the client obtained a valid Supabase session.
app.post("/api/session-from-tokens", authLimiter, async (req, res) => {
  const { access_token, refresh_token } = req.body || {};
  if (!access_token) return res.status(400).json({ error: "Missing session token." });

  const { data, error } = await freshAuthClient().auth.getUser(access_token);
  if (error || !data.user) return res.status(401).json({ error: "That confirmation link is invalid or has expired." });

  issueSession(res, { access_token, refresh_token });
  const user = await store.findUserById(data.user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin, taEligible: user.taEligible } });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  const user = await getUserFromRequest(req, res);
  res.json({ user: user ? { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin, taEligible: user.taEligible } : null });
});

// ---------- Forgot / reset password ----------
// Supabase Auth owns this flow end-to-end: it sends its own reset email (via
// its built-in mailer, or custom SMTP if configured in the Supabase
// dashboard under Authentication > SMTP Settings) with a link that lands the
// browser in a recovery session directly — reset-password.html talks to
// Supabase client-side to finish the job, not through an API route here.
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

  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
  await freshAuthClient().auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${baseUrl}/reset-password.html`
  }).catch(() => {}); // Supabase itself never reveals whether the email exists either

  res.json(genericResponse);
});

// ---------- Progress API ----------
app.get("/api/progress", requireAuth, async (req, res) => {
  res.json({ progress: await store.readProgress(req.user.id) });
});

// Body: { moduleId, sectionId } to mark a section complete,
// or { moduleId, videoWatched } to set the video-watched flag.
app.post("/api/progress", requireAuth, async (req, res) => {
  const { moduleId, sectionId, videoWatched } = req.body || {};
  if (!moduleId) return res.status(400).json({ error: "moduleId is required." });

  if (sectionId) {
    if (!isValidSection(moduleId, sectionId)) {
      return res.status(400).json({ error: "Unknown section." });
    }
    await store.markSectionComplete(req.user.id, moduleId, sectionId);
  }
  if (typeof videoWatched === "boolean") await store.setVideoWatched(req.user.id, moduleId, videoWatched);

  res.json({ progress: await store.readProgress(req.user.id) });
});

// Public — powers the "X learners have completed this curriculum" stat on
// the logged-out curriculum.html page. Only a count is exposed, never who.
app.get("/api/curriculum-stats", async (req, res) => {
  const users = await store.listUsers();
  const progresses = await Promise.all(users.map(u => store.readProgress(u.id)));
  const completedCount = progresses.filter(isCourseComplete).length;
  res.json({ completedCount });
});

// ---------- Free-response discussion board ----------
const FREE_RESPONSE_MAX_LEN = 4000;

// The discussion board (everyone's answers, anonymized) only unlocks once
// the requesting user has submitted their own answer for this section —
// enforced here, not on the client, since the client can't be trusted to
// hide data it was never supposed to receive.
app.get("/api/free-response/:moduleId/:sectionId", requireAuth, async (req, res) => {
  const { moduleId, sectionId } = req.params;
  if (!isValidSection(moduleId, sectionId)) return res.status(400).json({ error: "Unknown section." });
  const response = await freeResponseStore.getResponse(req.user.id, moduleId, sectionId);
  const board = response ? await freeResponseStore.listAnswersForSection(moduleId, sectionId) : [];
  res.json({ response, board });
});

app.post("/api/free-response", requireAuth, freeResponsePostLimiter, async (req, res) => {
  const { moduleId, sectionId, answer } = req.body || {};
  if (!isValidSection(moduleId, sectionId)) return res.status(400).json({ error: "Unknown section." });

  const trimmedAnswer = typeof answer === "string" ? answer.trim() : "";
  if (!trimmedAnswer) return res.status(400).json({ error: "Write a response before posting." });
  if (trimmedAnswer.length > FREE_RESPONSE_MAX_LEN) {
    return res.status(400).json({ error: `Keep your response under ${FREE_RESPONSE_MAX_LEN} characters.` });
  }

  await freeResponseStore.saveResponse({ userId: req.user.id, moduleId, sectionId, answer: trimmedAnswer });
  const board = await freeResponseStore.listAnswersForSection(moduleId, sectionId);
  res.json({ board });
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
app.get("/api/application/questions", requireAuth, async (req, res) => {
  res.json({ questions: await store.readApplicationQuestions() });
});

app.get("/api/application/me", requireAuth, async (req, res) => {
  const progress = await store.readProgress(req.user.id);
  const courseComplete = isCourseComplete(progress);
  const window = await store.getApplicationWindow("sibrp");
  const status = windowStatus(window);
  res.json({
    courseComplete,
    window,
    windowStatus: status,
    eligible: courseComplete && status === "open",
    application: await store.findApplicationByUserId(req.user.id)
  });
});

app.post("/api/application", requireAuth, async (req, res) => {
  const progress = await store.readProgress(req.user.id);
  if (!isCourseComplete(progress)) {
    return res.status(403).json({ error: "Finish every module before applying." });
  }
  const window = await store.getApplicationWindow("sibrp");
  const status = windowStatus(window);
  if (status !== "open") {
    return res.status(403).json({ error: windowClosedError("sibrp", status, window) });
  }
  if (await store.findApplicationByUserId(req.user.id)) {
    return res.status(409).json({ error: "You've already submitted an application." });
  }

  const questions = await store.readApplicationQuestions();
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

  const application = await store.saveApplication({
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
app.get("/api/ta-application/questions", requireAuth, async (req, res) => {
  res.json({ questions: await store.readApplicationQuestions("ta") });
});

app.get("/api/ta-application/me", requireAuth, async (req, res) => {
  const invited = !!req.user.taEligible;
  const window = await store.getApplicationWindow("ta");
  const status = windowStatus(window);
  res.json({
    invited,
    window,
    windowStatus: status,
    eligible: invited && status === "open",
    application: await store.findApplicationByUserId(req.user.id, "ta")
  });
});

app.post("/api/ta-application", requireAuth, async (req, res) => {
  if (!req.user.taEligible) {
    return res.status(403).json({ error: "You haven't been invited to apply for a TA position." });
  }
  const window = await store.getApplicationWindow("ta");
  const status = windowStatus(window);
  if (status !== "open") {
    return res.status(403).json({ error: windowClosedError("ta", status, window) });
  }
  if (await store.findApplicationByUserId(req.user.id, "ta")) {
    return res.status(409).json({ error: "You've already submitted a TA application." });
  }

  const questions = await store.readApplicationQuestions("ta");
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

  const application = await store.saveApplication({
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

app.get("/api/speaker-talks", requireAuth, async (req, res) => {
  res.json({ talks: (await speakerStore.listTalks()).map(talkWithUrls) });
});

app.post("/api/admin/speaker-talks", requireAdmin, async (req, res) => {
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

  const talk = await speakerStore.addTalk({
    id: crypto.randomUUID(),
    title: String(title).trim(),
    speakerName: String(speakerName).trim(),
    description: description ? String(description).trim() : "",
    youtubeId
  });
  res.json({ talk: talkWithUrls(talk) });
});

app.delete("/api/admin/speaker-talks/:id", requireAdmin, async (req, res) => {
  const deleted = await speakerStore.deleteTalk(req.params.id);
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

app.get("/api/portfolio-projects", async (req, res) => {
  res.json({ projects: await portfolioStore.listProjects() });
});

app.post("/api/admin/portfolio-projects", requireAdmin, portfolioImageUpload.single("image"), async (req, res) => {
  const { error, fields } = parsePortfolioFields(req.body);
  if (error) return res.status(400).json({ error });
  if (req.file) fields.image = `assets/img/portfolio/uploads/${req.file.filename}`;
  const project = await portfolioStore.addProject(fields);
  res.json({ project });
});

app.put("/api/admin/portfolio-projects/:id", requireAdmin, portfolioImageUpload.single("image"), async (req, res) => {
  const existing = await portfolioStore.findProjectById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Project not found." });
  const { error, fields } = parsePortfolioFields(req.body);
  if (error) return res.status(400).json({ error });
  if (req.file) fields.image = `assets/img/portfolio/uploads/${req.file.filename}`;
  const project = await portfolioStore.updateProject(req.params.id, fields);
  res.json({ project });
});

app.delete("/api/admin/portfolio-projects/:id", requireAdmin, async (req, res) => {
  const deleted = await portfolioStore.deleteProject(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Project not found." });
  res.json({ ok: true });
});

// ---------- Admin API ----------
app.get("/api/admin/application-questions", requireAdmin, async (req, res) => {
  res.json({ questions: await store.readApplicationQuestions() });
});

app.post("/api/admin/application-questions", requireAdmin, async (req, res) => {
  const { prompt, type } = req.body || {};
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "Question text is required." });
  }
  const question = await store.addApplicationQuestion({
    id: crypto.randomUUID(),
    prompt: String(prompt).trim(),
    type: type === "long" ? "long" : "short"
  });
  res.json({ question });
});

app.put("/api/admin/application-questions/:id", requireAdmin, async (req, res) => {
  const question = await store.updateApplicationQuestion(req.params.id, req.body || {});
  if (!question) return res.status(404).json({ error: "Question not found." });
  res.json({ question });
});

app.delete("/api/admin/application-questions/:id", requireAdmin, async (req, res) => {
  await store.deleteApplicationQuestion(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/applications", requireAdmin, async (req, res) => {
  res.json({
    questions: await store.readApplicationQuestions(),
    applications: await store.readApplications()
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
async function buildApplicationsCsv(kind) {
  const questions = await store.readApplicationQuestions(kind);
  const applications = await store.readApplications(kind);

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

app.get("/api/admin/applications/export.csv", requireAdmin, async (req, res) => {
  const filename = `synbase-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(await buildApplicationsCsv("sibrp"));
});

app.post("/api/admin/applications/reset", requireAdmin, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId is required." });
  await store.deleteApplication(userId);
  res.json({ ok: true });
});

// ---------- TA application (admin-managed questions, gated by admin-granted eligibility) ----------
app.get("/api/admin/ta-application-questions", requireAdmin, async (req, res) => {
  res.json({ questions: await store.readApplicationQuestions("ta") });
});

app.post("/api/admin/ta-application-questions", requireAdmin, async (req, res) => {
  const { prompt, type } = req.body || {};
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "Question text is required." });
  }
  const question = await store.addApplicationQuestion({
    id: crypto.randomUUID(),
    prompt: String(prompt).trim(),
    type: type === "long" ? "long" : "short"
  }, "ta");
  res.json({ question });
});

app.put("/api/admin/ta-application-questions/:id", requireAdmin, async (req, res) => {
  const question = await store.updateApplicationQuestion(req.params.id, req.body || {});
  if (!question) return res.status(404).json({ error: "Question not found." });
  res.json({ question });
});

app.delete("/api/admin/ta-application-questions/:id", requireAdmin, async (req, res) => {
  await store.deleteApplicationQuestion(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/ta-applications", requireAdmin, async (req, res) => {
  res.json({
    questions: await store.readApplicationQuestions("ta"),
    applications: await store.readApplications("ta")
  });
});

app.get("/api/admin/ta-applications/export.csv", requireAdmin, async (req, res) => {
  const filename = `synbase-ta-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(await buildApplicationsCsv("ta"));
});

app.post("/api/admin/ta-applications/reset", requireAdmin, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId is required." });
  await store.deleteApplication(userId, "ta");
  res.json({ ok: true });
});

app.post("/api/admin/set-ta-eligible", requireAdmin, async (req, res) => {
  const { userId, eligible } = req.body || {};
  if (!(await store.findUserById(userId))) return res.status(400).json({ error: "Unknown userId." });
  await store.setTaEligible(userId, !!eligible);
  res.json({ ok: true });
});

const APPLICATION_KINDS = new Set(["sibrp", "ta"]);

app.get("/api/admin/application-window/:kind", requireAdmin, async (req, res) => {
  if (!APPLICATION_KINDS.has(req.params.kind)) return res.status(400).json({ error: "Unknown application kind." });
  res.json({ window: await store.getApplicationWindow(req.params.kind) });
});

app.post("/api/admin/application-window/:kind", requireAdmin, async (req, res) => {
  if (!APPLICATION_KINDS.has(req.params.kind)) return res.status(400).json({ error: "Unknown application kind." });
  const { opensAt, closesAt } = req.body || {};
  const window = await store.setApplicationWindow(req.params.kind, { opensAt, closesAt });
  res.json({ window });
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const rawUsers = await store.listUsers();
  const users = await Promise.all(rawUsers.map(async u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: !!u.isAdmin,
    taEligible: !!u.taEligible,
    createdAt: u.createdAt,
    progress: await store.readProgress(u.id)
  })));
  res.json({ users });
});

app.post("/api/admin/set-admin", requireAdmin, async (req, res) => {
  const { userId, isAdmin } = req.body || {};
  const target = await store.findUserById(userId);
  if (!target) return res.status(400).json({ error: "Unknown userId." });
  if (target.id === req.user.id && !isAdmin) {
    return res.status(400).json({ error: "You can't remove your own admin access." });
  }
  await store.setUserAdmin(userId, !!isAdmin);
  res.json({ ok: true });
});

app.post("/api/admin/reset-progress", requireAdmin, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId || !(await store.findUserById(userId))) {
    return res.status(400).json({ error: "Unknown userId." });
  }
  await store.resetProgress(userId);
  res.json({ ok: true });
});

// ---------- Public landing ----------
// The bare domain shows Home (public) instead of the curriculum home, so
// first-time visitors land on marketing content, not a login wall.
app.get("/", (req, res) => res.redirect("/home.html"));

// ---------- Protect the curriculum pages themselves ----------
// Client-side JS already redirects unauthenticated visitors, but this stops
// the HTML from being served at all without a valid session cookie.
const PUBLIC_PATHS = new Set([
  "/login.html", "/signup.html", "/home.html", "/about.html", "/curriculum.html", "/beyond-sibrp.html", "/project.html",
  "/forgot-password.html", "/reset-password.html", "/confirm-email.html"
]);
const ADMIN_PATHS = new Set(["/admin.html"]);
app.get(/\.html$/, async (req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  let user;
  try {
    user = await getUserFromRequest(req, res);
  } catch (e) {
    return next(e);
  }
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

// Only start a real listener when this file is run directly (`node server.js`
// locally, or on Render) — when required as a module (by index.js, for the
// Firebase Cloud Functions wrapper), Cloud Functions manages the HTTP
// lifecycle itself and just needs the bare Express app.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SynBase running at http://localhost:${PORT}`);
  });
}

module.exports = app;
