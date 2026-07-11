/* =========================================================
   CLEARSIGHT — Results Page
   =========================================================
   Matches the report shape returned by ai_helper.py's get_ai_report(),
   ONCE you've added "severity" to the prompt's JSON schema:

   {
     overall_score: 68,
     projected_score: 95,
     summary: "One sentence summary of the site's accessibility.",
     issues: [
       { code: "image-alt", severity: "high", plain_english: "...", fix: "..." },
       ...
     ]
   }

   severity uses the scanner's own scale: "high" | "medium" | "low"
   (matches SEVERITY_WEIGHTS in ai_helper.py). If an issue has no
   severity field (old data, or teammate hasn't added it yet), it
   falls back to "medium" so the page doesn't break.

   HANDOFF: app3.py renders this page server-side and injects data
   directly via Jinja (see the <script>window.SCAN_DATA = ...</script>
   tag in results.html) — no localStorage needed. This file still
   falls back to localStorage, then MOCK_DATA, so it works standalone
   while testing.
   ========================================================= */

const MOCK_DATA = {
  overall_score: 68,
  projected_score: 95,
  summary:
    "This site is readable overall but has real barriers for screen reader and low-vision users — mainly missing image descriptions and low-contrast text.",
  url: "https://example.com",
  issues: [
    {
      code: "image-alt",
      severity: "high",
      plain_english:
        "Blind and low-vision users on screen readers can't tell what these images show, since they have no alt text.",
      fix: 'Add alt="brief description" to each <img> tag; use alt="" only for purely decorative images.'
    },
    {
      code: "color-contrast",
      severity: "medium",
      plain_english:
        "Low-vision users struggle to read the gray text on the light background — it doesn't meet minimum contrast standards.",
      fix: "Darken the text color or lighten the background until the contrast ratio is at least 4.5:1."
    },
    {
      code: "label",
      severity: "medium",
      plain_english:
        "Screen reader users can't tell what this input field is for, since it has no associated label.",
      fix: '<label for="email">Email</label><input id="email" type="email">'
    },
    {
      code: "meta-description",
      severity: "low",
      plain_english:
        "This doesn't block access directly but affects how assistive tech and search engines summarize the page.",
      fix: 'Add <meta name="description" content="..."> in the <head>.'
    }
  ]
};

const SEVERITY_ORDER = ["high", "medium", "low"];
const SEVERITY_LABEL = { high: "High", medium: "Medium", low: "Low" };
const SEVERITY_VAR = { high: "--critical", medium: "--serious", low: "--minor" };

function loadScanData() {
  if (window.SCAN_DATA) return window.SCAN_DATA;
  try {
    const stored = localStorage.getItem("scanResults");
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn("Couldn't read stored scan results, using mock data.", e);
  }
  return MOCK_DATA;
}

function countBySeverity(issues) {
  const counts = { high: 0, medium: 0, low: 0 };
  issues.forEach((issue) => {
    const level = SEVERITY_ORDER.includes(issue.severity) ? issue.severity : "medium";
    counts[level]++;
  });
  return counts;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderScanBar(counts, total) {
  const bar = document.getElementById("scan-bar");
  if (!bar) return;
  bar.style.display = "";
  if (total === 0) {
    bar.innerHTML = `<div class="scan-bar-seg" style="width:100%; background:#cfe8d6;"></div>`;
    return;
  }
  bar.innerHTML = SEVERITY_ORDER.map((level) => {
    const pct = (counts[level] / total) * 100;
    if (pct === 0) return "";
    return `<div class="scan-bar-seg" style="width:${pct}%; background:var(${SEVERITY_VAR[level]});"></div>`;
  }).join("");
}

function renderLegend(counts) {
  const legend = document.getElementById("scan-legend");
  if (!legend) return;
  legend.style.display = "";
  legend.innerHTML = SEVERITY_ORDER.map(
    (level) => `
      <span class="legend-item">
        <span class="legend-dot" style="background:var(${SEVERITY_VAR[level]});"></span>
        ${SEVERITY_LABEL[level]} (${counts[level]})
      </span>`
  ).join("");
}

function renderIssue(issue) {
  const level = SEVERITY_ORDER.includes(issue.severity) ? issue.severity : "medium";
  return `
    <div class="issue">
      <div class="issue-head">
        <span class="severity-tag" style="background:var(${SEVERITY_VAR[level]}); color:#fff;">${SEVERITY_LABEL[level]}</span>
        <span class="issue-title">${escapeHtml(issue.code || "Issue")}</span>
      </div>
      <p class="issue-explanation">${escapeHtml(issue.plain_english || "")}</p>
      ${
        issue.fix
          ? `<p class="issue-explanation" style="margin-top:6px; font-family: var(--font-mono); font-size:13px; color: var(--accent);">${escapeHtml(issue.fix)}</p>`
          : ""
      }
    </div>
  `;
}

function scoreToColor(score) {
  if (score >= 90) return "var(--minor)";
  if (score >= 70) return "var(--moderate)";
  if (score >= 40) return "var(--serious)";
  return "var(--critical)";
}

function render() {
  const data = loadScanData();
  const issues = data.issues || [];
  const counts = countBySeverity(issues);
  const total = issues.length;
  const score = data.overall_score ?? "—";

  document.getElementById("site-url").textContent = data.url || "";

  const circle = document.getElementById("score-circle");
  circle.textContent = score;
  if (typeof score === "number") {
    circle.style.borderColor = scoreToColor(score);
  }

  document.getElementById("ai-summary").textContent =
    data.summary || "No summary available.";

  renderScanBar(counts, total);
  renderLegend(counts);

  const sortedIssues = [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  document.getElementById("issues-list").innerHTML =
    total === 0
      ? `<div class="empty-state">✓ No accessibility issues found.</div>`
      : sortedIssues.map(renderIssue).join("");
}

document.addEventListener("DOMContentLoaded", render);