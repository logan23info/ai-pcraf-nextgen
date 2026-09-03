/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}','./components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#0F1E3C',
        'navy-mid': '#1A2F55',
        'navy-light': '#243D6E',
        accent:  '#2563EB',
      },
      fontFamily: { mono: ['"Courier New"','monospace'] }
    }
  },
  plugins: []
}
