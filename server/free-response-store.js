// Stores each student's latest answer to a free-response reflection question
// and powers the anonymous discussion board built on top of it. One row per
// (user, module, section) — resubmitting overwrites the previous attempt.
const db = require("./db");

const getStmt = db.prepare(`
  SELECT answer, updatedAt FROM free_responses
  WHERE userId = ? AND moduleId = ? AND sectionId = ?
`);
// Anonymous by design — no userId/name in the result. Ordered chronologically
// like a discussion thread; capped defensively since this is unpaginated.
const listForSectionStmt = db.prepare(`
  SELECT answer, updatedAt FROM free_responses
  WHERE moduleId = ? AND sectionId = ?
  ORDER BY updatedAt ASC
  LIMIT 200
`);
const upsertStmt = db.prepare(`
  INSERT INTO free_responses (userId, moduleId, sectionId, answer, updatedAt)
  VALUES (@userId, @moduleId, @sectionId, @answer, @updatedAt)
  ON CONFLICT(userId, moduleId, sectionId) DO UPDATE SET
    answer = excluded.answer,
    updatedAt = excluded.updatedAt
`);

function getResponse(userId, moduleId, sectionId) {
  return getStmt.get(userId, moduleId, sectionId) || null;
}

function listAnswersForSection(moduleId, sectionId) {
  return listForSectionStmt.all(moduleId, sectionId);
}

function saveResponse({ userId, moduleId, sectionId, answer }) {
  const updatedAt = new Date().toISOString();
  upsertStmt.run({ userId, moduleId, sectionId, answer, updatedAt });
  return getResponse(userId, moduleId, sectionId);
}

module.exports = { getResponse, saveResponse, listAnswersForSection };
