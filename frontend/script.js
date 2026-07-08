const API_BASE_URL = 'http://localhost:5000/api';

const scanForm = document.getElementById('scanForm');
const urlInput = document.getElementById('urlInput');
const loadingState = document.getElementById('loadingState');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const resultsContainer = document.getElementById('resultsContainer');
const errorMessage = document.getElementById('errorMessage');
const scanButton = document.querySelector('.btn-scan');
const spinner = document.getElementById('spinner');

scanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await performScan();
});

async function performScan() {
    const url = urlInput.value.trim();

    if (!url) {
        showError('Please enter a valid URL');
        return;
    }

    // Clear previous results
    hideAllSections();
    showLoading();
    
    // Disable button and show spinner
    scanButton.disabled = true;
    spinner.style.display = 'inline-block';

    try {
        const response = await fetch(`${API_BASE_URL}/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Failed to scan website');
            return;
        }

        displayResults(data);
    } catch (error) {
        showError(`Network error: ${error.message}`);
        console.error('Scan error:', error);
    } finally {
        scanButton.disabled = false;
        spinner.style.display = 'none';
    }
}

function displayResults(data) {
    hideAllSections();

    const { url, total_issues, issues, summary } = data;

    let html = `
        <div class="results-header">
            <h2>Scan Results for: <code style="color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(url)}</code></h2>
            
            <div class="summary">
                <div class="summary-status ${total_issues === 0 ? 'good' : 'critical'}">
                    ${total_issues === 0 ? '✓' : total_issues}
                </div>
                <div>
                    <strong>${summary}</strong>
                </div>
            </div>
    `;

    // Issue statistics
    const critical = issues.filter(i => i.impact === 'critical').length;
    const serious = issues.filter(i => i.impact === 'serious').length;
    const moderate = issues.filter(i => i.impact === 'moderate').length;
    const minor = issues.filter(i => i.impact === 'minor').length;

    if (total_issues > 0) {
        html += `
            <div class="issue-stats">
                ${critical > 0 ? `<div class="stat"><span class="stat-badge critical"></span><span>${critical} Critical</span></div>` : ''}
                ${serious > 0 ? `<div class="stat"><span class="stat-badge serious"></span><span>${serious} Serious</span></div>` : ''}
                ${moderate > 0 ? `<div class="stat"><span class="stat-badge moderate"></span><span>${moderate} Moderate</span></div>` : ''}
                ${minor > 0 ? `<div class="stat"><span class="stat-badge minor"></span><span>${minor} Minor</span></div>` : ''}
            </div>
        `;
    }

    html += '</div>';

    // Issues list
    if (total_issues > 0) {
        html += '<div class="issues-list">';
        
        issues.forEach((issue, index) => {
            html += `
                <div class="issue-card ${issue.impact}">
                    <div class="issue-header">
                        <span class="impact-badge ${issue.impact}">${issue.impact}</span>
                    </div>
                    <div class="issue-title">${escapeHtml(issue.type)}</div>
                    <div class="issue-description">${escapeHtml(issue.description)}</div>
                    <div class="ai-explanation">${escapeHtml(issue.ai_explanation)}</div>
                    <div class="recommendation">${escapeHtml(issue.recommendation)}</div>
            `;

            if (issue.elements && issue.elements.length > 0) {
                html += '<div class="affected-elements">';
                html += '<div class="affected-elements-title">Affected Elements:</div>';
                issue.elements.forEach(el => {
                    html += `<div class="element">${escapeHtml(el.selector)}</div>`;
                });
                html += '</div>';
            }

            html += '</div>';
        });

        html += '</div>';
    } else {
        html += `
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px;">
                <div style="font-size: 3rem; margin-bottom: 16px;">🎉</div>
                <h3 style="color: var(--success); margin-bottom: 8px;">Excellent Accessibility!</h3>
                <p>No major accessibility issues were found on this website.</p>
            </div>
        `;
    }

    resultsContainer.innerHTML = html;
    resultsSection.style.display = 'block';
}

function showError(message) {
    hideAllSections();
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
}

function showLoading() {
    loadingState.style.display = 'block';
}

function hideAllSections() {
    loadingState.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Allow Enter key to submit
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.activeElement === urlInput) {
        scanForm.dispatchEvent(new Event('submit'));
    }
});
