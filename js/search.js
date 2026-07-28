// --- FEATURE: ROBUST FUZZY SEARCH ---
export function getFuzzyScore(pattern, str) {
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

// Shared ranking so typos ("githbu" -> "GitHub") work the same way in every
// search mode, not just browsing history.
function scoreMatch(q, title, url) {
    if (!q) return 1;

    const score = Math.max(getFuzzyScore(q, title), getFuzzyScore(q, url));
    let bonus = 0;
    if (title.includes(q)) bonus += 50;
    if (url.includes(q)) bonus += 30;

    return score > 0 ? score + bonus : 0;
}

export async function searchHistory(textQuery, filterDomain) {
    return new Promise((resolve) => {
        const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
        const startTime = Date.now() - ONE_MONTH_MS;

        chrome.history.search({
            text: '',
            maxResults: 2000,
            startTime: startTime
        }, (historyItems) => {
            const scoredItems = historyItems.map(item => {
                if (!item.url) return { item, score: -1 };

                const url = item.url.toLowerCase();
                const title = (item.title || '').toLowerCase();
                const q = textQuery.toLowerCase();

                // Domain filter check
                if (filterDomain && !url.includes(filterDomain)) {
                    return { item, score: -1 };
                }

                let score = scoreMatch(q, title, url);
                if (score <= 0) return { item, score: -1 };

                if (item.visitCount) {
                    score += Math.min(Math.log(item.visitCount) * 5, 20);
                }

                const hoursAgo = (Date.now() - item.lastVisitTime) / (1000 * 60 * 60);
                score += Math.max(0, 50 - hoursAgo);

                return { item, score };
            });

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
            resolve(results);
        });
    });
}

export async function searchTabs(query) {
    return new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
            const q = query.toLowerCase().trim();

            const results = tabs
                .map(tab => ({
                    tab,
                    score: scoreMatch(q, (tab.title || '').toLowerCase(), (tab.url || '').toLowerCase())
                }))
                .filter(r => r.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(({ tab }) => ({
                    title: tab.title,
                    url: tab.url,
                    id: tab.id,
                    windowId: tab.windowId,
                    favIconUrl: tab.favIconUrl,
                    isTab: true
                }));

            resolve(results.slice(0, 20));
        });
    });
}

export async function searchRecentlyClosed(query) {
    return new Promise((resolve) => {
        chrome.sessions.getRecentlyClosed({ maxResults: 25 }, (sessions) => {
            const q = query.toLowerCase().trim();
            const scored = [];

            sessions.forEach(session => {
                if (session.tab) {
                    const title = session.tab.title || 'Untitled Tab';
                    const url = session.tab.url || '';
                    const score = scoreMatch(q, title.toLowerCase(), url.toLowerCase());

                    if (score > 0) {
                        scored.push({
                            score,
                            lastModified: session.lastModified,
                            result: {
                                title,
                                url,
                                sessionId: session.tab.sessionId,
                                lastModified: session.lastModified,
                                isClosedTab: true,
                                action: () => {
                                    chrome.sessions.restore(session.tab.sessionId);
                                    window.close();
                                }
                            }
                        });
                    }
                } else if (session.window) {
                    // Handle closed windows if needed, currently focusing on tabs per requirement
                    // But we can include them as "Restorable Window"
                    const tabCount = session.window.tabs ? session.window.tabs.length : 0;
                    const title = `Closed Window (${tabCount} tabs)`;
                    const score = scoreMatch(q, title.toLowerCase(), '');

                    if (score > 0) {
                        scored.push({
                            score,
                            lastModified: session.lastModified,
                            result: {
                                title: title,
                                url: 'Restore Window',
                                sessionId: session.window.sessionId,
                                lastModified: session.lastModified,
                                isClosedTab: true,
                                action: () => {
                                    chrome.sessions.restore(session.window.sessionId);
                                    window.close();
                                }
                            }
                        });
                    }
                }
            });

            scored.sort((a, b) => b.score - a.score || b.lastModified - a.lastModified);
            resolve(scored.map(s => s.result));
        });
    });
}

// chrome.bookmarks.search() only does a native substring/whole-word match, so
// typos silently returned nothing. Walking the tree ourselves lets us apply
// the same fuzzy ranking used everywhere else.
function flattenBookmarks(nodes, out = []) {
    for (const node of nodes) {
        if (node.url) out.push(node);
        if (node.children) flattenBookmarks(node.children, out);
    }
    return out;
}

export async function searchBookmarks(query) {
    return new Promise((resolve) => {
        chrome.bookmarks.getTree((tree) => {
            const all = flattenBookmarks(tree);
            const q = query.toLowerCase().trim();

            if (!q) {
                const recent = [...all].sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
                resolve(recent.slice(0, 20).map(b => ({ title: b.title, url: b.url, isBookmark: true })));
                return;
            }

            const results = all
                .map(b => ({
                    b,
                    score: scoreMatch(q, (b.title || '').toLowerCase(), (b.url || '').toLowerCase())
                }))
                .filter(r => r.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 20)
                .map(({ b }) => ({ title: b.title, url: b.url, isBookmark: true }));

            resolve(results);
        });
    });
}
