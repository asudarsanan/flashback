chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-search') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                // Send a message to the active tab to toggle the overlay
                chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_OVERLAY' }).catch(err => {
                    // Content script might not be loaded yet on some pages (e.g. strict CSP or restricted URLs)
                    console.log("Could not send message to tab:", err);
                });
            }
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SEARCH_HISTORY') {
        // Search history for the query
        chrome.history.search({
            text: request.query,
            maxResults: 20,
            startTime: 0 // Search all time
        }, (results) => {
            sendResponse({ results: results });
        });
        return true; // Indicates we wish to send a response asynchronously
    }
});
