/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Muted steel blue used for buttons, links and the timeline.
        accent: {
          50: '#f2f6fb',
          100: '#e3ecf6',
          200: '#c8d9ec',
          300: '#a3c0df',
          400: '#86abd3',
          500: '#6f9bc8',
          600: '#5a86b3',
          700: '#4a7099',
          800: '#3d5c7e',
          900: '#2f4761',
        },
      },
    },
  },
  plugins: [],
};
