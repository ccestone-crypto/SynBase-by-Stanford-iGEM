// Lightweight outline (titles only, no article/quiz bodies) so the homepage
// can list every lesson Khan-Academy-style without loading each module's full
// inline content script. Most topics are just a reading page (readId only);
// a topic only carries a checkId when the module itself has a real practice
// or discussion page for it (see modules/moduleN.html) — the site doesn't
// invent check-your-understanding quizzes beyond what the curriculum source
// actually provides. `part` groups topics under the same "Part X" heading
// used inside the module itself; omit it for modules with no part grouping.
// Titles/ids must stay in sync with modules/moduleN.html.
const COURSE_OUTLINE = {
  module0: [
    { title: "Welcome to SynBase", readId: "0.1r" }
  ],
  module1: [
    { title: "What Is Stanford iGEM?", readId: "1.1r" },
    { title: "From Biology to Engineering", readId: "1.2r", checkId: "1.2m", checkTitle: "Matching Exercise: Biology vs. Engineering" },
    { title: "Where Synthetic Biology Fits In", readId: "1.3r" },
    { title: "A Very Quick History of Synthetic Biology", readId: "1.4r" },
    { title: "The Many Applications of Synthetic Biology", readId: "1.5r" },
    { title: "Synthetic Biology Is Only One Part of Bioengineering", readId: "1.6r" }
  ],
  module2: [
    { part: "Part 1: Biology of Cells", title: "Cells and DNA: An Overview", readId: "c1r" },
    { part: "Part 1: Biology of Cells", title: "The Three Domains of Life", readId: "c2r" },
    { part: "Part 1: Biology of Cells", title: "Model Cell Lines", readId: "c3r" },
    { part: "Part 1: Biology of Cells", title: "Anatomy of a Bacterial Cell", readId: "c4r" },
    { part: "Part 1: Biology of Cells", title: "Anatomy of a Eukaryotic Cell", readId: "c5r" },
    { part: "Part 1: Biology of Cells", title: "Outside the Cell: The ECM and Cell Membrane", readId: "c6r" },

    { part: "Part 2: Exploring DNA", title: "The Central Dogma", readId: "d1r" },
    { part: "Part 2: Exploring DNA", title: "DNA and RNA Bases", readId: "d2r" },
    { part: "Part 2: Exploring DNA", title: "The Double Helix and Antiparallel Strands", readId: "d3r" },
    { part: "Part 2: Exploring DNA", title: "From DNA to mRNA: Leaving the Nucleus", readId: "d4r" },
    { part: "Part 2: Exploring DNA", title: "Translation: Ribosomes, tRNA, and the Codon Table", readId: "d5r" },

    { part: "Part 3: Engineering Applications in Molecular Biology", title: "DNA Engineering Examples", readId: "e1r" },
    { part: "Part 3: Engineering Applications in Molecular Biology", title: "RNA Engineering Examples", readId: "e2r" },
    { part: "Part 3: Engineering Applications in Molecular Biology", title: "Protein Engineering Examples", readId: "e3r" },
    { part: "Part 3: Engineering Applications in Molecular Biology", title: "What Is p53?", readId: "e4r", checkId: "e4f", checkTitle: "Discussion: Designing with p53" },

    { part: "Part 4: Inserting Foreign DNA Into Cells", title: "Why and How We Edit DNA", readId: "i1r" },
    { part: "Part 4: Inserting Foreign DNA Into Cells", title: "Plasmids: Making DNA Insertable", readId: "i2r" },
    { part: "Part 4: Inserting Foreign DNA Into Cells", title: "Delivery Mechanisms", readId: "i3r" },
    { part: "Part 4: Inserting Foreign DNA Into Cells", title: "Stable vs. Transient Expression", readId: "i4r" }
  ]
};
