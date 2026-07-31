// Metadata store for the optional "Speaker Series" page. Video files live on
// disk under assets/video/speakers/<id>.<ext>; this file just tracks the
// title/speaker/description alongside each one so the page can render a list.
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const TALKS_FILE = path.join(DATA_DIR, "speaker-talks.json");
const VIDEO_DIR = path.join(__dirname, "..", "assets", "video", "speakers");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
  if (!fs.existsSync(TALKS_FILE)) fs.writeFileSync(TALKS_FILE, "[]", "utf8");
}
ensureDirs();

function readTalks() {
  try {
    return JSON.parse(fs.readFileSync(TALKS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeTalks(talks) {
  fs.writeFileSync(TALKS_FILE, JSON.stringify(talks, null, 2), "utf8");
}

function listTalks() {
  return readTalks().sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

function findTalkById(id) {
  return readTalks().find(t => t.id === id) || null;
}

function addTalk({ id, title, speakerName, description, filename }) {
  const talks = readTalks();
  const talk = {
    id,
    title,
    speakerName,
    description: description || "",
    filename,
    uploadedAt: new Date().toISOString()
  };
  talks.push(talk);
  writeTalks(talks);
  return talk;
}

function deleteTalk(id) {
  const talk = findTalkById(id);
  if (!talk) return false;
  writeTalks(readTalks().filter(t => t.id !== id));
  const filePath = path.join(VIDEO_DIR, talk.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
}

module.exports = { VIDEO_DIR, listTalks, findTalkById, addTalk, deleteTalk };
