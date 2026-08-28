// Lightweight outline (titles only, no article/quiz bodies) so the homepage
// can list every lesson Khan-Academy-style without loading each module's full
// inline content script. Most topics are just a reading page (readId only);
// a topic only carries a checkId when the module itself has a real practice
// or discussion page for it (see modules/moduleN.html) — the site doesn't
// invent check-your-understanding quizzes beyond what the curriculum source
// actually provides. `part` groups topics under the same "Part X" heading
// used inside the module itself; omit it for modules with no part grouping,
// or for a topic that continues the same part as the previous entry.
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
    { title: "Welcome to Module 2", readId: "2.1r" },
    { part: "Part 1: Biology of Cells", title: "Three Domains of Life", readId: "2.2r" },
    { title: "Cells We Use in Synthetic Biology", readId: "2.3r", checkId: "2.4p", checkTitle: "Domain Properties Check" },
    { title: "Parts of a Bacterial Cell", readId: "2.5r" },
    { title: "Parts of a Eukaryotic Cell", readId: "2.6r", checkId: "2.7p", checkTitle: "DNA Storage Check" },
    { title: "Outside the Cell: The Extracellular Matrix", readId: "2.9r" },
    { title: "The Cell Membrane and Its Proteins", readId: "2.10r" },
    { title: "Like Dissolves Like", readId: "2.11r", checkId: "2.12p", checkTitle: "Membrane Permeability Check" },
    { part: "Part 2: Exploring DNA", title: "The Central Dogma", readId: "2.13r" },
    { title: "The Building Blocks of DNA and RNA", readId: "2.14r" },
    { title: "Base Pairing", readId: "2.15r", checkId: "2.16s", checkTitle: "Base Pairing Recall" },
    { title: "The Double Helix", readId: "2.18r" },
    { title: "Coding vs. Template Strand", readId: "2.19r" },
    { title: "Transcription in Detail", readId: "2.20r", checkId: "2.21p", checkTitle: "Coding Strand Check" },
    { title: "From RNA to mRNA", readId: "2.22r", checkId: "2.23p", checkTitle: "Transcription Fact Check" },
    { title: "Ribosomes and Codons", readId: "2.24r" },
    { title: "Reading a Codon Table", readId: "2.25r", checkId: "2.26p", checkTitle: "Codon Translation Check" },
    { part: "Part 3: Engineering Applications in Molecular Biology", title: "DNA Engineering: Drought-Resistant Wheat", readId: "2.28r" },
    { title: "DNA Engineering: Treating Sickle Cell Disease", readId: "2.29r", checkId: "2.30p", checkTitle: "DNA Engineering Check" },
    { title: "RNA Engineering: mRNA Vaccines", readId: "2.31r" },
    { title: "RNA Engineering: Patisiran", readId: "2.32r", checkId: "2.33p", checkTitle: "RNA Engineering Check" },
    { title: "Protein Engineering: Turning CO2 into Useful Chemicals", readId: "2.34r" },
    { title: "Protein Engineering: CAR-T Therapy", readId: "2.35r" },
    { title: "Protein Engineering: AlphaFold", readId: "2.36r", checkId: "2.37p", checkTitle: "Central Dogma Engineering Recap" },
    { title: "Discussion Prep: p53 and Cancer", readId: "2.38r", checkId: "2.39p", checkTitle: "p53 Mutation Check" },
    { part: "Part 4: Inserting Foreign DNA Into Cells", title: "Editing DNA and Cellular Features", readId: "2.41r" },
    { title: "CRISPR-Cas9", readId: "2.42r" },
    { title: "Why DNA Needs to Be Circular", readId: "2.43r", checkId: "2.44p", checkTitle: "DNA vs. RNA Insertion Check" },
    { title: "Delivery Mechanisms", readId: "2.45r" },
    { title: "Stable vs. Transient Expression", readId: "2.46r", checkId: "2.47p", checkTitle: "Synthetic Biology Fact Check" }
  ],
  module3: [
    { title: "Welcome to Biodesign and Literature Review", readId: "3.1r", checkId: "3.2f", checkTitle: "If You Could Solve Any Problem" },
    { part: "Part 1: The Biodesign Framework", title: "Four Ways to Narrow Down a Need", readId: "3.3r" },
    { title: "Case Study: Osmind and Mental Health", readId: "3.4r", checkId: "3.5f", checkTitle: "Questions About Searching for a Need" },
    { title: "Anatomy of a Need Statement", readId: "3.8r", checkId: "3.9m", checkTitle: "Match the Need Statement Parts" },
    { title: "The Model T: A Reverse-Engineering Exercise", readId: "3.10r", checkId: "3.11f", checkTitle: "Reverse-Engineer the Model T's Need Statement" },
    { part: "Part 2: From Ideas to a Research Direction", title: "Turning Your Ideas Into a Research Direction", readId: "3.14r", checkId: "3.15f", checkTitle: "Idea-Development Worksheet" },
    { title: "Narrowing to Your Top 3: Evaluation Criteria", readId: "3.16r", checkId: "3.17m", checkTitle: "Match Each Criterion to Its Definition" },
    { part: "Part 3: Finding the Literature", title: "From Idea to Evidence", readId: "3.19r" },
    { title: "Reading a Paper Like a Story, Part 1: Abstract, Introduction, Methods", readId: "3.20r" },
    { title: "Reading a Paper Like a Story, Part 2: Results, Discussion, Conclusion", readId: "3.21r", checkId: "3.22m", checkTitle: "Match the Paper Section to Its Story Role" },
    { title: "Two Ways to Find More Papers", readId: "3.23r", checkId: "3.24f", checkTitle: "Responsible AI Use: Scenario 1 — The Missing Data" },
    { part: "Part 4: Evaluating the Literature", title: "Criterion 1: When Was the Paper Written?", readId: "3.27r", checkId: "3.28p", checkTitle: "Evergreen vs. Time-Sensitive" },
    { title: "Criterion 2: Where Is It Published?", readId: "3.30r", checkId: "3.31p", checkTitle: "Peer-Reviewed Journals" },
    { title: "Criterion 3: Why Are You Reading It — and How to Take Notes", readId: "3.32r" },
    { title: "Useful Resources", readId: "3.33r", checkId: "3.34o", checkTitle: "The Biodesign Process, Start to Finish" }
  ],
  module4: [
    { title: "Welcome to Genetic Circuit Design", readId: "4.1r" },
    { part: "Part 1: Components that Determine Transcription", title: "Promoters and Terminators", readId: "4.2r" },
    { title: "Promoter Motifs", readId: "4.3r", checkId: "4.4s", checkTitle: "Quick Recall: The Eukaryotic Promoter Motif" },
    { title: "Terminator Motifs", readId: "4.7r", checkId: "4.8p", checkTitle: "Practice: Plant Terminators" },
    { title: "Promoters and Terminators by Cell Type", readId: "4.9r", checkId: "4.10p", checkTitle: "Practice: True Statements About Promoters" },
    { part: "Part 2: Components that Determine Translation", title: "Start/Stop Codons and the Coding Sequence", readId: "4.12r" },
    { title: "Translation Initiation: Kozak vs. Shine-Dalgarno", readId: "4.13r", checkId: "4.14p", checkTitle: "Practice: Finding the Stop Codon" },
    { part: "Part 3: Logic Gates", title: "What Is a Logic Gate?", readId: "4.17r" },
    { title: "AND-Gates", readId: "4.18r" },
    { title: "OR-Gates", readId: "4.19r", checkId: "4.20p", checkTitle: "Practice: The Arabinose/Rhamnose AND & OR Gate" },
    { part: "Part 4: More Advanced Systems", title: "Activators and Repressors", readId: "4.21r", checkId: "4.22p", checkTitle: "Practice: How Repressors Respond to Their Target Molecule" },
    { title: "Feedback Loops", readId: "4.23r", checkId: "4.24p", checkTitle: "Practice: Positive or Negative Feedback?" }
  ],
  module5: [
    { title: "Welcome to Plasmid Design", readId: "5.1r" },
    { title: "Quick Reminder: Circuit Parts from Module 4", readId: "5.2r" },
    { title: "What You'll Learn Today", readId: "5.3r" },
    { part: "Part 1: Components of a Plasmid", title: "The Two Parts of a Plasmid: Backbone and Insert", readId: "5.4r" },
    { title: "Backbone Components", readId: "5.5r", checkId: "5.6p", checkTitle: "Practice: Backbone Components" },
    { title: "Insert Components", readId: "5.7r" },
    { title: "The Backbone by Cell Type", readId: "5.8r", checkId: "5.9p", checkTitle: "Practice: Designing for Mammalian Cells" },
    { title: "The Insert by Cell Type", readId: "5.10r", checkId: "5.11p", checkTitle: "Practice: Insert Design Check" },
    { title: "Worked Example: The AddGene mCherry Plasmid", readId: "5.13r" },
    { title: "Insert Components in This Plasmid", readId: "5.14r", checkId: "5.15s", checkTitle: "Short Answer: The Origin of Replication" },
    { part: "Part 2: Cloning Methods", title: "Restriction Enzyme Cloning: The Traditional Method", readId: "5.19r", checkId: "5.20p", checkTitle: "Practice: Restriction Cloning vs. Gibson Assembly" },
    { title: "What Is Gibson Assembly?", readId: "5.21r" },
    { title: "The Gibson Assembly Process", readId: "5.22r", checkId: "5.23o", checkTitle: "Ordering: The Gibson Assembly Process" },
    { title: "How Gibson Assembly Changes Plasmid Design", readId: "5.25r" },
    { part: "Part 3: Introduction to Benchling", title: "Creating a Benchling Account", readId: "5.26r" },
    { title: "Navigating Benchling", readId: "5.27r", checkId: "5.28m", checkTitle: "Matching Exercise: Module 5 Vocabulary Recap" }
  ],
  module6: [
    { title: "Welcome to Experimental Workflows", readId: "6.1r" },
    { part: "Part 1: From Plasmid Design to Bacteria", title: "Step 1: Ordering Plasmids on Twist Bioscience", readId: "6.2r" },
    { title: "Step 2: Combining DNA Fragments with Gibson Assembly", readId: "6.3r", checkId: "6.4p", checkTitle: "Gibson Assembly Enzymes" },
    { title: "Step 3: Inserting DNA Into Bacteria (Transformation)", readId: "6.5r", checkId: "6.6p", checkTitle: "Why Competent Cells?" },
    { title: "Step 4: Amplifying an Individual Bacterial Colony (Colony Picking)", readId: "6.8r" },
    { part: "Part 2: Extracting and Verifying DNA", title: "Step 5: Getting DNA Out of Bacteria (Miniprep), Part A", readId: "6.9r" },
    { title: "Step 5: Getting DNA Out of Bacteria (Miniprep), Part B", readId: "6.10r", checkId: "6.11m", checkTitle: "Miniprep Buffer Check-In" },
    { title: "Step 6: Sequencing through Plasmidsaurus", readId: "6.13r", checkId: "6.14p", checkTitle: "Company Pairings" },
    { part: "Part 3: Into Mammalian Cells and Visualizing Results", title: "Step 7: Getting DNA Into Mammalian Cells (Transfection)", readId: "6.15r", checkId: "6.16p", checkTitle: "Result of Transfection" },
    { title: "Step 8: Visualizing Outputs (Fluorescence Microscopy)", readId: "6.17r", checkId: "6.18s", checkTitle: "How Long Until You Check the Microscope?" },
    { title: "Step 8: Measuring Transfection Efficiency", readId: "6.19r", checkId: "6.20p", checkTitle: "Calculate Transfection Efficiency" }
  ],
  module7: [
    { title: "Welcome to Module 7: From Biodesign to Unique Value", readId: "7.1r" },
    { part: "Part 1: Finding Your Unique Value", title: "Assessing the Competitive Landscape", readId: "7.2r", checkId: "7.3p", checkTitle: "Concept Check: Unique Value Proposition" },
    { title: "From Landscape to Pitch", readId: "7.4r", checkId: "7.5f", checkTitle: "A Short Detour for Making an Argument" },
    { title: "Reaching Your Audience", readId: "7.6r", checkId: "7.7f", checkTitle: "Customer Feedback Activity: Let's Ask Some Questions" },
    { part: "Part 2: Protecting Your Idea", title: "Intellectual Property in Synthetic Biology", readId: "7.8r" },
    { title: "Five Types of IP", readId: "7.9r", checkId: "7.10m", checkTitle: "IP Types" },
    { title: "With Great Power...", readId: "7.11r" },
    { part: "Part 3: The Development Pipeline", title: "The Process of Developing a New Therapeutic, Part 1", readId: "7.12r", checkId: "7.13s", checkTitle: "Quick Check: The IND" },
    { title: "The Process of Developing a New Therapeutic, Part 2", readId: "7.14r", checkId: "7.15m", checkTitle: "Development Pipeline Stages" },
    { part: "Part 4: Funding Your Solution", title: "Funding Your Synthetic Biology Solution", readId: "7.17r" },
    { title: "What to Include in Your Pitch", readId: "7.18r" },
    { title: "The Funding Timeline", readId: "7.19r", checkId: "7.20o", checkTitle: "Funding Timeline" },
    { title: "Sizing Your Market", readId: "7.21r", checkId: "7.22p", checkTitle: "Concept Check: TAM/SAM/SOM" }
  ],
  module8: [
    { part: "Part 1: Foundations", title: "Welcome to Ethics and Broader Applications", readId: "8.1r", checkId: "8.2m", checkTitle: "Biosecurity, Biosafety, and Bioethics" },
    { title: "A Framework for Research Ethics", readId: "8.3r", checkId: "8.4m", checkTitle: "The Belmont Report's Three Principles" },
    { part: "Part 2: Case Studies in Human Subjects Research", title: "UK Biobank Data Leaks", readId: "8.6r", checkId: "8.7p", checkTitle: "UK Biobank: Which Principle, and Why?" },
    { title: "Henrietta Lacks and HeLa Cells", readId: "8.8r", checkId: "8.9p", checkTitle: "HeLa Cells: Which Principle(s), and Why?" },
    { title: "The Havasupai Tribe DNA Case", readId: "8.10r", checkId: "8.11p", checkTitle: "Havasupai: Which Principles, and Why?" },
    { title: "Jesse Gelsinger and Gene Therapy", readId: "8.12r", checkId: "8.13p", checkTitle: "Jesse Gelsinger: Which Principles, and Why?" },
    { part: "Part 3: Case Studies Beyond the Individual Participant", title: "Germline Editing: He Jiankui's CRISPR Babies", readId: "8.14r", checkId: "8.15f", checkTitle: "What Makes Germline Editing Different?" },
    { title: "Gain-of-Function Research and H5N1", readId: "8.16r", checkId: "8.17p", checkTitle: "Areas of Concern in Gain-of-Function Research" },
    { title: "Gray Areas: CAR-T Cell Therapy", readId: "8.19r", checkId: "8.20f", checkTitle: "CAR-T: Ethical Gray Areas" },
    { title: "CAR-T: Access and Risk", readId: "8.21r" },
    { part: "Part 4: Oversight and Governance", title: "Who Actually Decides Whether Research Can Happen?", readId: "8.22r", checkId: "8.23m", checkTitle: "Which Committee Reviews Which Research" },
    { title: "Institutional Review Boards", readId: "8.24r" },
    { title: "Institutional Animal Care and Use Committees", readId: "8.25r" },
    { title: "Institutional Biosafety Committees", readId: "8.26r", checkId: "8.27m", checkTitle: "Committees Across a Project's Lifecycle" },
    { title: "FDA Oversight of Clinical Trials", readId: "8.28r" },
    { title: "Who Decides What Research Gets Funded?", readId: "8.29r", checkId: "8.30m", checkTitle: "Other Rules That Shape Research" },
    { part: "Part 5: Conclusion", title: "Putting It All Together", readId: "8.31r", checkId: "8.32f", checkTitle: "Closing Reflection" }
  ]
};
