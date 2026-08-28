// Stores each student's latest answer to a free-response reflection question
// and powers the anonymous discussion board built on top of it. One row per
// (user, module, section) — resubmitting overwrites the previous attempt.
const db = require("./db");

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

async function getResponse(userId, moduleId, sectionId) {
  const row = unwrap(await db.from("free_responses")
    .select("answer,updated_at")
    .eq("user_id", userId).eq("module_id", moduleId).eq("section_id", sectionId)
    .maybeSingle());
  return row ? { answer: row.answer, updatedAt: row.updated_at } : null;
}

// Anonymous by design — no userId/name in the result. Shows only the most
// recent handful (most recent first) rather than every response ever posted
// to a section — this board isn't paginated, and a section that's been live
// a while could otherwise return hundreds of entries.
const RECENT_RESPONSE_LIMIT = 3;

async function listAnswersForSection(moduleId, sectionId) {
  const rows = unwrap(await db.from("free_responses")
    .select("answer,updated_at")
    .eq("module_id", moduleId).eq("section_id", sectionId)
    .order("updated_at", { ascending: false })
    .limit(RECENT_RESPONSE_LIMIT));
  return rows.map(r => ({ answer: r.answer, updatedAt: r.updated_at }));
}

async function saveResponse({ userId, moduleId, sectionId, answer }) {
  unwrap(await db.from("free_responses").upsert(
    { user_id: userId, module_id: moduleId, section_id: sectionId, answer, updated_at: new Date().toISOString() },
    { onConflict: "user_id,module_id,section_id" }
  ));
  return getResponse(userId, moduleId, sectionId);
}

module.exports = { getResponse, saveResponse, listAnswersForSection };
