// Server-side mirror of each module's real section IDs (see the SECTIONS
// array in modules/moduleN.html). Needed so the server can independently
// verify a student has actually finished the whole course before accepting
// an application, and can reject bogus sectionIds — never trust the client
// for either check. Keep this in sync with modules/moduleN.html.
const MODULE_SECTION_IDS = {
  module0: ["0.1r"],
  module1: ["1.1r", "1.2r", "1.2m", "1.3r", "1.4r", "1.5r", "1.6r"],
  module2: [
    "2.1r","2.2r","2.3r","2.4p","2.5r","2.6r","2.7p","2.8m","2.9r","2.10r",
    "2.11r","2.12p","2.13r","2.14r","2.15r","2.16s","2.17p","2.18r","2.19r","2.20r",
    "2.21p","2.22r","2.23p","2.24r","2.25r","2.26p","2.27o","2.28r","2.29r","2.30p",
    "2.31r","2.32r","2.33p","2.34r","2.35r","2.36r","2.37p","2.38r","2.39p","2.40f",
    "2.41r","2.42r","2.43r","2.44p","2.45r","2.46r","2.47p","2.48m"
  ],
  module3: [
    "3.1r","3.2f","3.3r","3.4r","3.5f","3.6p","3.7f","3.8r","3.9m","3.10r",
    "3.11f","3.12f","3.13f","3.14r","3.15f","3.16r","3.17m","3.18f","3.19r","3.20r",
    "3.21r","3.22m","3.23r","3.24f","3.25f","3.26f","3.27r","3.28p","3.29s","3.30r",
    "3.31p","3.32r","3.33r","3.34o","3.35f"
  ],
  module4: [
    "4.1r","4.2r","4.3r","4.4s","4.5p","4.6p","4.7r","4.8p","4.9r","4.10p",
    "4.11f","4.12r","4.13r","4.14p","4.15p","4.16p","4.17r","4.18r","4.19r","4.20p",
    "4.21r","4.22p","4.23r","4.24p","4.25m","4.26o","4.27f"
  ],
  module5: [
    "5.1r","5.2r","5.3r","5.4r","5.5r","5.6p","5.7r","5.8r","5.9p","5.10r",
    "5.11p","5.12p","5.13r","5.14r","5.15s","5.16p","5.17p","5.18f","5.19r","5.20p",
    "5.21r","5.22r","5.23o","5.24p","5.25r","5.26r","5.27r","5.28m","5.29f"
  ],
  module6: [
    "6.1r","6.2r","6.3r","6.4p","6.5r","6.6p","6.7p","6.8r","6.9r","6.10r",
    "6.11m","6.12p","6.13r","6.14p","6.15r","6.16p","6.17r","6.18s","6.19r","6.20p",
    "6.21p","6.22o","6.23f"
  ],
  module7: [
    "7.1r","7.2r","7.3p","7.4r","7.5f","7.6r","7.7f","7.8r","7.9r","7.10m",
    "7.11r","7.12r","7.13s","7.14r","7.15m","7.16f","7.17r","7.18r","7.19r","7.20o",
    "7.21r","7.22p","7.23f"
  ],
  module8: [
    "8.1r","8.2m","8.3r","8.4m","8.5s","8.6r","8.7p","8.8r","8.9p","8.10r",
    "8.11p","8.12r","8.13p","8.14r","8.15f","8.16r","8.17p","8.18f","8.19r","8.20f",
    "8.21r","8.22r","8.23m","8.24r","8.25r","8.26r","8.27m","8.28r","8.29r","8.30m",
    "8.31r","8.32f"
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
