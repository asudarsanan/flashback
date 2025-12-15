export function handleCalculator(expression) {
    try {
        if (!/^[0-9+\-*/().\s]*$/.test(expression)) {
            throw new Error('Invalid characters');
        }

        const result = new Function('return ' + expression)();

        if (result === undefined || isNaN(result)) throw new Error('NaN');

        return {
            title: 'Calculation',
            url: `Result: ${result}`,
            action: () => {
                navigator.clipboard.writeText(result.toString());
                window.close();
            }
        };
    } catch (e) {
        return {
            title: 'Calculator',
            url: 'Type a math expression (e.g. = 5 * 10)',
            action: () => { }
        };
    }
}


export function getHelpCommands(setThemeCallback) {
    return [
        {
            title: '/closed',
            url: 'List and search recently closed tabs',
            action: () => {
                const input = document.getElementById('flashback-input');
                if (input) {
                    input.value = '/closed ';
                    input.dispatchEvent(new Event('input'));
                }
            }
        },
        {
            title: '/bookmarks',
            url: 'Search within your bookmarks',
            action: () => {
                const input = document.getElementById('flashback-input');
                if (input) {
                    input.value = '/bookmarks ';
                    input.dispatchEvent(new Event('input'));
                }
            }
        },
        {
            title: '/tabs',
            url: 'Search open tabs only',
            action: () => {
                const input = document.getElementById('flashback-input');
                if (input) {
                    input.value = '/tabs ';
                    input.dispatchEvent(new Event('input'));
                }
            }
        },
        {
            title: '/theme',
            url: 'Change theme (glass, retro, catppuccin, dracula, alienblood)',
            action: () => {
                const input = document.getElementById('flashback-input');
                if (input) {
                    input.value = '/theme ';
                    input.dispatchEvent(new Event('input'));
                }
            }
        },
        {
            title: '/clear',
            url: 'Clear all browsing history',
            action: () => {
                const input = document.getElementById('flashback-input');
                if (input) {
                    input.value = '/clear ';
                    input.dispatchEvent(new Event('input'));
                }
            }
        },
        {
            title: 'Calculator (=)',
            url: 'Type = followed by an expression (e.g. = 5+5)',
            action: () => {
                const input = document.getElementById('flashback-input');
                if (input) {
                    input.value = '= ';
                    input.dispatchEvent(new Event('input'));
                }
            }
        }
    ];
}
