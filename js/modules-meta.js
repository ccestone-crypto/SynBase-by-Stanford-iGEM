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
    sectionCount: 1
  },
  {
    id: "module1",
    number: 1,
    title: "Introduction to iGEM & Bioengineering",
    description: "What Stanford iGEM is, how bioengineering and synthetic biology relate, a brief history of the field, and real examples of synthetic biology's impact.",
    href: "modules/module1.html",
    sectionCount: 14
  },
  {
    id: "module2",
    number: 2,
    title: "Core Concepts in Molecular and Cellular Biology",
    description: "The biology of cells and DNA, the central dogma of molecular biology, real-world engineering examples across DNA/RNA/protein, and how foreign DNA gets inserted into cells.",
    href: "modules/module2.html",
    sectionCount: 48
  },
  {
    id: "module3",
    number: 3,
    title: "Biodesign and Literature Review",
    description: "How to turn a real-world need into a research question — the Stanford Biodesign process, evaluating and narrowing project ideas, and how to find and evaluate scientific literature.",
    href: "modules/module3.html",
    sectionCount: 35
  },
  {
    id: "module4",
    number: 4,
    title: "Genetic Circuit Design",
    description: "The DNA parts that make up a genetic circuit — promoters, terminators, and translation initiation sequences — plus logic gates, activators, repressors, and feedback loops.",
    href: "modules/module4.html",
    sectionCount: 27
  },
  {
    id: "module5",
    number: 5,
    title: "Plasmid DNA Design",
    description: "How a plasmid's backbone and insert are put together, two ways to physically join DNA fragments (restriction enzyme cloning and Gibson Assembly), and designing a real plasmid in Benchling.",
    href: "modules/module5.html",
    sectionCount: 29
  },
  {
    id: "module6",
    number: 6,
    title: "Experimental Workflows",
    description: "The 8-step wet-lab workflow that takes a designed plasmid from a digital sequence through bacteria to a visible fluorescent result in mammalian cells.",
    href: "modules/module6.html",
    sectionCount: 23
  },
  {
    id: "module7",
    number: 7,
    title: "Entrepreneurship in Bioengineering",
    description: "Finding your unique value proposition, protecting it with intellectual property, the drug development pipeline, and how biotech funding and market-sizing work.",
    href: "modules/module7.html",
    sectionCount: 23
  },
  {
    id: "module8",
    number: 8,
    title: "Ethics and Broader Applications",
    description: "The ethics of synthetic biology — biosafety, biosecurity, and bioethics — through real case studies, plus who actually reviews and funds research.",
    href: "modules/module8.html",
    sectionCount: 32
  }
];
