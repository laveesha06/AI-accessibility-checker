"""
ai_helper.py
AI Accessibility Report using Gemini (google-genai SDK)
"""

import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()
print("API Key:",os.getenv("GEMINI_API_KEY"))

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "gemini-2.5-flash"

SEVERITY_WEIGHTS = {
    "high": 15,
    "medium": 8,
    "low": 3
}


def calculate_baseline_score(issues):
    score = 100
    for issue in issues:
        score -= SEVERITY_WEIGHTS.get(issue.get("severity", "low"), 3)
    return max(score, 0)


def build_prompt(url, issues):
    return f"""
You are an accessibility expert reviewing the website:

{url}

Accessibility issues:

{json.dumps(issues, indent=2)}

Return ONLY valid JSON in this exact format:

{{
    "overall_score": 0,
    "projected_score": 0,
    "summary": "",
    "issues":[
        {{
            "code":"",
            "severity":"",
            "plain_english":"",
            "fix":""
        }}
    ]
}}

Do not return markdown.
"""


def get_ai_report(url, issues):

    if not issues:
        return {
            "overall_score": 100,
            "projected_score": 100,
            "summary": "No accessibility issues found.",
            "issues": []
        }

    prompt = build_prompt(url, issues)

    try:

        response = client.models.generate_content(
            model=MODEL,
            contents=prompt
        )

        raw = response.text.strip()

        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()

        report = json.loads(raw)

        return report

    except Exception as e:
        print("Gemini Error:", e)

        fallback = []

        for issue in issues:
            fallback.append({
                "code": issue.get("code", ""),
                "severity": issue.get("severity", "low"),
                "plain_english": issue.get("detail", ""),
                "fix": "AI explanation unavailable."
            })

        return {
            "overall_score": calculate_baseline_score(issues),
            "projected_score": 95,
            "summary": f"Gemini error: {str(e)}",
            "issues": fallback
        }