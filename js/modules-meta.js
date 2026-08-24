// Shared metadata about every module — used by the homepage to render the
// course overview and by each module page to know its own identity/neighbors.
// sectionCount must equal the number of pages in that module's own inline
// data (modules/moduleN.html) — reading pages and practice pages both count.
// href is written relative to index.html, since only the homepage uses it.
const MODULES_META = [
  {
    id: "module0",
    number: 0,
    title: "Introduction to SynBase",
    description: "A short welcome to SynBase — what this curriculum covers, how it's structured, and what completing it unlocks.",
    href: "modules/module0.html",
    sectionCount: 2
  },
  {
    id: "module1",
    number: 1,
    title: "Introduction to iGEM & Bioengineering",
    description: "What Stanford iGEM is, how bioengineering and synthetic biology relate, a brief history of the field, and real examples of synthetic biology's impact.",
    href: "modules/module1.html",
    sectionCount: 12
  },
  {
    id: "module2",
    number: 2,
    title: "Core Concepts in Molecular and Cellular Biology",
    description: "The biology of cells and DNA, engineering applications in molecular biology (with a p53 discussion activity), and how foreign DNA gets inserted into cells.",
    href: "modules/module2.html",
    sectionCount: 38
  }
];
