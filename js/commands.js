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
