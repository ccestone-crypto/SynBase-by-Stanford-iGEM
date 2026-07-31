// Metadata store for the optional "Speaker Series" page. Video files live on
// disk under assets/video/speakers/<id>.<ext>; SQLite just tracks the
// title/speaker/description alongside each one so the page can render a list.
const fs = require("fs");
const path = require("path");
const db = require("./db");

const VIDEO_DIR = path.join(__dirname, "..", "assets", "video", "speakers");
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

const insertTalkStmt = db.prepare(`
  INSERT INTO speaker_talks (id, title, speakerName, description, filename, uploadedAt)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const listTalksStmt = db.prepare(`SELECT * FROM speaker_talks ORDER BY uploadedAt DESC`);
const findTalkByIdStmt = db.prepare(`SELECT * FROM speaker_talks WHERE id = ?`);
const deleteTalkStmt = db.prepare(`DELETE FROM speaker_talks WHERE id = ?`);

function listTalks() {
  return listTalksStmt.all();
}

function findTalkById(id) {
  return findTalkByIdStmt.get(id) || null;
}

function addTalk({ id, title, speakerName, description, filename }) {
  const uploadedAt = new Date().toISOString();
  insertTalkStmt.run(id, title, speakerName, description || "", filename, uploadedAt);
  return findTalkById(id);
}

function deleteTalk(id) {
  const talk = findTalkById(id);
  if (!talk) return false;
  deleteTalkStmt.run(id);
  const filePath = path.join(VIDEO_DIR, talk.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
}

module.exports = { VIDEO_DIR, listTalks, findTalkById, addTalk, deleteTalk };
