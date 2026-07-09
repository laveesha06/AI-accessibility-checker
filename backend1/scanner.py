import requests
from bs4 import BeautifulSoup

def scan_website(url):
    issues = []

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Check if images have alt text
        images = soup.find_all("img")
        for img in images:
            if not img.get("alt"):
                issues.append("Image missing alt text.")

        # Check if the page has a title
        if not soup.title or not soup.title.string:
            issues.append("Page is missing a title tag.")

        # Check if forms have labels
        inputs = soup.find_all("input")
        labels = soup.find_all("label")

        if inputs and len(labels) == 0:
            issues.append("Form inputs may be missing labels.")

        if not issues:
            issues.append("No major accessibility issues found.")

        return issues

    except Exception as e:
        return [f"Error scanning website: {e}"]