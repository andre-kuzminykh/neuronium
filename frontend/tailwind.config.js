/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'ide-bg': '#1e1e1e',
        'ide-sidebar': '#252526',
        'ide-panel': '#1e1e1e',
        'ide-tab': '#2d2d2d',
        'ide-tab-active': '#1e1e1e',
        'ide-border': '#3e3e3e',
        'ide-text': '#cccccc',
        'ide-text-dim': '#858585',
        'ide-accent': '#007acc',
        'ide-hover': '#2a2d2e',
        'ide-success': '#4ec9b0',
        'ide-warning': '#dcdcaa',
        'ide-error': '#f44747',
      },
    },
  },
  plugins: [],
}
