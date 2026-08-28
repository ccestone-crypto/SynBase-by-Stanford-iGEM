// Firebase Cloud Functions entry point. Wraps the existing Express app
// unchanged — server.js and everything it requires (Supabase auth, all the
// store modules) works exactly as it does locally or on Render; Firebase
// just runs it inside a Cloud Function instead of a long-lived process.
const { onRequest } = require("firebase-functions/v2/https");
const app = require("./server");

exports.app = onRequest(app);
