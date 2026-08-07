// "Beyond SiBRP" project story store, shown on beyond-sibrp.html / project.html
// and managed from the admin dashboard.
const crypto = require("crypto");
const db = require("./db");

const COLUMNS = ["student", "title", "year", "tag", "accent", "image", "shortDescription", "fullStory", "anecdote", "link"];

const insertStmt = db.prepare(`
  INSERT INTO portfolio_projects (id, student, title, year, tag, accent, image, shortDescription, fullStory, anecdote, link, createdAt)
  VALUES (@id, @student, @title, @year, @tag, @accent, @image, @shortDescription, @fullStory, @anecdote, @link, @createdAt)
`);
const updateStmt = db.prepare(`
  UPDATE portfolio_projects SET
    student = @student, title = @title, year = @year, tag = @tag, accent = @accent,
    image = @image, shortDescription = @shortDescription, fullStory = @fullStory,
    anecdote = @anecdote, link = @link
  WHERE id = @id
`);
const listStmt = db.prepare(`SELECT * FROM portfolio_projects ORDER BY createdAt DESC`);
const findByIdStmt = db.prepare(`SELECT * FROM portfolio_projects WHERE id = ?`);
const deleteStmt = db.prepare(`DELETE FROM portfolio_projects WHERE id = ?`);

function listProjects() {
  return listStmt.all();
}

function findProjectById(id) {
  return findByIdStmt.get(id) || null;
}

function addProject(fields) {
  const id = crypto.randomUUID();
  const row = { id, createdAt: new Date().toISOString() };
  COLUMNS.forEach(c => { row[c] = fields[c] || ""; });
  insertStmt.run(row);
  return findProjectById(id);
}

function updateProject(id, fields) {
  const existing = findProjectById(id);
  if (!existing) return null;
  const row = { id };
  COLUMNS.forEach(c => { row[c] = fields[c] !== undefined ? fields[c] : existing[c]; });
  updateStmt.run(row);
  return findProjectById(id);
}

function deleteProject(id) {
  const existing = findProjectById(id);
  if (!existing) return false;
  deleteStmt.run(id);
  return true;
}

module.exports = { listProjects, findProjectById, addProject, updateProject, deleteProject };
