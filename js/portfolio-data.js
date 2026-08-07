// Small shared helper for beyond-sibrp.html and project.html. Project data
// itself now lives in the database (server/portfolio-store.js) and is
// managed from the admin dashboard — see /api/portfolio-projects.
function initials(name) {
  return name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
