/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'ios-blue': '#007AFF',
        'ios-blue-dark': '#0056B3',
        'ios-indigo': '#5856D6',
        'ios-purple': '#AF52DE',
        'ios-[#FF2D55]': '#FF2D55',
        'ios-teal': '#34C759',
        'ios-green': '#30D158',
        'ios-amber': '#FF9500',
        'ios-red': '#FF3B30',
        'ios-gray': '#8E8E93',
        paper: '#F3EEE3',
        'paper-dark': '#E5DAC6',
        ink: '#4A3F35',
        'ink-soft': '#8B7F6E',
        sage: '#007AFF',
        'sage-deep': '#0056B3',
        gold: '#D9B26F',
        clay: '#C97B5B',
        leaf: '#A8B68A'
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        journal: ['"Lora"', 'Georgia', 'serif'],
        handwriting: ['"Caveat"', 'cursive'],
        georgia: ['Georgia', 'serif'],
        times: ['"Times New Roman"', 'Times', 'serif'],
        calibri: ['"Inter"', 'Calibri', 'sans-serif'],
        arial: ['Arial', 'sans-serif'],
        garamond: ['"EB Garamond"', 'Garamond', 'serif'],
        comic: ['"Comic Neue"', '"Comic Sans MS"', 'cursive'],
        courier: ['"Courier Prime"', '"Courier New"', 'monospace'],
        verdana: ['Verdana', 'sans-serif'],
        trebuchet: ['"Trebuchet MS"', 'sans-serif'],
        impact: ['Impact', 'sans-serif'],
        palatino: ['"Palatino Linotype"', 'Palatino', 'serif'],
        bookman: ['"Bookman Old Style"', 'Bookman', 'serif'],
        body: ['"Work Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      boxShadow: {
        soft: '0 20px 60px -20px rgba(43, 42, 40, 0.25)'
      }
    }
  },
  plugins: []
}
