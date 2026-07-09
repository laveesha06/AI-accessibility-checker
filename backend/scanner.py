from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from axe_selenium_python import Axe
from bs4 import BeautifulSoup
import requests
import json
import time

def scan_website_accessibility(url):
    """
    Scan a website for accessibility issues using Axe
    Returns a dict with issues found
    """
    
    try:
        # Set up Chrome options
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        
        # Try headless mode (comment out if issues occur)
        chrome_options.add_argument("--headless=new")
        
        # Initialize webdriver
        driver = webdriver.Chrome(options=chrome_options)
        
        # Set timeout
        driver.set_page_load_timeout(10)
        
        # Navigate to URL
        driver.get(url)
        
        # Wait for page to load
        time.sleep(2)
        
        # Run Axe scan
        axe = Axe(driver)
        axe.inject()
        axe.run()
        results = axe.report()
        
        # Parse results
        issues = parse_axe_results(results)
        
        # Also perform basic HTML analysis
        html_issues = analyze_html(driver.page_source)
        issues.extend(html_issues)
        
        driver.quit()
        
        return {
            'error': None,
            'issues': issues,
            'url': url
        }
    
    except Exception as e:
        return {
            'error': f"Failed to scan website: {str(e)}",
            'issues': [],
            'url': url
        }

def parse_axe_results(axe_results):
    """Parse Axe JSON results into our format"""
    issues = []
    
    # Parse violations (critical issues)
    if 'violations' in axe_results:
        for violation in axe_results['violations']:
            for node in violation.get('nodes', []):
                issues.append({
                    'type': violation['id'],
                    'impact': violation.get('impact', 'unknown'),
                    'description': violation.get('description', 'Accessibility issue found'),
                    'elements': extract_elements(node),
                    'recommendation': violation.get('help', 'Review this issue'),
                    'details': violation.get('helpUrl', '')
                })
    
    # Parse incomplete items
    if 'incomplete' in axe_results:
        for item in axe_results['incomplete']:
            for node in item.get('nodes', []):
                issues.append({
                    'type': item['id'],
                    'impact': 'unknown',
                    'description': f"{item.get('description', 'Potential issue')} (needs review)",
                    'elements': extract_elements(node),
                    'recommendation': item.get('help', 'Manual review needed'),
                    'details': item.get('helpUrl', '')
                })
    
    return issues

def extract_elements(node):
    """Extract element information from Axe node"""
    elements = []
    if 'target' in node:
        elements.append({
            'selector': ' > '.join(node['target']),
            'html': node.get('html', '')[:200]  # Truncate HTML
        })
    return elements

def analyze_html(html_content):
    """Perform basic HTML analysis for additional accessibility issues"""
    issues = []
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Check for missing lang attribute
        html_tag = soup.find('html')
        if not html_tag or not html_tag.get('lang'):
            issues.append({
                'type': 'missing-html-lang',
                'impact': 'serious',
                'description': 'HTML element missing lang attribute',
                'elements': [{'selector': '<html>', 'html': ''}],
                'recommendation': 'Add lang attribute to <html> tag (e.g., <html lang="en">)',
                'details': ''
            })
        
        # Check for page title
        title = soup.find('title')
        if not title or not title.string:
            issues.append({
                'type': 'missing-page-title',
                'impact': 'critical',
                'description': 'Page missing a descriptive title',
                'elements': [{'selector': '<head>', 'html': ''}],
                'recommendation': 'Add a meaningful <title> tag in the <head>',
                'details': ''
            })
        
        # Check for images without alt text
        images_without_alt = soup.find_all('img', alt=False)
        if images_without_alt and len(images_without_alt) > 0:
            issues.append({
                'type': 'images-without-alt',
                'impact': 'critical',
                'description': f'Found {len(images_without_alt)} images without alt text',
                'elements': [{'selector': f'<img src="{img.get("src", "")}">', 'html': str(img)[:100]} for img in images_without_alt[:3]],
                'recommendation': 'Add descriptive alt text to all images',
                'details': ''
            })
        
        # Check for form inputs without labels
        inputs = soup.find_all(['input', 'textarea', 'select'])
        inputs_without_labels = []
        for inp in inputs:
            input_id = inp.get('id')
            if input_id:
                label = soup.find('label', {'for': input_id})
                if not label:
                    inputs_without_labels.append(inp)
            elif not inp.get('aria-label') and not inp.get('title'):
                inputs_without_labels.append(inp)
        
        if inputs_without_labels:
            issues.append({
                'type': 'form-missing-labels',
                'impact': 'serious',
                'description': f'Found {len(inputs_without_labels)} form inputs without associated labels',
                'elements': [{'selector': inp.name, 'html': str(inp)[:100]} for inp in inputs_without_labels[:3]],
                'recommendation': 'Associate labels with all form inputs using <label> tags or aria-label',
                'details': ''
            })
    
    except Exception as e:
        pass  # Silently ignore HTML parsing errors
    
    return issues
