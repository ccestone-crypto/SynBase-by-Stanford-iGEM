// Selectable profile-picture options. `id` is what's stored in
// profiles.avatar (see supabase/migrations/0010_profile_avatar.sql) — keep
// these ids stable once shipped, since they're saved data, not just labels.
const AVATARS = [
  { id: "101", file: "ico-101-plasmid-ring.png", label: "Plasmid Ring" },
  { id: "102", file: "ico-102-mitochondrion.png", label: "Mitochondrion" },
  { id: "103", file: "ico-103-gene-cassette.png", label: "Gene Cassette" },
  { id: "104", file: "ico-104-cell-with-plasmid.png", label: "Cell with Plasmid" },
  { id: "105", file: "ico-105-bacteriophage.png", label: "Bacteriophage" },
  { id: "201", file: "ico-201-dna-helix.png", label: "DNA Helix" },
  { id: "203", file: "ico-203-cell-taking-up-dna.png", label: "Cell Taking Up DNA" },
  { id: "204", file: "ico-204-promoter-gene-arrow.png", label: "Promoter Arrow" },
  { id: "205", file: "ico-205-membrane-receptors.png", label: "Membrane Receptors" },
  { id: "206", file: "ico-206-tube.png", label: "Test Tube" },
  { id: "207", file: "ico-207-petri-dish.png", label: "Petri Dish" },
  { id: "208", file: "ico-208-restriction-cut.png", label: "Restriction Cut" },
  { id: "209", file: "ico-209-and-gate.png", label: "AND Gate" },
  { id: "210", file: "ico-210-virus-capsid.png", label: "Virus Capsid" }
];

function avatarUrl(id, fromRoot) {
  const avatar = AVATARS.find(a => a.id === id);
  if (!avatar) return null;
  return `${fromRoot ? "" : "../"}assets/img/profile-pics/${avatar.file}`;
}
