export const THEMES = ['retro', 'catppuccin', 'dracula', 'alienblood'];

export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && THEMES.includes(savedTheme)) {
        document.body.classList.add(`theme-${savedTheme}`);
    }
}

export function setTheme(theme) {
    // Remove all existing theme classes
    THEMES.forEach(t => document.body.classList.remove(`theme-${t}`));

    if (THEMES.includes(theme)) {
        document.body.classList.add(`theme-${theme}`);
        localStorage.setItem('theme', theme);
    } else {
        // Default (glass)
        localStorage.setItem('theme', 'glass');
    }
}
