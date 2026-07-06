import puppeteer from "puppeteer";
import { AxePuppeteer } from "@axe-core/puppeteer";

/**
 * Loads a URL in headless Chrome and runs axe-core against it.
 * Returns the raw axe results (violations, passes counts, etc).
 */
export async function scanUrl(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Give the site a reasonable amount of time to load, but don't hang forever
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const axeResults = await new AxePuppeteer(page).analyze();

    return {
      url,
      violations: axeResults.violations,
      passesCount: axeResults.passes.length,
      incompleteCount: axeResults.incomplete.length,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Turns axe's raw violation list into a flat, ranked list of issues
 * that's easier to score and hand to Claude for plain-English explanations.
 */
export function flattenViolations(violations) {
  const impactWeight = { critical: 4, serious: 3, moderate: 2, minor: 1 };

  const issues = [];

  for (const violation of violations) {
    for (const node of violation.nodes) {
      issues.push({
        id: violation.id, // e.g. "image-alt"
        description: violation.description, // technical description
        help: violation.help,
        helpUrl: violation.helpUrl,
        impact: violation.impact || "minor", // critical | serious | moderate | minor
        weight: impactWeight[violation.impact] || 1,
        selector: node.target?.join(", "),
        html: node.html,
        failureSummary: node.failureSummary,
      });
    }
  }

  // Worst issues first
  issues.sort((a, b) => b.weight - a.weight);
  return issues;
}

/**
 * Simple, explainable scoring model:
 * Start at 100, subtract weighted penalty per issue (capped), floor at 0.
 */
export function computeScore(issues) {
  const penaltyPerWeight = { 4: 6, 3: 4, 2: 2, 1: 1 }; // critical costs more than minor
  let score = 100;

  for (const issue of issues) {
    score -= penaltyPerWeight[issue.weight] || 1;
  }

  score = Math.max(0, Math.round(score));

  // Projected score if every current issue were fixed
  const projectedScore = 100;

  return { score, projectedScore };
}

export function scoreLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Poor";
}
