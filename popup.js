import { debounce } from './js/utils.js';
import { initTheme, setTheme, THEMES } from './js/theme.js';
import { searchHistory, searchTabs, searchRecentlyClosed, searchBookmarks } from './js/search.js';
import { renderResults, updateSelectionDOM } from './js/ui.js';
import { handleCalculator, getHelpCommands } from './js/commands.js';

const searchInput = document.getElementById('flashback-input');
const resultsList = document.getElementById('flashback-results');

let selectedIndex = -1;
let currentResults = [];

// Focus input and Init on load
window.addEventListener('load', () => {
    initTheme();
    searchInput.focus();
    performSearch('');
});

// Event Listeners
searchInput.addEventListener('input', debounce((e) => {
    performSearch(e.target.value);
}, 200));

searchInput.addEventListener('keydown', handleKeyNavigation);

async function performSearch(query) {
    const rawQuery = query.trim();

    // 0. Help Command
    if (rawQuery === '/' || rawQuery === '/help') {
        const results = getHelpCommands();
        currentResults = results;
        renderResults(currentResults, resultsList, activateResult, updateSelection);
        selectedIndex = -1;
        return;
    }

    // 1. Calculator Mode
    if (rawQuery.startsWith('=')) {
        const item = handleCalculator(rawQuery.substring(1));
        currentResults = [item];
        renderResults(currentResults, resultsList, activateResult, updateSelection);
        selectedIndex = -1;
        return;
    }

    // 2. Clear History Command
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

    // 3. Tab Search Command
    if (rawQuery.startsWith('/tabs')) {
        const tabQuery = rawQuery.replace('/tabs', '').trim();
        const results = await searchTabs(tabQuery);
        currentResults = results;
        renderResults(currentResults, resultsList, activateResult, updateSelection);
        selectedIndex = -1;
        return;
    }

    // 4. Recently Closed Tabs Command
    if (rawQuery.startsWith('/closed')) {
        const query = rawQuery.replace('/closed', '').trim();
        const results = await searchRecentlyClosed(query);
        currentResults = results;
        renderResults(currentResults, resultsList, activateResult, updateSelection);
        selectedIndex = -1;
        return;
    }

    // 5. Bookmarks Command
    if (rawQuery.startsWith('/bookmarks')) {
        const query = rawQuery.replace('/bookmarks', '').trim();
        const results = await searchBookmarks(query);
        currentResults = results;
        renderResults(currentResults, resultsList, activateResult, updateSelection);
        selectedIndex = -1;
        return;
    }

    // 6. Theme Switcher Command
    if (rawQuery.startsWith('/theme')) {
        const themeName = rawQuery.replace('/theme', '').trim().toLowerCase();

        // If specific theme provided
        if (themeName && (THEMES.includes(themeName) || themeName === 'glass' || themeName === 'default')) {
            const name = themeName === 'default' ? 'glass' : themeName;
            const title = `Switch to ${name.charAt(0).toUpperCase() + name.slice(1)} Theme`;
            const subtitle = `Apply the ${name} style`;
            const action = () => setTheme(name);
            renderCommandResult(title, subtitle, action);
            return;
        }

        // List all themes
        const themesList = ['glass', ...THEMES];
        const results = themesList.map(t => ({
            title: `Theme: ${t.charAt(0).toUpperCase() + t.slice(1)}`,
            url: `Apply ${t} theme`,
            action: () => {
                setTheme(t);
                // Optional: keep window open or show confirmation? 
                // Currently setTheme applies it. We can re-render to show active state or close.
                // Let's re-render to show it's active or just close.
                // Standard behavior seems to be "do action and close".
                // But for theme switching, seeing it change live is nice.
                // existing logic for action closes window if not prevented.
                // But wait, activateResult calls item.action().
                // if item.action is defined, it runs it and returns.
                // if we want to keep it open, we shouldn't close it in action.
                // But standard search closes. Let's stick to standard behavior for now.

                // Keep input as /theme so they can switch again if they want?
                // For now, simple action.
            }
        }));

        currentResults = results;
        renderResults(currentResults, resultsList, activateResult, updateSelection);
        selectedIndex = -1;

        return;
    }

    // 7. Standard Search
    // Check smart filter
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

    const results = await searchHistory(textQuery, filterDomain);
    currentResults = results;
    renderResults(currentResults, resultsList, activateResult, updateSelection);
    selectedIndex = -1;
}

function renderCommandResult(title, subtitle, action) {
    const item = {
        title: title,
        url: subtitle,
        action: action
    };
    currentResults = [item];
    renderResults(currentResults, resultsList, activateResult, updateSelection);
    selectedIndex = -1;
}

function updateSelection(index) {
    selectedIndex = index;
    updateSelectionDOM(selectedIndex, resultsList);
}

function activateResult(item) {
    if (item.action) {
        item.action();
        return;
    }

    if (item.isTab && item.id) {
        chrome.windows.update(item.windowId, { focused: true });
        chrome.tabs.update(item.id, { active: true });
        window.close();
        return;
    }

    chrome.tabs.query({}, (tabs) => {
        const targetUrl = item.url;
        const existingTab = tabs.find(t => t.url === targetUrl);

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
