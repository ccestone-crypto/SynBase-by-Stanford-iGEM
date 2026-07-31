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
const { getSessionSecret } = require("./server/secret");
const { isCourseComplete } = require("./server/course-config");

const SESSION_SECRET = getSessionSecret();
const COOKIE_NAME = "sibrp_session";
const PORT = process.env.PORT || 8420;

// Emails listed here (one per line, in server/data/admin-emails.json) get admin
// access on signup. The very first account ever created is always made an
// admin too, so there's at least one admin on a fresh deploy with an empty list.
const ADMIN_EMAILS_FILE = path.join(__dirname, "server", "data", "admin-emails.json");
function getAdminEmails() {
  try {
    return JSON.parse(fs.readFileSync(ADMIN_EMAILS_FILE, "utf8")).map(e => String(e).trim().toLowerCase());
  } catch (e) {
    return [];
  }
}

const app = express();
app.use(express.json());
app.use(cookieParser());

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

  const isFirstUser = store.countUsers() === 0;
  const isListedAdmin = getAdminEmails().includes(String(email).trim().toLowerCase());

  const passwordHash = bcrypt.hashSync(String(password), 10);
  const user = store.createUser({
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email,
    passwordHash,
    isAdmin: isFirstUser || isListedAdmin
  });

  issueSession(res, user);
  res.json({ user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
});

app.post("/api/login", authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const user = store.findUserByEmail(email);
  if (!user || !bcrypt.compareSync(String(password || ""), user.passwordHash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  issueSession(res, user);
  res.json({ user: { id: user.id, name: user.name, email: user.email, isAdmin: !!user.isAdmin } });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const user = getUserFromRequest(req);
  res.json({ user: user ? { id: user.id, name: user.name, email: user.email, isAdmin: !!user.isAdmin } : null });
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
    subject: "Reset your SiBRP Academy password",
    text: `We received a request to reset your SiBRP Academy password.\n\nReset it here (this link expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`
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

  const progress = store.readProgress(req.user.id);
  if (!progress[moduleId]) progress[moduleId] = { sections: {}, videoWatched: false };
  if (!progress[moduleId].sections) progress[moduleId].sections = {};

  if (sectionId) progress[moduleId].sections[sectionId] = true;
  if (typeof videoWatched === "boolean") progress[moduleId].videoWatched = videoWatched;

  store.writeProgress(req.user.id, progress);
  res.json({ progress });
});

// ---------- Application API (students) ----------
// Questions are visible to any signed-in user (not sensitive); only admins
// can create/edit/delete them (see Admin API below).
app.get("/api/application/questions", requireAuth, (req, res) => {
  res.json({ questions: store.readApplicationQuestions() });
});

app.get("/api/application/me", requireAuth, (req, res) => {
  const progress = store.readProgress(req.user.id);
  res.json({
    eligible: isCourseComplete(progress),
    application: store.findApplicationByUserId(req.user.id)
  });
});

app.post("/api/application", requireAuth, (req, res) => {
  const progress = store.readProgress(req.user.id);
  if (!isCourseComplete(progress)) {
    return res.status(403).json({ error: "Finish every module before applying." });
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

// ---------- Speaker Series (optional — video uploads, no completion gate) ----------
const speakerUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, speakerStore.VIDEO_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".mp4";
      cb(null, `${crypto.randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB per talk
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files can be uploaded."));
    }
    cb(null, true);
  }
});

function talkWithUrl(talk) {
  return { ...talk, url: `/assets/video/speakers/${talk.filename}` };
}

app.get("/api/speaker-talks", requireAuth, (req, res) => {
  res.json({ talks: speakerStore.listTalks().map(talkWithUrl) });
});

app.post("/api/admin/speaker-talks", requireAdmin, (req, res) => {
  speakerUpload.single("video")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Upload failed." });

    const { title, speakerName, description } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "Title is required." });
    }
    if (!speakerName || !String(speakerName).trim()) {
      return res.status(400).json({ error: "Speaker name is required." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Choose a video file to upload." });
    }

    const talk = speakerStore.addTalk({
      id: crypto.randomUUID(),
      title: String(title).trim(),
      speakerName: String(speakerName).trim(),
      description: description ? String(description).trim() : "",
      filename: req.file.filename
    });
    res.json({ talk: talkWithUrl(talk) });
  });
});

app.delete("/api/admin/speaker-talks/:id", requireAdmin, (req, res) => {
  const deleted = speakerStore.deleteTalk(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Talk not found." });
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

app.post("/api/admin/applications/reset", requireAdmin, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId is required." });
  store.deleteApplication(userId);
  res.json({ ok: true });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = store.listUsers().map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: !!u.isAdmin,
    createdAt: u.createdAt,
    progress: store.readProgress(u.id)
  }));
  res.json({ users });
});

app.post("/api/admin/reset-progress", requireAdmin, (req, res) => {
  const { userId } = req.body || {};
  if (!userId || !store.findUserById(userId)) {
    return res.status(400).json({ error: "Unknown userId." });
  }
  store.resetProgress(userId);
  res.json({ ok: true });
});

// ---------- Protect the curriculum pages themselves ----------
// Client-side JS already redirects unauthenticated visitors, but this stops
// the HTML from being served at all without a valid session cookie.
const PUBLIC_PATHS = new Set([
  "/login.html", "/signup.html", "/about.html", "/beyond-sibrp.html", "/project.html",
  "/forgot-password.html", "/reset-password.html"
]);
const ADMIN_PATHS = new Set(["/admin.html"]);
app.get(/\.html$|^\/$/, (req, res, next) => {
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

app.listen(PORT, () => {
  console.log(`SiBRP Academy running at http://localhost:${PORT}`);
});
