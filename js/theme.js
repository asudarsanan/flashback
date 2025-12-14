export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'retro') {
        document.body.classList.add('theme-retro');
    }
}

export function setTheme(theme) {
    if (theme === 'retro') {
        document.body.classList.add('theme-retro');
        localStorage.setItem('theme', 'retro');
    } else {
        document.body.classList.remove('theme-retro');
        localStorage.setItem('theme', 'glass');
    }
}
