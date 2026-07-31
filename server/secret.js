// Generates (once) and persists a random signing secret for session JWTs, so
// restarting the server doesn't log every student out. Not committed to git.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SECRET_FILE = path.join(__dirname, "data", "session-secret.txt");

function getSessionSecret() {
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, "utf8").trim();
  }
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(SECRET_FILE, secret, "utf8");
  return secret;
}

module.exports = { getSessionSecret };
