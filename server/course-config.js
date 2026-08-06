// Server-side mirror of each module's real section IDs (see the SECTIONS
// array in modules/moduleN.html). Needed so the server can independently
// verify a student has actually finished the whole course before accepting
// an application, and can reject bogus sectionIds — never trust the client
// for either check. Keep this in sync with modules/moduleN.html.
const MODULE_SECTION_IDS = {
  module1: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8"],
  module2: ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13"],
  module3: ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"],
  module4: ["4.1", "4.2", "4.3", "4.4", "4.5"],
  module5: ["5.1", "5.2"]
};

function isValidSection(moduleId, sectionId) {
  const ids = MODULE_SECTION_IDS[moduleId];
  return !!ids && ids.includes(sectionId);
}

function isModuleComplete(progress, moduleId) {
  const sectionIds = MODULE_SECTION_IDS[moduleId];
  if (!sectionIds) return false;
  const mod = (progress && progress[moduleId]) || { sections: {}, videoWatched: false };
  const allSectionsDone = sectionIds.every(id => mod.sections && mod.sections[id]);
  return allSectionsDone && !!mod.videoWatched;
}

function isCourseComplete(progress) {
  return Object.keys(MODULE_SECTION_IDS).every(moduleId => isModuleComplete(progress, moduleId));
}

module.exports = { MODULE_SECTION_IDS, isValidSection, isModuleComplete, isCourseComplete };
