// Metadata store for the optional "Speaker Series" page. Talks link out to
// YouTube rather than hosting video files — we only ever store the video ID,
// and derive both the thumbnail image URL and the outbound watch link from it.
const db = require("./db");

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

function rowToTalk(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    speakerName: row.speaker_name,
    description: row.description,
    youtubeId: row.youtube_id,
    uploadedAt: row.uploaded_at
  };
}

async function listTalks() {
  const rows = unwrap(await db.from("speaker_talks").select("*").order("uploaded_at", { ascending: false }));
  return rows.map(rowToTalk);
}

async function findTalkById(id) {
  const row = unwrap(await db.from("speaker_talks").select("*").eq("id", id).maybeSingle());
  return rowToTalk(row);
}

async function addTalk({ id, title, speakerName, description, youtubeId }) {
  unwrap(await db.from("speaker_talks").insert({
    id, title, speaker_name: speakerName, description: description || "", youtube_id: youtubeId
  }));
  return findTalkById(id);
}

async function deleteTalk(id) {
  const talk = await findTalkById(id);
  if (!talk) return false;
  await db.from("speaker_talks").delete().eq("id", id);
  return true;
}

module.exports = { listTalks, findTalkById, addTalk, deleteTalk };
