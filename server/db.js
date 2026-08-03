// Single SQLite database for the whole app. Using better-sqlite3 (synchronous,
// embedded — no separate database server to run) with WAL mode enabled so
// reads never block on writes. Writes to different rows/tables run without
// contention; SQLite only serializes writes that land in the same instant,
// which at this app's scale (progress/application updates, not high-frequency
// events) is not a practical bottleneck.
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "sibrp.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    isAdmin INTEGER NOT NULL DEFAULT 0,
    taEligible INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    resetTokenHash TEXT,
    resetTokenExpiresAt INTEGER
  );

  -- One row per (user, module, section) marked complete. Marking a section
  -- complete is a single atomic upsert — no read-modify-write, so two
  -- concurrent requests for the same user can never clobber each other.
  CREATE TABLE IF NOT EXISTS progress_sections (
    userId TEXT NOT NULL,
    moduleId TEXT NOT NULL,
    sectionId TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (userId, moduleId, sectionId)
  );

  CREATE TABLE IF NOT EXISTS progress_video (
    userId TEXT NOT NULL,
    moduleId TEXT NOT NULL,
    watched INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (userId, moduleId)
  );

  -- "kind" separates independent application tracks (e.g. 'sibrp' course
  -- application vs 'ta' teaching-assistant application) sharing one schema.
  CREATE TABLE IF NOT EXISTS application_questions (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'sibrp',
    prompt TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'short',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    userId TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'sibrp',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    answers TEXT NOT NULL,
    submittedAt TEXT NOT NULL,
    PRIMARY KEY (userId, kind)
  );

  -- Optional open/closes date bounds per application kind. NULL on either
  -- side means no restriction on that bound (e.g. closesAt NULL = stays
  -- open indefinitely once opened).
  CREATE TABLE IF NOT EXISTS application_windows (
    kind TEXT PRIMARY KEY,
    opensAt TEXT,
    closesAt TEXT
  );

  CREATE TABLE IF NOT EXISTS speaker_talks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    speakerName TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    filename TEXT NOT NULL,
    uploadedAt TEXT NOT NULL
  );
`);

// ---------- One-time migrations for databases created before a column existed ----------
// CREATE TABLE IF NOT EXISTS above only applies to brand-new databases; existing
// ones need explicit ALTERs. Each is guarded so it only runs once, ever.
function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}

if (!hasColumn("users", "taEligible")) {
  db.exec(`ALTER TABLE users ADD COLUMN taEligible INTEGER NOT NULL DEFAULT 0`);
}

if (!hasColumn("application_questions", "kind")) {
  db.exec(`ALTER TABLE application_questions ADD COLUMN kind TEXT NOT NULL DEFAULT 'sibrp'`);
}

// applications' primary key needs to become (userId, kind) so one user can hold
// both a sibrp and a ta application — SQLite can't ALTER a primary key, so this
// rebuilds the table when migrating from the old userId-only-PK version.
if (!hasColumn("applications", "kind")) {
  db.exec(`
    ALTER TABLE applications RENAME TO applications_old;
    CREATE TABLE applications (
      userId TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'sibrp',
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      answers TEXT NOT NULL,
      submittedAt TEXT NOT NULL,
      PRIMARY KEY (userId, kind)
    );
    INSERT INTO applications (userId, kind, name, email, answers, submittedAt)
      SELECT userId, 'sibrp', name, email, answers, submittedAt FROM applications_old;
    DROP TABLE applications_old;
  `);
}

module.exports = db;
