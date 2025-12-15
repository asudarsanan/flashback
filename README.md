# Flashback

**Flashback** is a premium, Spotlight-like search extension for your browser history. It replaces the clunky default history page with a lightning-fast, liquid-glass command palette.

![Flashback Icon](icons/readme_logo.png)

## Features

### 🎨 Liquid Glass UI
- **Premium Aesthetic**: Designed to match macOS Big Sur/Monterey with deep blurs, saturation, and multi-layered shadows.
- **Adaptive Theme**: "Liquid" material feel that blurs the content behind it.
- **Spotlight Design**: Pixel-perfect replication of the Apple Spotlight search bar.

### ⚡ Smart Search
- **Fuzzy Matching**: Finds what you need even if you make typos (e.g., "githbu" -> "GitHub").
- **Smart Filters**:
  - `prefix: query` (e.g., `google: styling`) to filter results by domain.
- **Switch-to-Tab**: If you select a result that is already open in another tab, Flashback jumps to it instantly instead of creating a duplicate.

### 🚀 Quick Commands
Flashback isn't just for history. Use special prefixes for utility actions:
- **Calculator**: Type `=` followed by math (e.g., `= 128 * 4`) to see the result instantly.
- **Tab Search**: Type `/tabs <query>` to search *only* your currently open tabs.
- **Closed Tabs**: Type `/closed` to see and restore recently closed tabs.
- **Bookmarks**: Type `/bookmarks <query>` to search your bookmarks.
- **Themes**: Type `/theme` to switch between `glass` and `retro` themes.
- **Clear History**: Type `/clear` to wipe your browsing history.
- **Help**: Type `/` or `/help` to see this list of commands.

## Installation

1. Clone this repository.
2. Open Chrome/Edge/Brave and navigate to `chrome://extensions`.
3. Enable **Developer Mode** (top right).
4. Click **Load unpacked**.
5. Select the `flashback` directory.

## Creating Themes

Flashback uses a modular theming system based on CSS Variables. You can easily add your own theme:

1.  Open `css/variables.css`.
2.  Define a new CSS class for your theme (e.g., `body.theme-ocean`).
3.  Override the variables you want to change.
    ```css
    body.theme-ocean {
        --bg-overlay: rgba(0, 105, 148, 0.8);
        --input-color: #ffffff;
        /* ... override other variables */
    }
    ```
4.  Open `js/theme.js` and add your theme key to the switch logic (or just use the class name if you refactor `setTheme`).
5.  Open `js/commands.js` and add a new `/theme ocean` command alias if desired.

## Usage

- **Open**: Press `Ctrl+Shift+K` (or `Command+Shift+K` on Mac) to toggle Flashback.
- **Navigate**: Use `Up/Down` arrows to select results.
- **Open**: Press `Enter` to open the selected result (or switch to its tab).
