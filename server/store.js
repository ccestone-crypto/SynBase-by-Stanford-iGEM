// Tiny flat-file "database" for a small classroom tool — no separate DB engine
// to install. Users live in data/users.json; each user's progress lives in its
// own data/progress/<userId>.json file. All access is synchronous, which is
// fine at this scale (a handful of students, low write frequency).
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PROGRESS_DIR = path.join(DATA_DIR, "progress");
const APPLICATION_QUESTIONS_FILE = path.join(DATA_DIR, "application-questions.json");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PROGRESS_DIR)) fs.mkdirSync(PROGRESS_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]", "utf8");
  if (!fs.existsSync(APPLICATION_QUESTIONS_FILE)) fs.writeFileSync(APPLICATION_QUESTIONS_FILE, "[]", "utf8");
  if (!fs.existsSync(APPLICATIONS_FILE)) fs.writeFileSync(APPLICATIONS_FILE, "[]", "utf8");
}
ensureDirs();

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function findUserByEmail(email) {
  const norm = String(email || "").trim().toLowerCase();
  return readUsers().find(u => u.email === norm) || null;
}

function findUserById(id) {
  return readUsers().find(u => u.id === id) || null;
}

function countUsers() {
  return readUsers().length;
}

function listUsers() {
  return readUsers();
}

function createUser({ id, name, email, passwordHash, isAdmin }) {
  const users = readUsers();
  const user = {
    id,
    name,
    email: String(email).trim().toLowerCase(),
    passwordHash,
    isAdmin: !!isAdmin,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeUsers(users);
  return user;
}

function progressPath(userId) {
  return path.join(PROGRESS_DIR, `${userId}.json`);
}

function readProgress(userId) {
  const file = progressPath(userId);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return {};
  }
}

function writeProgress(userId, progress) {
  fs.writeFileSync(progressPath(userId), JSON.stringify(progress, null, 2), "utf8");
}

function resetProgress(userId) {
  writeProgress(userId, {});
}

// ---------- Password reset tokens ----------
// Only the SHA-256 hash of the reset token is stored (same principle as not
// storing plaintext passwords) — the raw token only ever exists in the email
// link and the incoming request that redeems it.
function setResetToken(userId, tokenHash, expiresAt) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;
  user.resetTokenHash = tokenHash;
  user.resetTokenExpiresAt = expiresAt;
  writeUsers(users);
}

function findUserByResetTokenHash(tokenHash) {
  const user = readUsers().find(u => u.resetTokenHash === tokenHash);
  if (!user) return null;
  if (!user.resetTokenExpiresAt || Date.now() > user.resetTokenExpiresAt) return null;
  return user;
}

function clearResetToken(userId) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;
  delete user.resetTokenHash;
  delete user.resetTokenExpiresAt;
  writeUsers(users);
}

function updatePassword(userId, passwordHash) {
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;
  user.passwordHash = passwordHash;
  writeUsers(users);
}

// ---------- Application questions (admin-managed) ----------
function readApplicationQuestions() {
  try {
    return JSON.parse(fs.readFileSync(APPLICATION_QUESTIONS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeApplicationQuestions(questions) {
  fs.writeFileSync(APPLICATION_QUESTIONS_FILE, JSON.stringify(questions, null, 2), "utf8");
}

function addApplicationQuestion({ id, prompt, type }) {
  const questions = readApplicationQuestions();
  const question = { id, prompt, type: type === "long" ? "long" : "short" };
  questions.push(question);
  writeApplicationQuestions(questions);
  return question;
}

function updateApplicationQuestion(id, { prompt, type }) {
  const questions = readApplicationQuestions();
  const question = questions.find(q => q.id === id);
  if (!question) return null;
  if (typeof prompt === "string") question.prompt = prompt;
  if (type) question.type = type === "long" ? "long" : "short";
  writeApplicationQuestions(questions);
  return question;
}

function deleteApplicationQuestion(id) {
  writeApplicationQuestions(readApplicationQuestions().filter(q => q.id !== id));
}

// ---------- Applications (student submissions) ----------
function readApplications() {
  try {
    return JSON.parse(fs.readFileSync(APPLICATIONS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeApplications(applications) {
  fs.writeFileSync(APPLICATIONS_FILE, JSON.stringify(applications, null, 2), "utf8");
}

function findApplicationByUserId(userId) {
  return readApplications().find(a => a.userId === userId) || null;
}

function saveApplication({ userId, name, email, answers }) {
  const applications = readApplications();
  const existing = applications.find(a => a.userId === userId);
  if (existing) return existing; // one submission per student — see requireNoExistingApplication in server.js
  const application = { userId, name, email, answers, submittedAt: new Date().toISOString() };
  applications.push(application);
  writeApplications(applications);
  return application;
}

function deleteApplication(userId) {
  writeApplications(readApplications().filter(a => a.userId !== userId));
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  countUsers,
  listUsers,
  readProgress,
  writeProgress,
  resetProgress,
  setResetToken,
  findUserByResetTokenHash,
  clearResetToken,
  updatePassword,
  readApplicationQuestions,
  addApplicationQuestion,
  updateApplicationQuestion,
  deleteApplicationQuestion,
  readApplications,
  findApplicationByUserId,
  saveApplication,
  deleteApplication
};
