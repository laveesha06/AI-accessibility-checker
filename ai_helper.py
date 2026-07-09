"""
ai_helper.py
Takes the raw technical issues found by scanner.py and asks Claude to:
1. Explain each issue in plain English (who it affects, why it matters)
2. Suggest a concrete code fix
3. Give the site an overall accessibility score out of 100,
   plus a projected score if all fixes were applied.

Requires the ANTHROPIC_API_KEY environment variable to be set.
Install the SDK with: pip install anthropic
"""

import os
import json
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-6"

# Rough severity weights used for a fallback score if you want a
# non-AI baseline score before/instead of asking Claude for one.
SEVERITY_WEIGHTS = {"high": 15, "medium": 8, "low": 3}


def calculate_baseline_score(issues: list) -> int:
    """Simple deterministic score, used as a fallback / sanity check."""
    score = 100
    for issue in issues:
        weight = SEVERITY_WEIGHTS.get(issue.get("severity", "low"), 3)
        score -= weight
    return max(score, 0)


def build_prompt(url: str, issues: list) -> str:
    issues_json = json.dumps(issues, indent=2)
    return f"""You are an accessibility expert reviewing a website scan for {url}.

Below is a JSON list of raw technical accessibility issues found by an automated scanner:

{issues_json}

For EACH issue, write:
- "plain_english": one or two sentences explaining who this affects (e.g. blind users on screen readers, low-vision users, keyboard-only users) and what breaks for them. No jargon.
- "fix": a short, specific code-level suggestion to fix it (e.g. an example alt attribute, an example CSS color pair, etc.)

Then provide:
- "overall_score": an integer 0-100 accessibility score for the site based on the number and severity of issues found.
- "projected_score": an integer 0-100 estimate of the score if all listed issues were fixed (should be high, e.g. 90+, if these are the only issues).
- "summary": one short sentence summarizing the site's overall accessibility state.

Respond ONLY with valid JSON in this exact shape and nothing else (no markdown fences, no preamble):

{{
  "overall_score": 0,
  "projected_score": 0,
  "summary": "",
  "issues": [
    {{
      "code": "the original issue code",
      "plain_english": "",
      "fix": ""
    }}
  ]
}}
"""


def get_ai_report(url: str, issues: list) -> dict:
    """
    Sends issues to Claude and returns a structured report dict.
    Falls back to a baseline score / generic text if the API call fails
    or issues list is empty.
    """
    if not issues:
        return {
            "overall_score": 100,
            "projected_score": 100,
            "summary": "No major accessibility issues were detected by the scanner.",
            "issues": [],
        }

    prompt = build_prompt(url, issues)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = "".join(
            block.text for block in response.content if block.type == "text"
        )
        cleaned = raw_text.replace("```json", "").replace("```", "").strip()
        report = json.loads(cleaned)
        return report

    except (json.JSONDecodeError, Exception) as error:
        # Fallback: return the raw issues with a deterministic score
        # so the app still works even if the AI call fails.
        fallback_issues = [
            {
                "code": issue["code"],
                "plain_english": issue.get("detail", ""),
                "fix": "See technical detail above; AI explanation unavailable.",
            }
            for issue in issues
        ]
        baseline = calculate_baseline_score(issues)
        return {
            "overall_score": baseline,
            "projected_score": 95,
            "summary": f"AI explanation service unavailable ({error}). Showing raw scan results instead.",
            "issues": fallback_issues,
        }