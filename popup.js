import { debounce } from './js/utils.js';
import { initTheme, setTheme } from './js/theme.js';
import { searchHistory, searchTabs } from './js/search.js';
import { renderResults, updateSelectionDOM } from './js/ui.js';
import { handleCalculator } from './js/commands.js';

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

    // 4. Theme Switcher Command
    if (rawQuery.startsWith('/theme')) {
        const themeName = rawQuery.replace('/theme', '').trim().toLowerCase();

        let title, subtitle, action;
        if (themeName === 'retro') {
            title = 'Switch to Retro Theme';
            subtitle = 'Apply the Retro Terminal style';
            action = () => setTheme('retro');
        } else if (themeName === 'glass' || themeName === 'default') {
            title = 'Switch to Glass Theme';
            subtitle = 'Apply the default Liquid Glass style';
            action = () => setTheme('glass');
        } else {
            title = 'Theme Switcher';
            subtitle = 'Type /theme retro or /theme glass';
            action = () => { };
        }

        renderCommandResult(title, subtitle, action);
        return;
    }

    // 5. Standard Search
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
