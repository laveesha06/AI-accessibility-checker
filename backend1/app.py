from flask import Flask, render_template, request
from scanner import scan_website

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/scan", methods=["POST"])
def scan():
    website_url = request.form.get("website_url")

    issues = scan_website(website_url)

    return "<br>".join(issues)

if __name__ == "__main__":
    app.run(debug=True)