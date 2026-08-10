// Stores each student's latest answer + AI formative feedback for a
// free-response reflection question. One row per (user, module, section) —
// resubmitting overwrites the previous attempt since feedback is ungraded
// practice, not a scored record.
const db = require("./db");

const getStmt = db.prepare(`
  SELECT answer, feedback, updatedAt FROM free_responses
  WHERE userId = ? AND moduleId = ? AND sectionId = ?
`);
const upsertStmt = db.prepare(`
  INSERT INTO free_responses (userId, moduleId, sectionId, answer, feedback, updatedAt)
  VALUES (@userId, @moduleId, @sectionId, @answer, @feedback, @updatedAt)
  ON CONFLICT(userId, moduleId, sectionId) DO UPDATE SET
    answer = excluded.answer,
    feedback = excluded.feedback,
    updatedAt = excluded.updatedAt
`);

function getResponse(userId, moduleId, sectionId) {
  return getStmt.get(userId, moduleId, sectionId) || null;
}

function saveResponse({ userId, moduleId, sectionId, answer, feedback }) {
  const updatedAt = new Date().toISOString();
  upsertStmt.run({ userId, moduleId, sectionId, answer, feedback, updatedAt });
  return getResponse(userId, moduleId, sectionId);
}

module.exports = { getResponse, saveResponse };
