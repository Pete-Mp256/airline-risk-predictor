/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  // Dark mode follows the `dark` class on <html>, set by ThemeProvider (and an inline script in index.html).
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        // A plane crossing the screen on a gentle arc; see FlyingPlane.js.
        fly: {
          '0%': { transform: 'translate(-30vw, 30px) rotate(6deg)' },
          '50%': { transform: 'translate(50vw, -25px) rotate(-1deg)' },
          '100%': { transform: 'translate(130vw, 5px) rotate(-5deg)' },
        },
      },
      animation: {
        fly: 'fly var(--fly-duration, 16s) linear infinite',
      },
      // shadcn/ui radius scale, driven by --radius in index.css.
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        // shadcn/ui semantic tokens (values in index.css). primary is the Kenya Airways crimson.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Brand crimson (Kenya Airways-inspired) for buttons, links, focus rings and the livery stripe.
        // Kept separate from the risk colours below so brand red never reads as "High risk".
        // DEFAULT/foreground are the shadcn "accent" (neutral hover) token; the numbered shades are the brand scale.
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
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
  plugins: [require('tailwindcss-animate')],
};
