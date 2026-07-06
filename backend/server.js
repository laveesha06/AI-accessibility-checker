import "dotenv/config";
import express from "express";
import cors from "cors";
import { scanUrl, flattenViolations, computeScore, scoreLabel } from "./scanner.js";
import { explainIssues } from "./explainer.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/scan", async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "Please provide a valid URL, e.g. https://example.com" });
  }

  try {
    console.log(`Scanning ${url}...`);
    const { violations, passesCount, incompleteCount } = await scanUrl(url);

    const issues = flattenViolations(violations);
    const { score, projectedScore } = computeScore(issues);

    let explainedIssues;
    try {
      explainedIssues = await explainIssues(issues);
    } catch (aiErr) {
      console.error("Claude explanation step failed, returning raw issues:", aiErr.message);
      explainedIssues = issues.map((issue) => ({
        ...issue,
        plainExplanation: issue.help,
        suggestedFix: "See helpUrl for guidance.",
      }));
    }

    res.json({
      url,
      score,
      scoreLabel: scoreLabel(score),
      projectedScore,
      totalIssues: issues.length,
      passesCount,
      incompleteCount,
      issues: explainedIssues,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Couldn't scan that site. It may block automated browsers, or the URL may be unreachable.",
      details: err.message,
    });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Scanner backend running on http://localhost:${PORT}`));
