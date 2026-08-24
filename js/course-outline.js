// Lightweight outline (titles only, no article/quiz bodies) so the homepage
// can list every lesson Khan-Academy-style without loading each module's full
// inline content script. Each topic now maps to two pages inside the module
// (a "read" page and a "check"/practice page — see modules/moduleN.html),
// so each entry carries both page ids. `part` groups topics under the same
// "Part X" heading used inside the module itself; omit it for modules with
// no part grouping. Titles/ids must stay in sync with modules/moduleN.html.
const COURSE_OUTLINE = {
  module0: [
    { title: "Welcome to SynBase", readId: "0.1r", checkId: "0.1c" }
  ],
  module1: [
    { title: "What Is Stanford iGEM?", readId: "1.1r", checkId: "1.1c" },
    { title: "From Biology to Engineering", readId: "1.2r", checkId: "1.2c" },
    { title: "Where Synthetic Biology Fits In", readId: "1.3r", checkId: "1.3c" },
    { title: "A Very Quick History of Synthetic Biology", readId: "1.4r", checkId: "1.4c" },
    { title: "The Many Applications of Synthetic Biology", readId: "1.5r", checkId: "1.5c" },
    { title: "Synthetic Biology Is Only One Part of Bioengineering", readId: "1.6r", checkId: "1.6c" }
  ],
  module2: [
    { part: "Part 1: Biology of Cells", title: "Cells and DNA: An Overview", readId: "c1r", checkId: "c1c" },
    { part: "Part 1: Biology of Cells", title: "The Three Domains of Life", readId: "c2r", checkId: "c2c" },
    { part: "Part 1: Biology of Cells", title: "Model Cell Lines", readId: "c3r", checkId: "c3c" },
    { part: "Part 1: Biology of Cells", title: "Anatomy of a Bacterial Cell", readId: "c4r", checkId: "c4c" },
    { part: "Part 1: Biology of Cells", title: "Anatomy of a Eukaryotic Cell", readId: "c5r", checkId: "c5c" },
    { part: "Part 1: Biology of Cells", title: "Outside the Cell: The ECM and Cell Membrane", readId: "c6r", checkId: "c6c" },

    { part: "Part 2: Exploring DNA", title: "The Central Dogma", readId: "d1r", checkId: "d1c" },
    { part: "Part 2: Exploring DNA", title: "DNA and RNA Bases", readId: "d2r", checkId: "d2c" },
    { part: "Part 2: Exploring DNA", title: "The Double Helix and Antiparallel Strands", readId: "d3r", checkId: "d3c" },
    { part: "Part 2: Exploring DNA", title: "From DNA to mRNA: Leaving the Nucleus", readId: "d4r", checkId: "d4c" },
    { part: "Part 2: Exploring DNA", title: "Translation: Ribosomes, tRNA, and the Codon Table", readId: "d5r", checkId: "d5c" },

    { part: "Part 3: Engineering Applications in Molecular Biology", title: "DNA Engineering Examples", readId: "e1r", checkId: "e1c" },
    { part: "Part 3: Engineering Applications in Molecular Biology", title: "RNA Engineering Examples", readId: "e2r", checkId: "e2c" },
    { part: "Part 3: Engineering Applications in Molecular Biology", title: "Protein Engineering Examples", readId: "e3r", checkId: "e3c" },
    { part: "Part 3: Engineering Applications in Molecular Biology", title: "Discussion: Designing with p53", readId: "e4r", checkId: "e4f" },

    { part: "Part 4: Inserting Foreign DNA Into Cells", title: "Why and How We Edit DNA", readId: "i1r", checkId: "i1c" },
    { part: "Part 4: Inserting Foreign DNA Into Cells", title: "Plasmids: Making DNA Insertable", readId: "i2r", checkId: "i2c" },
    { part: "Part 4: Inserting Foreign DNA Into Cells", title: "Delivery Mechanisms", readId: "i3r", checkId: "i3c" },
    { part: "Part 4: Inserting Foreign DNA Into Cells", title: "Stable vs. Transient Expression", readId: "i4r", checkId: "i4c" }
  ]
};
