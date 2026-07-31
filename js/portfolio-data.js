// Shared "Beyond SiBRP" project data — used by both beyond-sibrp.html (the
// card grid) and project.html (the individual story page). EDIT ME: replace
// the placeholder entries with real past-student projects.
//
// Each project supports:
//   id               unique slug, used in project.html?id=<id>
//   student          student name
//   title            project title
//   year, tag        shown as a small badge on the card + detail page
//   accent           "teal" | "gold" | "cardinal" — matches the site's chip colors
//   image            path to a photo/poster — falls back to colored initials if omitted
//   shortDescription 1-2 sentence summary shown on the card and at the top of the story
//   fullStory        the main body paragraph(s) of the story (HTML string)
//   anecdote         a first-person quote from the student, shown as a pull-quote
//   link             optional external URL (writeup, repo, presentation)
const PROJECTS = [
  {
    id: "biosensor-heavy-metal",
    student: "Example Student",
    title: "Engineering a Biosensor for Heavy Metal Detection",
    year: "2025",
    tag: "iGEM Project",
    accent: "teal",
    image: "",
    shortDescription: "Placeholder short summary for the card and story header. Replace with one or two sentences describing what the student built.",
    fullStory: "Placeholder project story. Replace with a few paragraphs describing the problem, what the student built, how it worked, and any results or recognition.",
    anecdote: "Placeholder first-person quote from the student about their experience.",
    link: ""
  },
  {
    id: "diabetic-retinopathy-ai",
    student: "Roseline Bandela",
    title: "AI-Based Screening System for Diabetic Retinopathy",
    year: "2025",
    tag: "Research",
    accent: "gold",
    image: "assets/img/portfolio/bandela-diabetic-retinopathy-poster.jpg",
    shortDescription: "Roseline built an AI-powered diabetic retinopathy screening tool and now leads an effort to bring iGEM and a biomedical engineering lab to McNeese State University.",
    fullStory: "Roseline's project, <em>\"Development of an Artificial Intelligence-Based Screening System for Diabetic Retinopathy in Rural Regions Using the Integration of Convolutional Neural Networks in PyCharm,\"</em> trained a custom CNN model to classify diabetic retinopathy severity from retinal images, aiming to make screening accessible in low-resource settings. She presented her work at the Region V Science Fair, earned a nomination to the Louisiana Science &amp; Engineering Fair (LSEF), and received multiple awards, including the Yale Science &amp; Engineering Association Most Outstanding Exhibit in STEM Award, the Regeneron Biomedical Science Award, the Society for In Vitro Biology Outstanding Achievement Award, and 2nd Place in Biomedical Engineering. Since September 2025, she has been working to bring an iGEM team to McNeese State University focused on synthetic biology, and is building a Bioelectronics &amp; Neural Interfaces Lab where students can work hands-on with biosensors, neural engineering, and AI-driven healthcare technologies.",
    anecdote: "It definitely did. Last year, Bandela's team and Bandela focused on using AI to detect retinoblastoma from fundus retinal images. That experience introduced Bandela to AI applications in healthcare and inspired Bandela to pursue independent research. Following the program, Bandela developed a project titled \"Development of an Artificial Intelligence-Based Screening System for Diabetic Retinopathy in Rural Regions Using the Integration of Convolutional Neural Networks in PyCharm.\" Bandela trained Bandela's own CNN model, wrote a research paper, and presented it at the Region V Science Fair. Bandela has attached the research paper and poster for reference. The project earned a nomination for the Louisiana Science & Engineering Fair (LSEF) and received several awards, including the Yale Science & Engineering Association Most Outstanding Exhibit in STEM Award, the Regeneron Biomedical Science Award, the Society for In Vitro Biology Outstanding Achievement Award, and 2nd Place in Biomedical Engineering. Since September 2025, Bandela has also been working to bring iGEM to McNeese State University to build a team centered around synthetic biology, with an emphasis on the Software & AI, Diagnostics, and Space Innovation Villages. Alongside this, Bandela is developing a Bioelectronics & Neural Interfaces Lab for students to work on hands-on projects involving biosensors, neural engineering, wearable devices, and AI-driven healthcare technologies. This idea was sparked by a session where Melwin talked about biomedical engineering and developing medical devices. From that session, Bandela did more research and eventually came up with the idea to develop a lab. Bandela's team plans to officially launch the lab this year.",
    link: ""
  },
  {
    id: "mrna-delivery-startup",
    student: "Example Student",
    title: "Synthetic Biology Startup Pitch: mRNA Delivery Platform",
    year: "2026",
    tag: "Startup",
    accent: "cardinal",
    image: "",
    shortDescription: "Placeholder short summary for the card and story header. Replace with one or two sentences describing what the student built.",
    fullStory: "Placeholder project story. Replace with a few paragraphs describing the problem, what the student built, how it worked, and any results or recognition.",
    anecdote: "Placeholder first-person quote from the student about their experience.",
    link: ""
  }
];

function findProjectById(id) {
  return PROJECTS.find(p => p.id === id) || null;
}

function initials(name) {
  return name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
