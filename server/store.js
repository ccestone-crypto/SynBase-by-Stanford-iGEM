// SQLite-backed data access. Every exported function name/signature matches
// the old flat-file version exactly, so server.js's routes didn't need to
// change (except the progress-write path, which now uses atomic per-field
// upserts instead of read-modify-write — see markSectionComplete/setVideoWatched).
const db = require("./db");

// ---------- Users ----------
const insertUserStmt = db.prepare(`
  INSERT INTO users (id, name, email, passwordHash, isAdmin, createdAt)
  VALUES (@id, @name, @email, @passwordHash, @isAdmin, @createdAt)
`);
const findUserByEmailStmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
const findUserByIdStmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
const countUsersStmt = db.prepare(`SELECT COUNT(*) AS count FROM users`);
const listUsersStmt = db.prepare(`SELECT * FROM users ORDER BY createdAt ASC`);
const setResetTokenStmt = db.prepare(`UPDATE users SET resetTokenHash = ?, resetTokenExpiresAt = ? WHERE id = ?`);
const findUserByResetTokenHashStmt = db.prepare(`SELECT * FROM users WHERE resetTokenHash = ?`);
const clearResetTokenStmt = db.prepare(`UPDATE users SET resetTokenHash = NULL, resetTokenExpiresAt = NULL WHERE id = ?`);
const updatePasswordStmt = db.prepare(`UPDATE users SET passwordHash = ? WHERE id = ?`);

function rowToUser(row) {
  if (!row) return null;
  return { ...row, isAdmin: !!row.isAdmin };
}

function findUserByEmail(email) {
  const norm = String(email || "").trim().toLowerCase();
  return rowToUser(findUserByEmailStmt.get(norm));
}

function findUserById(id) {
  return rowToUser(findUserByIdStmt.get(id));
}

function countUsers() {
  return countUsersStmt.get().count;
}

function listUsers() {
  return listUsersStmt.all().map(rowToUser);
}

// Throws with a UNIQUE-constraint message if the email is already taken —
// callers should check findUserByEmail first for the common case, but this
// stays atomic as a backstop against two simultaneous signups with the same email.
function createUser({ id, name, email, passwordHash, isAdmin }) {
  insertUserStmt.run({
    id,
    name,
    email: String(email).trim().toLowerCase(),
    passwordHash,
    isAdmin: isAdmin ? 1 : 0,
    createdAt: new Date().toISOString()
  });
  return findUserById(id);
}

function setResetToken(userId, tokenHash, expiresAt) {
  setResetTokenStmt.run(tokenHash, expiresAt, userId);
}

function findUserByResetTokenHash(tokenHash) {
  const row = findUserByResetTokenHashStmt.get(tokenHash);
  if (!row) return null;
  if (!row.resetTokenExpiresAt || Date.now() > row.resetTokenExpiresAt) return null;
  return rowToUser(row);
}

function clearResetToken(userId) {
  clearResetTokenStmt.run(userId);
}

function updatePassword(userId, passwordHash) {
  updatePasswordStmt.run(passwordHash, userId);
}

// ---------- Progress ----------
// Each of these is a single atomic statement — no app-level read-modify-write,
// so two concurrent requests (even for the same user) can never clobber each
// other or corrupt data. This is the actual fix for the flat-file race condition.
const upsertSectionStmt = db.prepare(`
  INSERT INTO progress_sections (userId, moduleId, sectionId, completed)
  VALUES (?, ?, ?, 1)
  ON CONFLICT(userId, moduleId, sectionId) DO UPDATE SET completed = 1
`);
const upsertVideoStmt = db.prepare(`
  INSERT INTO progress_video (userId, moduleId, watched)
  VALUES (?, ?, ?)
  ON CONFLICT(userId, moduleId) DO UPDATE SET watched = excluded.watched
`);
const sectionsForUserStmt = db.prepare(`SELECT moduleId, sectionId FROM progress_sections WHERE userId = ?`);
const videoForUserStmt = db.prepare(`SELECT moduleId, watched FROM progress_video WHERE userId = ?`);
const deleteSectionsForUserStmt = db.prepare(`DELETE FROM progress_sections WHERE userId = ?`);
const deleteVideoForUserStmt = db.prepare(`DELETE FROM progress_video WHERE userId = ?`);

function markSectionComplete(userId, moduleId, sectionId) {
  upsertSectionStmt.run(userId, moduleId, sectionId);
}

function setVideoWatched(userId, moduleId, watched) {
  upsertVideoStmt.run(userId, moduleId, watched ? 1 : 0);
}

// Reconstructs the same { module1: { sections: {...}, videoWatched }, ... }
// shape the rest of the app (and the client) already expects.
function readProgress(userId) {
  const progress = {};
  for (const row of sectionsForUserStmt.all(userId)) {
    if (!progress[row.moduleId]) progress[row.moduleId] = { sections: {}, videoWatched: false };
    progress[row.moduleId].sections[row.sectionId] = true;
  }
  for (const row of videoForUserStmt.all(userId)) {
    if (!progress[row.moduleId]) progress[row.moduleId] = { sections: {}, videoWatched: false };
    progress[row.moduleId].videoWatched = !!row.watched;
  }
  return progress;
}

function resetProgress(userId) {
  deleteSectionsForUserStmt.run(userId);
  deleteVideoForUserStmt.run(userId);
}

// ---------- Application questions (admin-managed) ----------
const insertQuestionStmt = db.prepare(`INSERT INTO application_questions (id, prompt, type) VALUES (?, ?, ?)`);
const listQuestionsStmt = db.prepare(`SELECT id, prompt, type FROM application_questions ORDER BY rowid ASC`);
const findQuestionStmt = db.prepare(`SELECT id, prompt, type FROM application_questions WHERE id = ?`);
const updateQuestionStmt = db.prepare(`UPDATE application_questions SET prompt = ?, type = ? WHERE id = ?`);
const deleteQuestionStmt = db.prepare(`DELETE FROM application_questions WHERE id = ?`);

function readApplicationQuestions() {
  return listQuestionsStmt.all();
}

function addApplicationQuestion({ id, prompt, type }) {
  insertQuestionStmt.run(id, prompt, type === "long" ? "long" : "short");
  return findQuestionStmt.get(id);
}

function updateApplicationQuestion(id, { prompt, type }) {
  const existing = findQuestionStmt.get(id);
  if (!existing) return null;
  const nextPrompt = typeof prompt === "string" ? prompt : existing.prompt;
  const nextType = type ? (type === "long" ? "long" : "short") : existing.type;
  updateQuestionStmt.run(nextPrompt, nextType, id);
  return findQuestionStmt.get(id);
}

function deleteApplicationQuestion(id) {
  deleteQuestionStmt.run(id);
}

// ---------- Applications (student submissions) ----------
const insertApplicationStmt = db.prepare(`
  INSERT INTO applications (userId, name, email, answers, submittedAt)
  VALUES (?, ?, ?, ?, ?)
`);
const findApplicationByUserIdStmt = db.prepare(`SELECT * FROM applications WHERE userId = ?`);
const listApplicationsStmt = db.prepare(`SELECT * FROM applications ORDER BY submittedAt DESC`);
const deleteApplicationStmt = db.prepare(`DELETE FROM applications WHERE userId = ?`);

function rowToApplication(row) {
  if (!row) return null;
  return { ...row, answers: JSON.parse(row.answers) };
}

function findApplicationByUserId(userId) {
  return rowToApplication(findApplicationByUserIdStmt.get(userId));
}

// The primary key on userId makes this atomic: if two submits race, the
// second INSERT fails on the constraint and we just return the first one —
// never two rows, never a lost/duplicated submission.
function saveApplication({ userId, name, email, answers }) {
  try {
    insertApplicationStmt.run(userId, name, email, JSON.stringify(answers), new Date().toISOString());
  } catch (e) {
    if (!/UNIQUE constraint failed/.test(e.message)) throw e;
  }
  return findApplicationByUserId(userId);
}

function readApplications() {
  return listApplicationsStmt.all().map(rowToApplication);
}

function deleteApplication(userId) {
  deleteApplicationStmt.run(userId);
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  countUsers,
  listUsers,
  readProgress,
  markSectionComplete,
  setVideoWatched,
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
