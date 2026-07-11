"""
app.py
Flask backend for the AI Accessibility Checker.

Flow:
1. Frontend POSTs a website URL to /scan
2. scanner.py fetches the site and finds raw technical issues
3. ai_helper.py sends those issues to Claude for plain-English
   explanations, fixes, and a score
4. Result is cached temporarily in memory and returned as JSON,
   with a redirect-friendly result_id for a /results/<id> page
"""

import uuid
from flask import Flask, render_template, request, jsonify, redirect, url_for
from urllib.parse import urlparse

from scanner import scan_website, normalize_url
from ai_helper import get_ai_report

app = Flask(__name__)

# Simple in-memory store for scan results.
# Fine for development; swap for Redis/a database before deploying for real.
RESULTS_STORE = {}


def is_valid_url(url: str) -> bool:
    try:
        normalized = normalize_url(url)
        parsed = urlparse(normalized)
        return bool(parsed.netloc)
    except Exception:
        return False


@app.route("/")
def home():
    return render_template("index.html")

@app.route("/result")
def result():
    return render_template("result.html")

@app.route("/scan", methods=["POST"])
def scan():
    website_url = (request.form.get("website_url") or request.json.get("website_url")
                   if request.is_json else request.form.get("website_url"))

    if not website_url or not is_valid_url(website_url):
        return jsonify({"error": "Please enter a valid website URL."}), 400

    try:
        raw_issues = scan_website(website_url)
    except Exception as error:
        return jsonify({"error": f"Couldn't scan that site: {error}"}), 502

    ai_report = get_ai_report(website_url, raw_issues)

    result_id = str(uuid.uuid4())
    RESULTS_STORE[result_id] = {
        "url": website_url,
        "raw_issues": raw_issues,
        "report": ai_report,
    }

    # If the frontend is calling this via fetch(), it likely wants JSON back
    # with a result_id it can use to navigate to /results/<id>.
    if request.is_json or request.headers.get("Accept") == "application/json":
        return jsonify({"result_id": result_id, **ai_report})

    return redirect(url_for("results", result_id=result_id))


@app.route("/results/<result_id>")
def results(result_id):
    data = RESULTS_STORE.get(result_id)
    if not data:
        return render_template("error.html", message="Scan result not found or expired."), 404
    return render_template(
        "results.html",
        url=data["url"],
        report=data["report"],
    )


@app.route("/api/results/<result_id>")
def api_results(result_id):
    data = RESULTS_STORE.get(result_id)
    if not data:
        return jsonify({"error": "Result not found or expired."}), 404
    return jsonify({"url": data["url"], **data["report"]})


if __name__ == "__main__":
    app.run(debug=True)