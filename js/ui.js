// Uses the browser's own favicon cache via the "favicon" permission, so no
// network requests are made for icons that aren't already cached locally.
function getFaviconUrl(pageUrl) {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', pageUrl);
    url.searchParams.set('size', '32');
    return url.toString();
}

export function renderResults(results, resultsList, activateCallback, updateSelectionCallback) {
    resultsList.innerHTML = '';

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

        // Command/utility results (theme switcher, calculator, /clear, ...)
        // put a plain sentence in `url`, not an actual page address, so this
        // also naturally excludes them from getting a favicon.
        const isPageResult = typeof item.url === 'string' && /^https?:\/\//.test(item.url);
        if (isPageResult) {
            const favicon = document.createElement('img');
            favicon.className = 'flashback-result-favicon';
            favicon.src = item.favIconUrl || getFaviconUrl(item.url);
            favicon.alt = '';
            favicon.onerror = () => { favicon.style.visibility = 'hidden'; };
            li.appendChild(favicon);
        }

        const title = document.createElement('div');
        title.className = 'flashback-result-title';
        title.textContent = item.title || item.url || 'Untitled';

        const url = document.createElement('div');
        url.className = 'flashback-result-url';

        if (item.action) {
            url.textContent = item.url;
        } else if (item.isTab) {
            url.textContent = `Switch to Tab: ${item.url}`;
            url.style.color = '#4ade80';
        } else {
            url.textContent = item.url;
        }

        li.appendChild(title);
        li.appendChild(url);

        li.addEventListener('click', () => {
            activateCallback(item);
        });

        li.addEventListener('mouseenter', () => {
            updateSelectionCallback(index);
        });

        resultsList.appendChild(li);
    });
}

export function updateSelectionDOM(index, resultsList) {
    // Clear previous
    const previous = resultsList.querySelector('.selected');
    if (previous) {
        previous.classList.remove('selected');
    }

    if (index !== -1) {
        const curr = resultsList.children[index];
        if (curr) {
            curr.classList.add('selected');
            curr.scrollIntoView({ block: 'nearest' });
        }
    }
}
