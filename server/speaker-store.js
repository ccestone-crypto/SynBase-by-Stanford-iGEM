// Metadata store for the optional "Speaker Series" page. Talks link out to
// YouTube rather than hosting video files — we only ever store the video ID,
// and derive both the thumbnail image URL and the outbound watch link from it.
const db = require("./db");

const insertTalkStmt = db.prepare(`
  INSERT INTO speaker_talks (id, title, speakerName, description, youtubeId, uploadedAt)
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

function addTalk({ id, title, speakerName, description, youtubeId }) {
  const uploadedAt = new Date().toISOString();
  insertTalkStmt.run(id, title, speakerName, description || "", youtubeId, uploadedAt);
  return findTalkById(id);
}

function deleteTalk(id) {
  const talk = findTalkById(id);
  if (!talk) return false;
  deleteTalkStmt.run(id);
  return true;
}

module.exports = { listTalks, findTalkById, addTalk, deleteTalk };
