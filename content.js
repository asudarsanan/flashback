// Single instance of the overlay
let overlay = null;
let searchInput = null;
let resultsList = null;
let isVisible = false;
let selectedIndex = -1;
let currentResults = [];

function createOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'flashback-overlay';
    overlay.style.display = 'none';

    const container = document.createElement('div');
    container.id = 'flashback-container';

    searchInput = document.createElement('input');
    searchInput.id = 'flashback-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search history...';
    searchInput.autocomplete = 'off';

    resultsList = document.createElement('ul');
    resultsList.id = 'flashback-results';

    container.appendChild(searchInput);
    container.appendChild(resultsList);
    overlay.appendChild(container); // Shadow DOM would be better to isolate styles, but let's stick to simple first

    document.body.appendChild(overlay);

    // Event Listeners
    searchInput.addEventListener('input', debounce((e) => {
        performSearch(e.target.value);
    }, 300));

    searchInput.addEventListener('keydown', handleKeyNavigation);

    // click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            hideOverlay();
        }
    });
}

function toggleOverlay() {
    if (!overlay) createOverlay();

    isVisible = !isVisible;
    overlay.style.display = isVisible ? 'flex' : 'none';

    if (isVisible) {
        searchInput.value = '';
        resultsList.innerHTML = '';
        currentResults = []; // Clear current results
        selectedIndex = -1;
        searchInput.focus();
        performSearch(''); // Show recent history on open
    }
}

function hideOverlay() {
    if (!overlay) return;
    isVisible = false;
    overlay.style.display = 'none';
}

function performSearch(query) {
    chrome.runtime.sendMessage({ action: 'SEARCH_HISTORY', query: query }, (response) => {
        if (response && response.results) {
            currentResults = response.results;
            renderResults(response.results);
        }
    });
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

        // Create UI content
        const title = document.createElement('div');
        title.className = 'flashback-result-title';
        title.textContent = item.title || item.url;

        const url = document.createElement('div');
        url.className = 'flashback-result-url';
        url.textContent = item.url;

        li.appendChild(title);
        li.appendChild(url);

        li.addEventListener('click', () => {
            window.open(item.url, '_blank');
            hideOverlay();
        });

        li.addEventListener('mouseenter', () => {
            updateSelection(index);
        });

        resultsList.appendChild(li);
    });
}

function handleKeyNavigation(e) {
    if (e.key === 'Escape') {
        hideOverlay();
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
            window.open(currentResults[selectedIndex].url, '_blank');
            hideOverlay();
        } else if (currentResults.length > 0) {
            // If nothing selected, open first result? Or do nothing?
            // Standard spotlight behavior implies first result is auto-selected or 'Enter' triggers search action.
            // Let's open first result if nothing is selected but we have results
            window.open(currentResults[0].url, '_blank');
            hideOverlay();
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

// Initial Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TOGGLE_OVERLAY') {
        toggleOverlay();
    }
});
