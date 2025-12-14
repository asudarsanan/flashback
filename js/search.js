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

                let score = 0;
                if (q.length === 0) {
                    score = 1;
                } else {
                    const fuzzyTitle = getFuzzyScore(q, title);
                    const fuzzyUrl = getFuzzyScore(q, url);

                    score = Math.max(fuzzyTitle, fuzzyUrl);

                    if (title.includes(q)) score += 50;
                    if (url.includes(q)) score += 30;

                    if (score < 10) return { item, score: -1 };
                }

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
            const q = query.toLowerCase();
            const results = tabs.filter(tab => {
                return (tab.title && tab.title.toLowerCase().includes(q)) ||
                    (tab.url && tab.url.toLowerCase().includes(q));
            }).map(tab => ({
                title: tab.title,
                url: tab.url,
                id: tab.id,
                windowId: tab.windowId,
                isTab: true
            }));
            resolve(results.slice(0, 20));
        });
    });
}
