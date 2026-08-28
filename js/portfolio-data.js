// Small shared helpers for beyond-sibrp.html, project.html, and admin.html.
// Project data lives in the portfolio_projects table (publicly readable —
// see supabase/migrations/0002_static_frontend_rls.sql), fetched directly
// via supabaseClient rather than through a server API.
function initials(name) {
  return name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// Postgres columns are snake_case; the rest of the app's markup/JS already
// expects the old API's camelCase shape, so map at the boundary here once.
function rowToPortfolioProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    student: row.student,
    title: row.title,
    year: row.year,
    tag: row.tag,
    accent: row.accent,
    image: row.image,
    shortDescription: row.short_description,
    fullStory: row.full_story,
    anecdote: row.anecdote,
    link: row.link,
    createdAt: row.created_at
  };
}
