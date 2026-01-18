/** @type {import('tailwindcss').Config} */

// Helper function to create color with optional opacity support
// CSS variables contain space-separated RGB values: "37 99 235"
// We need to use the modern rgb() syntax: rgb(37 99 235 / 0.8)
function withOpacity(variableName) {
    return ({ opacityValue }) => {
        if (opacityValue !== undefined) {
            return `rgb(var(${variableName}) / ${opacityValue})`;
        }
        return `rgb(var(${variableName}))`;
    };
}

export default {
    darkMode: 'class', // Enable class-based dark mode strategy
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // === SEMANTIC COLORS ===
                // Using function syntax for proper opacity modifier support

                // Surfaces
                background: withOpacity('--bg-page'),
                surface: {
                    DEFAULT: withOpacity('--bg-card'),
                    elevated: withOpacity('--bg-elevated'),
                    subtle: withOpacity('--bg-subtle'),
                    // Legacy support
                    dark: 'var(--color-surface-dark)',
                },

                // Text hierarchy
                'text-main': withOpacity('--text-main'),
                'text-muted': withOpacity('--text-muted'),
                'text-subtle': withOpacity('--text-subtle'),

                // Borders
                border: {
                    DEFAULT: withOpacity('--border-default'),
                    subtle: withOpacity('--border-subtle'),
                },

                // Branding
                brand: {
                    DEFAULT: withOpacity('--brand-primary'),
                    light: withOpacity('--brand-primary-light'),
                    dark: withOpacity('--brand-primary-dark'),
                },

                // Status
                success: withOpacity('--status-success'),
                warning: withOpacity('--status-warning'),
                danger: withOpacity('--status-danger'),

                // === LEGACY ALIASES (backward compatibility) ===
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
                text: {
                    DEFAULT: 'var(--color-text)',
                    muted: 'var(--color-text-muted)',
                    subtle: 'var(--color-text-subtle)',
                },
            },
            // IMPORTANT: Override default border color to use theme variable
            borderColor: {
                DEFAULT: 'rgb(var(--border-default))',
            },
            fontFamily: {
                sans: [
                    "Inter",
                    "ui-sans-serif",
                    "system-ui",
                    "-apple-system",
                    "BlinkMacSystemFont",
                    "Segoe UI",
                    "Roboto",
                    "Helvetica Neue",
                    "Arial",
                    "PingFang SC",
                    "Microsoft YaHei",
                    "Hiragino Sans",
                    "Meiryo",
                    "Apple SD Gothic Neo",
                    "Malgun Gothic",
                    "sans-serif"
                ],
                heading: ['var(--font-heading)'],
                body: ['var(--font-body)'],
            },
            keyframes: {
                slideInRight: {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                }
            },
            animation: {
                slideInRight: 'slideInRight 0.3s ease-out forwards',
                fadeIn: 'fadeIn 0.2s ease-out forwards',
            }
        },
    },
    plugins: [],
}
