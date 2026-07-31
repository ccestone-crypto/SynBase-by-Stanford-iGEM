// Lightweight outline (titles only, no article/quiz bodies) so the homepage
// can list every lesson Khan-Academy-style without loading each module's full
// inline content script. Titles/ids must stay in sync with the section data
// defined inline in modules/moduleN.html.
const COURSE_OUTLINE = {
  module1: [
    { id: "1.1", title: "Cells: The Building Blocks of Life" },
    { id: "1.2", title: "DNA Is Housed Within Cells" },
    { id: "1.3", title: "The Three Domains of Life" },
    { id: "1.4", title: "Model Organisms in Bioengineering" },
    { id: "1.5", title: "Anatomy of a Bacterial Cell" },
    { id: "1.6", title: "Anatomy of a Eukaryotic Cell" },
    { id: "1.7", title: "The Extracellular Matrix" },
    { id: "1.8", title: "The Cell Membrane and the Phospholipid Bilayer" }
  ],
  module2: [
    { id: "2.1", title: "The Central Dogma Overview" },
    { id: "2.2", title: "Nucleotides: Building Blocks of DNA" },
    { id: "2.3", title: "Nucleotides: Building Blocks of RNA" },
    { id: "2.4", title: "Complementary Base-Pairing" },
    { id: "2.5", title: "The Double Helix & Antiparallel Strands" },
    { id: "2.6", title: "Transcription: DNA to RNA" },
    { id: "2.7", title: "mRNA Modifications" },
    { id: "2.8", title: "Where Transcription Happens" },
    { id: "2.9", title: "Amino Acids and Proteins" },
    { id: "2.10", title: "Translation in the Ribosome" },
    { id: "2.11", title: "Reading a Codon Table" },
    { id: "2.12", title: "Summary of Translation" },
    { id: "2.13", title: "Translation Practice Example" }
  ],
  module3: [
    { id: "3.1", title: "Engineering the Central Dogma: An Overview" },
    { id: "3.2", title: "Engineering DNA: From Crops to CRISPR Therapies" },
    { id: "3.3", title: "Engineering RNA: Vaccines and RNA Interference" },
    { id: "3.4", title: "Engineering Proteins: Enzymes, Cell Therapy, and AI" },
    { id: "3.5", title: "Case Study: Visualizing the p53 Tumor-Suppressor Protein" },
    { id: "3.6", title: "CRISPR-Cas9: Editing DNA with Precision" }
  ],
  module4: [
    { id: "4.1", title: "Why Insert Foreign DNA Into Cells?" },
    { id: "4.2", title: "Tools to Deliver Genetic Material Into Cells" },
    { id: "4.3", title: "Stable vs. Transient Expression" },
    { id: "4.4", title: "Plasmids: Easy-to-Insert Circular DNA" },
    { id: "4.5", title: "Real-World Applications: Fluorescence and BioART" }
  ],
  module5: [
    { id: "5.1", title: "Key Takeaways: Cells, DNA, and Synthetic Biology" },
    { id: "5.2", title: "Guest Speaker and What's Next" }
  ]
};
