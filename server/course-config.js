// Server-side mirror of each module's real section IDs (see the SECTIONS
// array in modules/moduleN.html). Needed so the server can independently
// verify a student has actually finished the whole course before accepting
// an application, and can reject bogus sectionIds — never trust the client
// for either check. Keep this in sync with modules/moduleN.html.
const MODULE_SECTION_IDS = {
  module0: ["0.1r"],
  module1: ["1.1r", "1.2r", "1.2m", "1.3r", "1.4r", "1.5r", "1.6r"],
  module2: [
    "c1r", "c2r", "c3r", "c4r", "c5r", "c6r",
    "d1r", "d2r", "d3r", "d4r", "d5r",
    "e1r", "e2r", "e3r", "e4r", "e4f",
    "i1r", "i2r", "i3r", "i4r"
  ]
};

function isValidSection(moduleId, sectionId) {
  const ids = MODULE_SECTION_IDS[moduleId];
  return !!ids && ids.includes(sectionId);
}

function isModuleComplete(progress, moduleId) {
  const sectionIds = MODULE_SECTION_IDS[moduleId];
  if (!sectionIds) return false;
  const mod = (progress && progress[moduleId]) || { sections: {} };
  return sectionIds.every(id => mod.sections && mod.sections[id]);
}

function isCourseComplete(progress) {
  const moduleIds = Object.keys(MODULE_SECTION_IDS);
  if (!moduleIds.length) return false;
  return moduleIds.every(moduleId => isModuleComplete(progress, moduleId));
}

module.exports = { MODULE_SECTION_IDS, isValidSection, isModuleComplete, isCourseComplete };
