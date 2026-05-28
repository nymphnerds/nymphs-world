/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
       colors: {
        border: 'rgb(var(--border))',
        input: 'rgb(var(--input))',
        ring: 'rgb(var(--primary))',
        background: 'rgb(var(--bg))',
        foreground: 'rgb(var(--fg))',
        primary: {
          DEFAULT: 'rgb(var(--primary))',
          foreground: 'rgb(var(--primary-fg))',
        },
        secondary: {
          DEFAULT: 'rgb(var(--muted))',
          foreground: 'rgb(var(--muted-fg))',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted))',
          foreground: 'rgb(var(--muted-fg))',
        },
        accent: {
          DEFAULT: 'rgb(var(--card))',
          foreground: 'rgb(var(--card-fg))',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive))',
          foreground: 'rgb(var(--bg))',
        },
        popover: {
          DEFAULT: 'rgb(var(--card))',
          foreground: 'rgb(var(--card-fg))',
        },
        card: {
          DEFAULT: 'rgb(var(--card))',
          foreground: 'rgb(var(--card-fg))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}