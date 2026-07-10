/* =========================================================
   CLEARSIGHT — Results Page (merged card-style version)
   =========================================================
   Expected data shape:

   {
     url: "https://example.com",
     score: 78,
     summary: "One or two sentence AI overview of the site's accessibility.",
     issues: [
       {
         id: "image-alt",
         impact: "critical" | "serious" | "moderate" | "minor",
         description: "Images must have alternate text",
         aiExplanation: "Plain-English explanation + how to fix it."
       },
       ...
     ]
   }

   HANDOFF FROM THE SCAN PAGE:
   Either inject data server-side:
     <script>window.SCAN_DATA = {{ scan_data | tojson }};</script>
   ...or have the scan page do:
     localStorage.setItem("scanResults", JSON.stringify(data));
     window.location.href = "/result";
   This file checks window.SCAN_DATA first, then localStorage,
   then falls back to MOCK_DATA so it works standalone.
   ========================================================= */

const MOCK_DATA = {
  url: "https://example.com",
  score: 68,
  summary:
    "This site is readable overall but has real barriers for screen reader and low-vision users — mainly missing image descriptions and low-contrast text.",
  issues: [
    {
      id: "image-alt",
      impact: "critical",
      description: "Missing image alt text",
      aiExplanation:
        "Three images have no alt text, so screen reader users can't tell what they show. Add a short, descriptive alt attribute to each — use alt=\"\" only for purely decorative images."
    },
    {
      id: "color-contrast",
      impact: "serious",
      description: "Poor color contrast",
      aiExplanation:
        "Gray text on the light background falls below the readable contrast threshold. Darken the text or lighten the background until the contrast ratio is at least 4.5:1."
    },
    {
      id: "meta-description",
      impact: "moderate",
      description: "Missing meta description",
      aiExplanation:
        "There's no meta description tag, which also affects how assistive tech and search engines summarize the page. Add a concise <meta name=\"description\"> in the <head>."
    },
    {
      id: "large-images",
      impact: "minor",
      description: "Large image files",
      aiExplanation:
        "Some images are unnecessarily large, slowing the page down for users on slower connections. Compress them or serve appropriately sized versions."
    }
  ]
};

const SEVERITY_ORDER = ["critical", "serious", "moderate", "minor"];
const SEVERITY_LABEL = {
  critical: "Critical",
  serious: "Serious",
  moderate: "Moderate",
  minor: "Minor"
};

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
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  issues.forEach((issue) => {
    if (counts[issue.impact] !== undefined) counts[issue.impact]++;
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
  if (total === 0) {
    bar.innerHTML = `<div class="scan-bar-seg" style="width:100%; background:#cfe8d6;"></div>`;
    return;
  }
  bar.innerHTML = SEVERITY_ORDER.map((level) => {
    const pct = (counts[level] / total) * 100;
    if (pct === 0) return "";
    return `<div class="scan-bar-seg" style="width:${pct}%; background:var(--${level});"></div>`;
  }).join("");
}

function renderLegend(counts) {
  const legend = document.getElementById("scan-legend");
  legend.innerHTML = SEVERITY_ORDER.map(
    (level) => `
      <span class="legend-item">
        <span class="legend-dot" style="background:var(--${level});"></span>
        ${SEVERITY_LABEL[level]} (${counts[level]})
      </span>`
  ).join("");
}

function renderIssue(issue) {
  const impact = SEVERITY_ORDER.includes(issue.impact) ? issue.impact : "minor";
  return `
    <div class="issue">
      <div class="issue-head">
        <span class="severity-tag ${impact}">${SEVERITY_LABEL[impact]}</span>
        <span class="issue-title">${escapeHtml(issue.description)}</span>
      </div>
      <p class="issue-explanation">${escapeHtml(issue.aiExplanation)}</p>
    </div>
  `;
}

function render() {
  const data = loadScanData();
  const issues = data.issues || [];
  const counts = countBySeverity(issues);
  const total = issues.length;

  document.getElementById("site-url").textContent = data.url || "";
  document.getElementById("score-circle").textContent = data.score ?? "—";
  document.getElementById("ai-summary").textContent =
    data.summary || "No summary available.";

  renderScanBar(counts, total);
  renderLegend(counts);

  const sortedIssues = [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.impact) - SEVERITY_ORDER.indexOf(b.impact)
  );

  document.getElementById("issues-list").innerHTML =
    total === 0
      ? `<div class="empty-state">✓ No accessibility issues found.</div>`
      : sortedIssues.map(renderIssue).join("");
}

document.addEventListener("DOMContentLoaded", render);
