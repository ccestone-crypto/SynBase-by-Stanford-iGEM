// Server-side mirror of js/modules-meta.js's section counts. Needed so the
// server can independently verify a student has actually finished the whole
// course before accepting an application — never trust the client for that.
// Keep MODULE_SECTION_COUNTS in sync with MODULES_META in js/modules-meta.js.
const MODULE_SECTION_COUNTS = {
  module1: 8,
  module2: 13,
  module3: 6,
  module4: 5,
  module5: 2
};

function isModuleComplete(progress, moduleId) {
  const sectionCount = MODULE_SECTION_COUNTS[moduleId];
  const mod = (progress && progress[moduleId]) || { sections: {}, videoWatched: false };
  const completedSections = Object.keys(mod.sections || {}).filter(k => mod.sections[k]).length;
  const total = sectionCount + 1; // +1 for the module's video
  const completed = completedSections + (mod.videoWatched ? 1 : 0);
  return completed >= total;
}

function isCourseComplete(progress) {
  return Object.keys(MODULE_SECTION_COUNTS).every(moduleId => isModuleComplete(progress, moduleId));
}

module.exports = { MODULE_SECTION_COUNTS, isModuleComplete, isCourseComplete };
