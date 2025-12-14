const searchInput = document.getElementById('flashback-input');
const resultsList = document.getElementById('flashback-results');
let selectedIndex = -1;
let currentResults = [];

// Focus input on load
window.addEventListener('load', () => {
    searchInput.focus();
    performSearch('');
});

// Event Listeners
searchInput.addEventListener('input', debounce((e) => {
    performSearch(e.target.value);
}, 200)); // Slightly faster debounce

searchInput.addEventListener('keydown', handleKeyNavigation);

function performSearch(query) {
    const rawQuery = query.trim();

    // --- QUICK COMMANDS ---

    // 1. Calculator Mode (= 5 * 10)
    if (rawQuery.startsWith('=')) {
        handleCalculator(rawQuery.substring(1));
        return;
    }

    // 2. Clear History Command (/clear)
    if (rawQuery === '/clear') {
        renderCommandResult('Clear History', 'Delete all browsing history', () => {
            if (confirm('Are you sure you want to clear your entire browsing history?')) {
                chrome.history.deleteAll(() => {
                    performSearch('');
                });
            }
        });
        return;
    }

    // 3. Tab Search Command (/tabs)
    if (rawQuery.startsWith('/tabs')) {
        const tabQuery = rawQuery.replace('/tabs', '').trim();
        searchTabs(tabQuery);
        return;
    }

    // --- STANDARD HISTORY SEARCH ---

    // 1. Parse Smart Filters (domain:query)
    let filterDomain = null;
    let textQuery = rawQuery;

    const colonIndex = rawQuery.indexOf(':');
    if (colonIndex !== -1 && colonIndex < rawQuery.length - 1) {
        const possiblePrefix = rawQuery.substring(0, colonIndex).trim();
        if (!possiblePrefix.includes(' ') && possiblePrefix.length > 0) {
            filterDomain = possiblePrefix.toLowerCase();
            textQuery = rawQuery.substring(colonIndex + 1).trim();
        }
    }

    // 2. Fetch History
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const startTime = Date.now() - ONE_MONTH_MS;

    chrome.history.search({
        text: '',
        maxResults: 2000,
        startTime: startTime
    }, (historyItems) => {
        // 3. Score and Filter
        const scoredItems = historyItems.map(item => {
            if (!item.url) return { item, score: -1 };

            const url = item.url.toLowerCase();
            const title = (item.title || '').toLowerCase();
            const q = textQuery.toLowerCase();

            // Domain filter check
            if (filterDomain && !url.includes(filterDomain)) {
                return { item, score: -1 };
            }

            // --- IMPROVED SCORE LOGIC ---
            let score = 0;

            if (q.length === 0) {
                // No query: validation score based on recency/visits
                score = 1;
            } else {
                const fuzzyTitle = getFuzzyScore(q, title);
                const fuzzyUrl = getFuzzyScore(q, url);

                // Max match score
                score = Math.max(fuzzyTitle, fuzzyUrl);

                // Bonus for exact matches
                if (title.includes(q)) score += 50;
                if (url.includes(q)) score += 30;

                // Threshold: If fuzzy score is too low, filter out
                if (score < 10) return { item, score: -1 };
            }

            // Frequency Boost
            if (item.visitCount) {
                score += Math.min(Math.log(item.visitCount) * 5, 20);
            }

            // Recency Boost
            const hoursAgo = (Date.now() - item.lastVisitTime) / (1000 * 60 * 60);
            score += Math.max(0, 50 - hoursAgo);

            return { item, score };
        });

        // 4. Sort and Deduplicate
        const filtered = scoredItems
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score);

        const seenUrls = new Set();
        const results = [];

        for (const r of filtered) {
            if (results.length >= 20) break;
            if (!seenUrls.has(r.item.url)) {
                seenUrls.add(r.item.url);
                results.push(r.item);
            }
        }

        currentResults = results;
        renderResults(results);
    });
}

// --- FEATURE: ROBUST FUZZY SEARCH ---
function getFuzzyScore(pattern, str) {
    if (!pattern || !str) return 0;

    let score = 0;
    let pIdx = 0;
    let sIdx = 0;
    let consecutive = 0;

    // Check if characters exist in order
    while (pIdx < pattern.length && sIdx < str.length) {
        if (pattern[pIdx] === str[sIdx]) {
            score += 10;
            score += consecutive * 5; // Bonus for consecutive matches
            consecutive++;
            pIdx++;
        } else {
            consecutive = 0;
        }
        sIdx++;
    }

    // Didn't match full pattern
    if (pIdx < pattern.length) return 0;

    return score;
}

// --- FEATURE: CALCULATOR ---
function handleCalculator(expression) {
    try {
        // Safe-ish evaluation for local tool
        // Only allow numbers and basic math operators
        if (!/^[0-9+\-*/().\s]*$/.test(expression)) {
            throw new Error('Invalid characters');
        }

        // Use Function constructor instead of eval for slightly better containment
        const result = new Function('return ' + expression)();

        if (result === undefined || isNaN(result)) throw new Error('NaN');

        renderCommandResult('Calculation', `Result: ${result}`, () => {
            navigator.clipboard.writeText(result.toString());
            window.close();
        });
    } catch (e) {
        renderCommandResult('Calculator', 'Type a math expression (e.g. = 5 * 10)', () => { });
    }
}

// --- FEATURE: OPEN TABS SEARCH ---
function searchTabs(query) {
    chrome.tabs.query({}, (tabs) => {
        const q = query.toLowerCase();
        const results = tabs.filter(tab => {
            return (tab.title && tab.title.toLowerCase().includes(q)) ||
                (tab.url && tab.url.toLowerCase().includes(q));
        }).map(tab => ({
            title: tab.title,
            url: tab.url,
            id: tab.id,
            windowId: tab.windowId,
            isTab: true // Mark as tab to trigger switch logic
        }));

        currentResults = results.slice(0, 20);
        renderResults(currentResults);
    });
}

// Helper to render single command result
function renderCommandResult(title, subtitle, action) {
    const item = {
        title: title,
        url: subtitle,
        action: action
    };
    currentResults = [item];
    renderResults([item]);
}


function renderResults(results) {
    resultsList.innerHTML = '';
    selectedIndex = -1;

    if (results.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No results found';
        li.className = 'flashback-no-results';
        resultsList.appendChild(li);
        return;
    }

    results.forEach((item, index) => {
        const li = document.createElement('li');
        li.dataset.index = index;
        li.className = 'flashback-result-item';

        // Title
        const title = document.createElement('div');
        title.className = 'flashback-result-title';
        title.textContent = item.title || item.url || 'Untitled';

        // Subtitle (URL or Status)
        const url = document.createElement('div');
        url.className = 'flashback-result-url';

        if (item.action) {
            url.textContent = item.url; // Use url field for subtitle in commands
        } else if (item.isTab) {
            url.textContent = `Switch to Tab: ${item.url}`;
            url.style.color = '#4ade80'; // Greenish to indicate valid action
        } else {
            url.textContent = item.url;
        }

        li.appendChild(title);
        li.appendChild(url);

        li.addEventListener('click', () => {
            activateResult(item);
        });

        li.addEventListener('mouseenter', () => {
            updateSelection(index);
        });

        resultsList.appendChild(li);
    });
}

// --- FEATURE: SWITCH TO TAB LOGIC ---
function activateResult(item) {
    // 1. Command Action
    if (item.action) {
        item.action();
        return;
    }

    // 2. Direct Tab Switch (if we know it's a tab)
    if (item.isTab && item.id) {
        chrome.windows.update(item.windowId, { focused: true });
        chrome.tabs.update(item.id, { active: true });
        window.close();
        return;
    }

    // 3. Smart Switch (Check if history URL is already open)
    chrome.tabs.query({}, (tabs) => {
        const targetUrl = item.url;
        const existingTab = tabs.find(t => t.url === targetUrl); // Exact match

        if (existingTab) {
            chrome.windows.update(existingTab.windowId, { focused: true });
            chrome.tabs.update(existingTab.id, { active: true });
        } else {
            chrome.tabs.create({ url: targetUrl });
        }
        window.close();
    });
}

function handleKeyNavigation(e) {
    if (e.key === 'Escape') {
        window.close();
        return;
    }

    if (currentResults.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
        updateSelection(newIndex);
        return;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.max(selectedIndex - 1, 0);
        updateSelection(newIndex);
        return;
    }

    if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex !== -1 && currentResults[selectedIndex]) {
            activateResult(currentResults[selectedIndex]);
        } else if (currentResults.length > 0) {
            activateResult(currentResults[0]);
        }
    }
}

function updateSelection(index) {
    if (selectedIndex !== -1) {
        const prev = resultsList.children[selectedIndex];
        if (prev) prev.classList.remove('selected');
    }

    selectedIndex = index;

    if (selectedIndex !== -1) {
        const curr = resultsList.children[selectedIndex];
        if (curr) {
            curr.classList.add('selected');
            curr.scrollIntoView({ block: 'nearest' });
        }
    }
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
