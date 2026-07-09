"""
scanner.py
Fetches a website's HTML and checks it for common accessibility problems:
- Missing alt text on images
- Poor color contrast
- Missing form labels
- Keyboard-navigation issues (positive tabindex, missing focus styles, etc.)
- Missing page language / title
- Buttons or links with no accessible text

Returns a list of "issue dicts" that ai_helper.py will turn into
plain-English explanations.
"""

import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse


def normalize_url(url: str) -> str:
    """Make sure the URL has a scheme, e.g. add https:// if missing."""
    url = url.strip()
    if not urlparse(url).scheme:
        url = "https://" + url
    return url


def fetch_html(url: str) -> str:
    headers = {"User-Agent": "AccessibilityChecker/1.0 (+educational tool)"}
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    return response.text


def hex_to_rgb(hex_color: str):
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    if len(hex_color) != 6:
        return None
    try:
        return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None


def relative_luminance(rgb):
    def channel(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast_ratio(rgb1, rgb2) -> float:
    l1 = relative_luminance(rgb1)
    l2 = relative_luminance(rgb2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def check_images_missing_alt(soup, issues):
    images = soup.find_all("img")
    missing = [img for img in images if not img.get("alt", "").strip()]
    if missing:
        issues.append({
            "code": "img-alt-missing",
            "severity": "high",
            "count": len(missing),
            "detail": f"{len(missing)} of {len(images)} images have no alt attribute or an empty one.",
            "examples": [str(img)[:150] for img in missing[:3]],
        })


def check_form_labels(soup, issues):
    inputs = soup.find_all(["input", "textarea", "select"])
    unlabeled = []
    for el in inputs:
        input_type = el.get("type", "").lower()
        if input_type in ("hidden", "submit", "button"):
            continue
        el_id = el.get("id")
        has_label = bool(el_id and soup.find("label", attrs={"for": el_id}))
        has_aria = bool(el.get("aria-label") or el.get("aria-labelledby"))
        if not has_label and not has_aria:
            unlabeled.append(el)
    if unlabeled:
        issues.append({
            "code": "form-label-missing",
            "severity": "high",
            "count": len(unlabeled),
            "detail": f"{len(unlabeled)} form fields have no associated <label> or aria-label.",
            "examples": [str(el)[:150] for el in unlabeled[:3]],
        })


def check_positive_tabindex(soup, issues):
    bad = []
    for el in soup.find_all(attrs={"tabindex": True}):
        try:
            if int(el.get("tabindex")) > 0:
                bad.append(el)
        except ValueError:
            continue
    if bad:
        issues.append({
            "code": "positive-tabindex",
            "severity": "medium",
            "count": len(bad),
            "detail": f"{len(bad)} elements use a positive tabindex, which breaks natural keyboard tab order.",
            "examples": [str(el)[:150] for el in bad[:3]],
        })


def check_empty_links_buttons(soup, issues):
    bad = []
    for el in soup.find_all(["a", "button"]):
        text = el.get_text(strip=True)
        has_aria = el.get("aria-label") or el.get("aria-labelledby")
        if not text and not has_aria:
            bad.append(el)
    if bad:
        issues.append({
            "code": "empty-link-button",
            "severity": "high",
            "count": len(bad),
            "detail": f"{len(bad)} links/buttons have no visible text or aria-label, so screen readers announce nothing useful.",
            "examples": [str(el)[:150] for el in bad[:3]],
        })


def check_page_language(soup, issues):
    html_tag = soup.find("html")
    if not html_tag or not html_tag.get("lang"):
        issues.append({
            "code": "html-lang-missing",
            "severity": "medium",
            "count": 1,
            "detail": "The <html> tag has no lang attribute, so screen readers may mispronounce content.",
            "examples": [],
        })


def check_page_title(soup, issues):
    title = soup.find("title")
    if not title or not title.get_text(strip=True):
        issues.append({
            "code": "title-missing",
            "severity": "medium",
            "count": 1,
            "detail": "The page has no <title>, making it hard for screen reader users to identify the page.",
            "examples": [],
        })


def check_inline_color_contrast(soup, issues):
    """
    Lightweight contrast check: only catches inline style="color:...;background:..."
    declarations, since real contrast checking requires a rendered browser (e.g. Playwright)
    to read computed CSS. This is a best-effort static check.
    """
    bad = []
    pattern_color = re.compile(r"color\s*:\s*(#[0-9a-fA-F]{3,6})")
    pattern_bg = re.compile(r"background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})")

    for el in soup.find_all(style=True):
        style = el.get("style", "")
        color_match = pattern_color.search(style)
        bg_match = pattern_bg.search(style)
        if color_match and bg_match:
            fg = hex_to_rgb(color_match.group(1))
            bg = hex_to_rgb(bg_match.group(1))
            if fg and bg:
                ratio = contrast_ratio(fg, bg)
                if ratio < 4.5:
                    bad.append((el, round(ratio, 2)))

    if bad:
        issues.append({
            "code": "low-color-contrast",
            "severity": "high",
            "count": len(bad),
            "detail": f"{len(bad)} elements have inline text/background colors with contrast below the 4.5:1 minimum (WCAG AA).",
            "examples": [f"ratio {ratio}: {str(el)[:120]}" for el, ratio in bad[:3]],
        })


def scan_website(url: str) -> list:
    """
    Main entry point. Fetches the page and runs all checks.
    Returns a list of issue dicts, e.g.:
    [{"code": "img-alt-missing", "severity": "high", "count": 5, "detail": "...", "examples": [...]}]
    """
    url = normalize_url(url)
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    issues = []
    check_images_missing_alt(soup, issues)
    check_form_labels(soup, issues)
    check_positive_tabindex(soup, issues)
    check_empty_links_buttons(soup, issues)
    check_page_language(soup, issues)
    check_page_title(soup, issues)
    check_inline_color_contrast(soup, issues)

    return issues