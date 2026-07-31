// Shared metadata about every module — used by the homepage to render the
// course overview and by each module page to know its own identity/neighbors.
// Section counts must match the number of sections defined in that module's
// own inline data (modules/moduleN.html) and in course-outline.js.
// href is written relative to index.html, since only the homepage uses it.
const MODULES_META = [
  {
    id: "module1",
    number: 1,
    title: "Biology of Cells",
    description: "Cells as the building blocks of life, the three domains of life, model organisms, and the parts that make up bacterial and eukaryotic cells.",
    href: "modules/module1.html",
    sectionCount: 8
  },
  {
    id: "module2",
    number: 2,
    title: "Biology of DNA",
    description: "The central dogma, nucleotides, complementary base-pairing, transcription, and translation of RNA into protein.",
    href: "modules/module2.html",
    sectionCount: 13
  },
  {
    id: "module3",
    number: 3,
    title: "Engineering Applications in Molecular Biology",
    description: "Real-world bioengineering built on DNA, RNA, and protein engineering, plus a guided p53 protein case study and CRISPR-Cas9.",
    href: "modules/module3.html",
    sectionCount: 6
  },
  {
    id: "module4",
    number: 4,
    title: "Inserting DNA Into Cells",
    description: "How synthetic biology delivers foreign genetic material into cells, stable vs. transient expression, and plasmids.",
    href: "modules/module4.html",
    sectionCount: 5
  },
  {
    id: "module5",
    number: 5,
    title: "Review & Wrap-Up",
    description: "Pulling it all together: a recap of cells, DNA, and synthetic biology, plus what's next in the SiBRP curriculum.",
    href: "modules/module5.html",
    sectionCount: 2
  }
];
