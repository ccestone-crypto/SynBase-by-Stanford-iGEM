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

  -- Talks link out to YouTube rather than hosting video files — youtubeId is
  -- the 11-character video ID, used to build both the thumbnail image URL
  -- and the outbound watch link.
  CREATE TABLE IF NOT EXISTS speaker_talks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    speakerName TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    youtubeId TEXT NOT NULL,
    uploadedAt TEXT NOT NULL
  );

  -- "Beyond SiBRP" project stories shown on beyond-sibrp.html / project.html.
  -- image is a server-generated relative path (assets/img/portfolio/uploads/...)
  -- written only by the multer upload handler in server.js, never taken
  -- directly from admin-typed text — falls back to colored initials when empty.
  CREATE TABLE IF NOT EXISTS portfolio_projects (
    id TEXT PRIMARY KEY,
    student TEXT NOT NULL,
    title TEXT NOT NULL,
    year TEXT NOT NULL DEFAULT '',
    tag TEXT NOT NULL DEFAULT '',
    accent TEXT NOT NULL DEFAULT 'teal',
    image TEXT NOT NULL DEFAULT '',
    shortDescription TEXT NOT NULL DEFAULT '',
    fullStory TEXT NOT NULL DEFAULT '',
    anecdote TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );

  -- One saved response per (user, module, section) for free-response
  -- reflection questions. feedback is the AI's most recent formative
  -- response — ungraded, so resubmitting just overwrites both fields rather
  -- than keeping a full history.
  CREATE TABLE IF NOT EXISTS free_responses (
    userId TEXT NOT NULL,
    moduleId TEXT NOT NULL,
    sectionId TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    feedback TEXT NOT NULL DEFAULT '',
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (userId, moduleId, sectionId)
  );
`);

// Seed the table that used to be the hardcoded PROJECTS array in
// js/portfolio-data.js, so the real Bandela project isn't lost now that
// projects live in the database and are managed from the admin dashboard.
if (db.prepare("SELECT COUNT(*) c FROM portfolio_projects").get().c === 0) {
  const seedStmt = db.prepare(`
    INSERT INTO portfolio_projects (id, student, title, year, tag, accent, image, shortDescription, fullStory, anecdote, link, createdAt)
    VALUES (@id, @student, @title, @year, @tag, @accent, @image, @shortDescription, @fullStory, @anecdote, @link, @createdAt)
  `);
  const now = new Date().toISOString();
  const seedProjects = [
    {
      id: "diabetic-retinopathy-ai",
      student: "Roseline Bandela",
      title: "AI-Based Screening System for Diabetic Retinopathy",
      year: "2025",
      tag: "Research",
      accent: "gold",
      image: "assets/img/portfolio/bandela-diabetic-retinopathy-poster.jpg",
      shortDescription: "Roseline built an AI-powered diabetic retinopathy screening tool and now leads an effort to bring iGEM and a biomedical engineering lab to McNeese State University.",
      fullStory: "Following SiBRP, Roseline developed a project titled \"Development of an Artificial Intelligence-Based Screening System for Diabetic Retinopathy in Rural Regions Using the Integration of Convolutional Neural Networks in PyCharm.\" Roseline trained her own CNN model, wrote a research paper, and presented it at the Region V Science Fair. The project earned a nomination for the Louisiana Science & Engineering Fair (LSEF) and received several awards, including the Yale Science & Engineering Association Most Outstanding Exhibit in STEM Award, the Regeneron Biomedical Science Award, the Society for In Vitro Biology Outstanding Achievement Award, and 2nd Place in Biomedical Engineering.\n\nSince September 2025, Roseline has also been working to bring iGEM to McNeese State University to build a team centered around synthetic biology, with an emphasis on the Software & AI, Diagnostics, and Space Innovation Villages. Alongside this, Roseline is developing a Bioelectronics & Neural Interfaces Lab for students to work on hands-on projects involving biosensors, neural engineering, wearable devices, and AI-driven healthcare technologies. This idea was sparked by a session where 2025 iGEM team member Melwin talked about biomedical engineering and developing medical devices. From that session, Roseline did more research and eventually came up with the idea to develop a lab. She plans to officially launch the lab this year.",
      anecdote: "Last year, my team and I focused on using AI to detect retinoblastoma from fundus retinal images. That experience introduced me to AI applications in healthcare and inspired me to pursue independent research. Looking back, SiBRP gave me the foundation and confidence to dive into AI, biomedical engineering, and synthetic biology. I would not have started these initiatives without that experience, and it has played a major role in shaping my career path.",
      link: ""
    }
  ];
  seedProjects.forEach(p => seedStmt.run({ ...p, createdAt: now }));
}

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

// speaker_talks moved from hosting an uploaded file (filename column) to
// linking out to YouTube (youtubeId column) — rebuild the table for anyone
// migrating from the old version. Any existing rows can't be backfilled with
// a real video ID, so they're dropped rather than carried over as broken links.
if (hasColumn("speaker_talks", "filename") && !hasColumn("speaker_talks", "youtubeId")) {
  db.exec(`DROP TABLE speaker_talks`);
  db.exec(`
    CREATE TABLE speaker_talks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      speakerName TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      youtubeId TEXT NOT NULL,
      uploadedAt TEXT NOT NULL
    );
  `);
}

module.exports = db;
