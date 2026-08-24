// Server-side mirror of each module's real section IDs (see the SECTIONS
// array in modules/moduleN.html). Needed so the server can independently
// verify a student has actually finished the whole course before accepting
// an application, and can reject bogus sectionIds — never trust the client
// for either check. Keep this in sync with modules/moduleN.html.
const MODULE_SECTION_IDS = {
  module0: ["0.1r", "0.1c"],
  module1: ["1.1r", "1.1c", "1.2r", "1.2c", "1.3r", "1.3c", "1.4r", "1.4c", "1.5r", "1.5c", "1.6r", "1.6c"],
  module2: [
    "c1r", "c1c", "c2r", "c2c", "c3r", "c3c", "c4r", "c4c", "c5r", "c5c", "c6r", "c6c",
    "d1r", "d1c", "d2r", "d2c", "d3r", "d3c", "d4r", "d4c", "d5r", "d5c",
    "e1r", "e1c", "e2r", "e2c", "e3r", "e3c", "e4r", "e4f",
    "i1r", "i1c", "i2r", "i2c", "i3r", "i3c", "i4r", "i4c"
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
