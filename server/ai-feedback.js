// Formative (ungraded) feedback for free-response reflection questions.
// Calls Claude with the question + a short grading rubric written by
// whoever authored the module, and asks for encouragement + gaps to close —
// never a score or pass/fail verdict, since this is meant to be resubmitted.
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a supportive teaching assistant for a high-school-level synthetic biology curriculum (Stanford iGEM's SiBRP program). A student has submitted a free-response answer to a reflection question.

Give brief, formative feedback:
- Acknowledge what the student got right.
- Point out any gaps, inaccuracies, or missing detail, using the grading guidance as your reference for what a strong answer covers.
- End with one guiding question or a concrete suggestion for what to add or revise, so the student can improve and resubmit.
- Do not assign a grade, score, letter, or pass/fail verdict of any kind — this is ungraded practice, not an exam.
- Keep it to 3-5 sentences. Encouraging but specific — avoid generic praise with no substance.`;

async function getFormativeFeedback({ questionPrompt, rubric, studentAnswer }) {
  const userMessage = [
    `Question: ${questionPrompt || "(no question text provided)"}`,
    "",
    `Grading guidance for you, the reviewer (do not quote this verbatim to the student): ${rubric || "Use your own judgment based on the question."}`,
    "",
    `Student's answer:`,
    studentAnswer
  ].join("\n");

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }]
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AI feedback was declined by content safety checks.");
  }

  const textBlock = response.content.find(b => b.type === "text");
  return textBlock ? textBlock.text.trim() : "";
}

module.exports = { getFormativeFeedback };
