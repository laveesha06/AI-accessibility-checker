import "dotenv/config";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

/**
 * Sends a batch of technical axe-core issues to Claude and asks for
 * plain-English explanations + concrete fixes, in strict JSON.
 *
 * We batch issues together (rather than 1 API call per issue) to keep
 * this fast and cheap.
 */
export async function explainIssues(issues, maxIssues = 15) {
  // Only explain the top N worst issues to control cost/latency;
  // the rest still count toward the score, they just won't get AI writeups.
  const topIssues = issues.slice(0, maxIssues);

  if (topIssues.length === 0) return [];

  const prompt = buildPrompt(topIssues);

  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data.content.find((c) => c.type === "text")?.text || "[]";

  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const explanations = JSON.parse(cleaned);
    return mergeExplanations(topIssues, explanations);
  } catch (err) {
    console.error("Failed to parse Claude response as JSON:", text);
    // Fail gracefully: return issues without AI explanations rather than crashing
    return topIssues.map((issue) => ({
      ...issue,
      plainExplanation: issue.help,
      suggestedFix: "See helpUrl for guidance.",
    }));
  }
}

function buildPrompt(issues) {
  const issueList = issues
    .map(
      (issue, i) =>
        `${i + 1}. id: ${issue.id}\n   impact: ${issue.impact}\n   technical: ${issue.description}\n   element: ${issue.html}`
    )
    .join("\n\n");

  return `You are helping a non-technical website owner understand accessibility problems on their site.

For each numbered issue below, respond with plain-English text that:
1. Explains who is affected and how, in one or two sentences (e.g. "a blind user's screen reader will just say 'image' with no context")
2. Gives a concrete, specific code fix (not generic advice)

Return ONLY a JSON array, no preamble, no markdown fences, in this exact shape:
[
  { "index": 1, "plainExplanation": "...", "suggestedFix": "..." }
]

Issues:
${issueList}`;
}

function mergeExplanations(issues, explanations) {
  return issues.map((issue, i) => {
    const match = explanations.find((e) => e.index === i + 1);
    return {
      ...issue,
      plainExplanation: match?.plainExplanation || issue.help,
      suggestedFix: match?.suggestedFix || "See helpUrl for guidance.",
    };
  });
}
