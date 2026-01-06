/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'var(--color-primary)',
                    light: 'var(--color-primary-light)',
                    dark: 'var(--color-primary-dark)',
                },
                accent: {
                    DEFAULT: 'var(--color-accent)',
                    hover: 'var(--color-accent-hover)',
                    light: 'var(--color-accent-light)',
                },
                surface: {
                    DEFAULT: 'var(--color-surface)',
                    elevated: 'var(--color-surface-elevated)',
                    subtle: 'var(--color-surface-subtle)',
                    dark: 'var(--color-surface-dark)',
                },
                background: 'var(--color-background)',
                border: {
                    DEFAULT: 'var(--color-border)',
                    subtle: 'var(--color-border-subtle)',
                },
                text: {
                    DEFAULT: 'var(--color-text)',
                    muted: 'var(--color-text-muted)',
                    subtle: 'var(--color-text-subtle)',
                },
            },
            fontFamily: {
                heading: ['var(--font-heading)'],
                body: ['var(--font-body)'],
            },
        },
    },
    plugins: [],
}
