import { useState } from "react";

const IMPACT_STYLES = {
  critical: { label: "Critical", bg: "bg-signal", text: "text-paper" },
  serious: { label: "Serious", bg: "bg-signal/80", text: "text-paper" },
  moderate: { label: "Moderate", bg: "bg-amber", text: "text-ink" },
  minor: { label: "Minor", bg: "bg-ink/20", text: "text-ink" },
};

function ScoreTag({ score, label, projectedScore }) {
  const tone =
    score >= 90 ? "border-moss text-moss" : score >= 50 ? "border-amber text-amber" : "border-signal text-signal";

  return (
    <div className="flex items-start gap-4">
      <div className={`relative border-2 ${tone} bg-paper px-6 py-4 font-serif`}>
        <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#F5F1E6] border-2 border-inherit" />
        <div className="text-5xl font-bold leading-none">{score}</div>
        <div className="mt-1 text-sm uppercase tracking-wide">{label}</div>
      </div>
      {score < 90 && (
        <p className="mt-2 max-w-[16rem] text-sm text-ink/70">
          Could reach <span className="font-semibold text-moss">{projectedScore}</span> if every issue below is fixed.
        </p>
      )}
    </div>
  );
}

function ContrastDemo({ before, after }) {
  const [fixed, setFixed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFixed((f) => !f)}
      className="rounded border border-ink/20 px-3 py-2 text-left text-sm transition-colors"
      style={{ backgroundColor: fixed ? after.bg : before.bg, color: fixed ? after.fg : before.fg }}
    >
      Sample text — {fixed ? "fixed contrast" : "current contrast"} (tap to toggle)
    </button>
  );
}

function IssueCard({ issue }) {
  const impact = IMPACT_STYLES[issue.impact] || IMPACT_STYLES.minor;
  return (
    <li className="rounded-lg border border-ink/15 bg-white/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-lg font-semibold">{issue.help}</h3>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase ${impact.bg} ${impact.text}`}>
          {impact.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink/90">{issue.plainExplanation}</p>

      <div className="mt-3 rounded bg-ink/5 p-3 font-mono text-xs">
        <div className="text-ink/50">element</div>
        <div className="break-all">{issue.selector}</div>
      </div>

      <p className="mt-3 text-sm">
        <span className="font-semibold text-moss">Fix: </span>
        {issue.suggestedFix}
      </p>

      {issue.id === "color-contrast" && (
        <div className="mt-3">
          <ContrastDemo
            before={{ bg: "#F5F1E6", fg: "#B8AF9A" }}
            after={{ bg: "#F5F1E6", fg: "#16211D" }}
          />
        </div>
      )}

      <a
        href={issue.helpUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-xs text-ink/50 underline underline-offset-2"
      >
        Learn more about this rule
      </a>
    </li>
  );
}

export default function App() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.");
        setStatus("error");
        return;
      }

      setResult(data);
      setStatus("done");
    } catch (err) {
      setErrorMsg("Couldn't reach the scanner. Is the backend running?");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b border-ink/15 px-6 py-8 sm:px-10">
        <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Accessibility inspection</p>
        <h1 className="mt-1 font-serif text-4xl font-bold">Clearsight</h1>
        <p className="mt-2 max-w-xl text-ink/70">
          Enter a website. We'll check color contrast, screen-reader support, and keyboard access — then explain
          every problem in plain language, with a fix.
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-10">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="url-input" className="sr-only">
            Website URL
          </label>
          <input
            id="url-input"
            type="url"
            required
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 rounded border border-ink/30 bg-white/60 px-4 py-3 outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded bg-ink px-6 py-3 font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {status === "loading" ? "Scanning…" : "Scan site"}
          </button>
        </form>

        {status === "error" && (
          <p role="alert" className="mt-4 rounded bg-signal/10 px-4 py-3 text-signal">
            {errorMsg}
          </p>
        )}

        {status === "loading" && (
          <p className="mt-8 text-ink/60">Loading the page and running the checks — this can take a few seconds…</p>
        )}

        {status === "done" && result && (
          <div className="mt-10">
            <ScoreTag score={result.score} label={result.scoreLabel} projectedScore={result.projectedScore} />

            <p className="mt-6 text-ink/70">
              Found <span className="font-semibold text-ink">{result.totalIssues}</span> issue
              {result.totalIssues === 1 ? "" : "s"} on <span className="font-medium">{result.url}</span>.
            </p>

            <ul className="mt-6 flex flex-col gap-4">
              {result.issues.map((issue, i) => (
                <IssueCard key={`${issue.id}-${i}`} issue={issue} />
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
