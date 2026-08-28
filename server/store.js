// Supabase-backed data access. Every exported function name/signature matches
// the old SQLite version exactly (now async, since Supabase calls are all
// network round trips) — server.js's routes just gained `await` in front of
// these calls, nothing else changed about how they're used.
//
// User identity/auth itself (signup, login, password reset) is handled
// directly in server.js via supabase.auth.* — this file only covers the
// `profiles` table (the isAdmin/taEligible/name fields Supabase's own
// auth.users table doesn't have room for) plus all the app's own data.
const db = require("./db");

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Users (profiles table) ----------
function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: !!row.is_admin,
    taEligible: !!row.ta_eligible,
    createdAt: row.created_at
  };
}

async function findUserById(id) {
  if (!id) return null;
  const { data, error } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return rowToUser(data);
}

async function countUsers() {
  const { count, error } = await db.from("profiles").select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count;
}

async function listUsers() {
  const rows = unwrap(await db.from("profiles").select("*").order("created_at", { ascending: true }));
  return rows.map(rowToUser);
}

async function setUserAdmin(userId, isAdmin) {
  unwrap(await db.from("profiles").update({ is_admin: !!isAdmin }).eq("id", userId));
}

async function setTaEligible(userId, eligible) {
  unwrap(await db.from("profiles").update({ ta_eligible: !!eligible }).eq("id", userId));
}

// ---------- Progress ----------
// Each of these is a single atomic upsert/delete — no app-level
// read-modify-write, so two concurrent requests for the same user can never
// clobber each other.
async function markSectionComplete(userId, moduleId, sectionId) {
  unwrap(await db.from("progress_sections").upsert(
    { user_id: userId, module_id: moduleId, section_id: sectionId, completed: true },
    { onConflict: "user_id,module_id,section_id" }
  ));
}

async function setVideoWatched(userId, moduleId, watched) {
  unwrap(await db.from("progress_video").upsert(
    { user_id: userId, module_id: moduleId, watched: !!watched },
    { onConflict: "user_id,module_id" }
  ));
}

// Reconstructs the same { module1: { sections: {...}, videoWatched }, ... }
// shape the rest of the app (and the client) already expects.
async function readProgress(userId) {
  const [sections, videos] = await Promise.all([
    unwrap(await db.from("progress_sections").select("module_id,section_id").eq("user_id", userId)),
    unwrap(await db.from("progress_video").select("module_id,watched").eq("user_id", userId))
  ]);

  const progress = {};
  for (const row of sections) {
    if (!progress[row.module_id]) progress[row.module_id] = { sections: {}, videoWatched: false };
    progress[row.module_id].sections[row.section_id] = true;
  }
  for (const row of videos) {
    if (!progress[row.module_id]) progress[row.module_id] = { sections: {}, videoWatched: false };
    progress[row.module_id].videoWatched = !!row.watched;
  }
  return progress;
}

async function resetProgress(userId) {
  await Promise.all([
    db.from("progress_sections").delete().eq("user_id", userId),
    db.from("progress_video").delete().eq("user_id", userId)
  ]);
}

// ---------- Application questions (admin-managed) ----------
// "kind" separates independent application tracks (e.g. the SiBRP course
// application vs a TA application) that otherwise share this exact schema.
function rowToQuestion(row) {
  return row ? { id: row.id, prompt: row.prompt, type: row.type } : null;
}

async function readApplicationQuestions(kind = "sibrp") {
  const rows = unwrap(await db.from("application_questions")
    .select("id,prompt,type")
    .eq("kind", kind)
    .order("created_at", { ascending: true }));
  return rows.map(rowToQuestion);
}

async function addApplicationQuestion({ id, prompt, type }, kind = "sibrp") {
  unwrap(await db.from("application_questions").insert({
    id, kind, prompt, type: type === "long" ? "long" : "short"
  }));
  const row = unwrap(await db.from("application_questions").select("id,prompt,type").eq("id", id).single());
  return rowToQuestion(row);
}

async function updateApplicationQuestion(id, { prompt, type }) {
  const existing = unwrap(await db.from("application_questions").select("id,prompt,type").eq("id", id).maybeSingle());
  if (!existing) return null;
  const nextPrompt = typeof prompt === "string" ? prompt : existing.prompt;
  const nextType = type ? (type === "long" ? "long" : "short") : existing.type;
  unwrap(await db.from("application_questions").update({ prompt: nextPrompt, type: nextType }).eq("id", id));
  return rowToQuestion({ id, prompt: nextPrompt, type: nextType });
}

async function deleteApplicationQuestion(id) {
  await db.from("application_questions").delete().eq("id", id);
}

// ---------- Applications (student submissions) ----------
function rowToApplication(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    kind: row.kind,
    name: row.name,
    email: row.email,
    answers: row.answers, // jsonb comes back as a real object already
    submittedAt: row.submitted_at
  };
}

async function findApplicationByUserId(userId, kind = "sibrp") {
  const row = unwrap(await db.from("applications").select("*").eq("user_id", userId).eq("kind", kind).maybeSingle());
  return rowToApplication(row);
}

// The primary key on (user_id, kind) makes this atomic: if two submits race,
// the second INSERT fails on the constraint and we just return the first one
// — never two rows, never a lost/duplicated submission. One user can still
// hold one application per kind (e.g. both a sibrp and a ta application).
async function saveApplication({ userId, name, email, answers }, kind = "sibrp") {
  const { error } = await db.from("applications").insert({
    user_id: userId, kind, name, email, answers
  });
  if (error && error.code !== "23505") throw new Error(error.message); // 23505 = unique_violation
  return findApplicationByUserId(userId, kind);
}

async function readApplications(kind = "sibrp") {
  const rows = unwrap(await db.from("applications").select("*").eq("kind", kind).order("submitted_at", { ascending: false }));
  return rows.map(rowToApplication);
}

async function deleteApplication(userId, kind = "sibrp") {
  await db.from("applications").delete().eq("user_id", userId).eq("kind", kind);
}

// ---------- Application open/close windows (admin-managed, per kind) ----------
async function getApplicationWindow(kind = "sibrp") {
  const row = unwrap(await db.from("application_windows").select("opens_at,closes_at").eq("kind", kind).maybeSingle());
  return row ? { opensAt: row.opens_at, closesAt: row.closes_at } : { opensAt: null, closesAt: null };
}

async function setApplicationWindow(kind, { opensAt, closesAt }) {
  unwrap(await db.from("application_windows").upsert(
    { kind, opens_at: opensAt || null, closes_at: closesAt || null },
    { onConflict: "kind" }
  ));
  return getApplicationWindow(kind);
}

module.exports = {
  findUserById,
  countUsers,
  listUsers,
  setUserAdmin,
  setTaEligible,
  readProgress,
  markSectionComplete,
  setVideoWatched,
  resetProgress,
  readApplicationQuestions,
  addApplicationQuestion,
  updateApplicationQuestion,
  deleteApplicationQuestion,
  readApplications,
  findApplicationByUserId,
  saveApplication,
  deleteApplication,
  getApplicationWindow,
  setApplicationWindow
};
