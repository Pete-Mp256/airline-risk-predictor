/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand crimson (Kenya Airways-inspired) for buttons, links, focus rings and the livery stripe.
        // Kept separate from the risk colours below so brand red never reads as "High risk".
        accent: {
          50: '#fdf2f3',
          100: '#fbe3e6',
          200: '#f6c5cc',
          300: '#ee98a4',
          400: '#e25e70',
          500: '#d4263f',
          600: '#c8102e',
          700: '#a50d26',
          800: '#870c22',
          900: '#6f0d20',
        },
        ink: '#1f2328',
        // Risk levels: green / amber / vermilion-orange. High is the only filled badge.
        risk: {
          low: '#2f9e77',
          'low-tint': '#e8f5ef',
          'low-ink': '#1d6b50',
          medium: '#e8a200',
          'medium-tint': '#fdf4dc',
          'medium-ink': '#8a5a00',
          high: '#d9480f',
          'high-tint': '#fdece4',
          'high-ink': '#9c3008',
        },
      },
    },
  },
  plugins: [],
};
