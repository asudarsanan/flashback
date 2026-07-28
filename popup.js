import { debounce } from './js/utils.js';
import { initTheme, setTheme, THEMES, THEME_LABELS } from './js/theme.js';
import { searchHistory, searchTabs, searchRecentlyClosed, searchBookmarks } from './js/search.js';
import { renderResults, updateSelectionDOM } from './js/ui.js';
import { handleCalculator, getHelpCommands } from './js/commands.js';

const searchInput = document.getElementById('flashback-input');
const resultsList = document.getElementById('flashback-results');

let selectedIndex = -1;
let currentResults = [];
let clearConfirmArmed = false;

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

    // Typing anything other than /clear disarms the pending confirmation,
    // so it can't fire later from a stale state.
    if (rawQuery !== '/clear') {
        clearConfirmArmed = false;
    }

    // 0. Help Command
    if (rawQuery === '/' || rawQuery === '/help') {
        showResults(getHelpCommands());
        return;
    }

    // 1. Calculator Mode
    if (rawQuery.startsWith('=')) {
        showResults([handleCalculator(rawQuery.substring(1))]);
        return;
    }

    // 2. Clear History Command
    // window.confirm() is unreliable inside an extension popup (it can lose
    // focus/close before the dialog resolves), so confirmation is handled as
    // an explicit second step within the palette itself instead.
    if (rawQuery === '/clear') {
        if (!clearConfirmArmed) {
            clearConfirmArmed = true;
            renderCommandResult(
                'Clear All Browsing History?',
                'This cannot be undone. Press Enter again to confirm.',
                () => performSearch('/clear')
            );
        } else {
            renderCommandResult('Clearing history…', 'Please wait', () => { });
            chrome.history.deleteAll(() => {
                clearConfirmArmed = false;
                performSearch('');
            });
        }
        return;
    }

    // 3. Tab Search Command
    if (rawQuery.startsWith('/tabs')) {
        const tabQuery = rawQuery.replace('/tabs', '').trim();
        showResults(await searchTabs(tabQuery));
        return;
    }

    // 4. Recently Closed Tabs Command
    if (rawQuery.startsWith('/closed')) {
        const closedQuery = rawQuery.replace('/closed', '').trim();
        showResults(await searchRecentlyClosed(closedQuery));
        return;
    }

    // 5. Bookmarks Command
    if (rawQuery.startsWith('/bookmarks')) {
        const bookmarksQuery = rawQuery.replace('/bookmarks', '').trim();
        showResults(await searchBookmarks(bookmarksQuery));
        return;
    }

    // 6. Theme Switcher Command
    if (rawQuery.startsWith('/theme')) {
        const themeName = rawQuery.replace('/theme', '').trim().toLowerCase();

        // If specific theme provided
        if (themeName && (THEMES.includes(themeName) || themeName === 'glass' || themeName === 'default')) {
            const name = themeName === 'default' ? 'glass' : themeName;
            const label = THEME_LABELS[name] || name;
            const title = `Switch to ${label} Theme`;
            const subtitle = `Apply the ${label} style`;
            const action = () => setTheme(name);
            renderCommandResult(title, subtitle, action);
            return;
        }

        // List all themes
        const themesList = ['glass', ...THEMES];
        const results = themesList.map(t => ({
            title: `Theme: ${THEME_LABELS[t] || t}`,
            url: `Apply ${THEME_LABELS[t] || t} theme`,
            action: () => setTheme(t)
        }));

        showResults(results);
        return;
    }

    // 6.5 Keyboard Shortcut Command
    if (rawQuery.startsWith('/shortcut')) {
        renderCommandResult(
            'Change Flashback Shortcut',
            'Opens your browser\'s extension shortcuts page',
            () => {
                chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
                window.close();
            }
        );
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

    showResults(await searchHistory(textQuery, filterDomain));
}

// Renders results and auto-selects the first one, so the highlight always
// matches what pressing Enter will actually activate.
function showResults(results) {
    currentResults = results;
    renderResults(currentResults, resultsList, activateResult, updateSelection);
    selectedIndex = results.length > 0 ? 0 : -1;
    updateSelectionDOM(selectedIndex, resultsList);
}

function renderCommandResult(title, subtitle, action) {
    showResults([{ title, url: subtitle, action }]);
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
