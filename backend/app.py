from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import openai
from scanner import scan_website_accessibility

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')

@app.route('/api/scan', methods=['POST'])
def scan():
    """
    Scan a website for accessibility issues
    Expected JSON: { "url": "https://example.com" }
    """
    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Validate URL format
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        # Scan the website
        scan_results = scan_website_accessibility(url)
        
        if scan_results['error']:
            return jsonify({'error': scan_results['error']}), 400
        
        # Get AI explanations for issues
        issues_with_explanations = []
        for issue in scan_results['issues']:
            explanation = get_ai_explanation(issue)
            issues_with_explanations.append({
                'type': issue['type'],
                'impact': issue['impact'],
                'description': issue['description'],
                'elements': issue['elements'],
                'ai_explanation': explanation,
                'recommendation': issue['recommendation']
            })
        
        return jsonify({
            'success': True,
            'url': url,
            'total_issues': len(issues_with_explanations),
            'issues': issues_with_explanations,
            'summary': generate_summary(issues_with_explanations)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_ai_explanation(issue):
    """Get AI-generated explanation for an accessibility issue"""
    try:
        prompt = f"""
        An accessibility issue was found on a website. Provide a brief, user-friendly explanation 
        and what the impact might be for users with disabilities.
        
        Issue Type: {issue['type']}
        Description: {issue['description']}
        Impact Level: {issue['impact']}
        
        Provide a concise explanation (2-3 sentences) that a non-technical person can understand.
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are an accessibility expert. Explain web accessibility issues in simple, clear language."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.7
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Could not generate explanation: {str(e)}"

def generate_summary(issues):
    """Generate an overall summary of accessibility issues"""
    if not issues:
        return "Great! No major accessibility issues found."
    
    critical = len([i for i in issues if i['impact'] == 'critical'])
    serious = len([i for i in issues if i['impact'] == 'serious'])
    moderate = len([i for i in issues if i['impact'] == 'moderate'])
    minor = len([i for i in issues if i['impact'] == 'minor'])
    
    summary = f"Found {len(issues)} accessibility issue(s): "
    counts = []
    if critical: counts.append(f"{critical} critical")
    if serious: counts.append(f"{serious} serious")
    if moderate: counts.append(f"{moderate} moderate")
    if minor: counts.append(f"{minor} minor")
    
    return summary + ", ".join(counts)

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
