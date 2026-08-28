// "Beyond SiBRP" project story store, shown on beyond-sibrp.html / project.html
// and managed from the admin dashboard.
const crypto = require("crypto");
const db = require("./db");

const COLUMNS = ["student", "title", "year", "tag", "accent", "image", "shortDescription", "fullStory", "anecdote", "link"];
const COLUMN_TO_DB = {
  student: "student", title: "title", year: "year", tag: "tag", accent: "accent",
  image: "image", shortDescription: "short_description", fullStory: "full_story",
  anecdote: "anecdote", link: "link"
};

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

function rowToProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    student: row.student,
    title: row.title,
    year: row.year,
    tag: row.tag,
    accent: row.accent,
    image: row.image,
    shortDescription: row.short_description,
    fullStory: row.full_story,
    anecdote: row.anecdote,
    link: row.link,
    createdAt: row.created_at
  };
}

function fieldsToRow(fields) {
  const row = {};
  COLUMNS.forEach(c => { row[COLUMN_TO_DB[c]] = fields[c]; });
  return row;
}

async function listProjects() {
  const rows = unwrap(await db.from("portfolio_projects").select("*").order("created_at", { ascending: false }));
  return rows.map(rowToProject);
}

async function findProjectById(id) {
  const row = unwrap(await db.from("portfolio_projects").select("*").eq("id", id).maybeSingle());
  return rowToProject(row);
}

async function addProject(fields) {
  const id = crypto.randomUUID();
  unwrap(await db.from("portfolio_projects").insert({ id, ...fieldsToRow(fields) }));
  return findProjectById(id);
}

async function updateProject(id, fields) {
  const existing = await findProjectById(id);
  if (!existing) return null;
  const merged = {};
  COLUMNS.forEach(c => { merged[c] = fields[c] !== undefined ? fields[c] : existing[c]; });
  unwrap(await db.from("portfolio_projects").update(fieldsToRow(merged)).eq("id", id));
  return findProjectById(id);
}

async function deleteProject(id) {
  const existing = await findProjectById(id);
  if (!existing) return false;
  await db.from("portfolio_projects").delete().eq("id", id);
  return true;
}

module.exports = { listProjects, findProjectById, addProject, updateProject, deleteProject };
