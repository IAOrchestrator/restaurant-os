import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Outfit', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: {
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
          3: 'hsl(var(--surface-3))',
        },
        glass: {
          DEFAULT: 'hsl(var(--glass))',
          border: 'hsl(var(--glass-border))',
        },
        amber: {
          DEFAULT: 'hsl(var(--amber))',
          hover: 'hsl(var(--amber-hover))',
          muted: 'hsl(var(--amber-muted))',
        },
        emerald: {
          DEFAULT: 'hsl(var(--emerald))',
          muted: 'hsl(var(--emerald-muted))',
        },
        orange: {
          DEFAULT: 'hsl(var(--orange))',
        },
        crimson: {
          DEFAULT: 'hsl(var(--crimson))',
        },
        text: {
          primary: 'hsl(var(--text-primary))',
          secondary: 'hsl(var(--text-secondary))',
          tertiary: 'hsl(var(--text-tertiary))',
        },
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        glass: '0 8px 32px rgba(0,0,0,0.32)',
        glowAmber: '0 0 24px hsla(var(--amber) / 0.3)',
        glowEmerald: '0 0 24px hsla(var(--emerald) / 0.3)',
        glowCrimson: '0 0 24px hsla(var(--crimson) / 0.5)',
      },
      backdropBlur: {
        glass: '24px',
      },
      keyframes: {
        pulseWarning: {
          '0%, 100%': { boxShadow: '0 0 0 0 hsla(var(--orange) / 0.4)' },
          '50%': { boxShadow: '0 0 0 8px hsla(var(--orange) / 0)' },
        },
        pulseDanger: {
          '0%, 100%': { boxShadow: '0 0 20px hsla(var(--crimson) / 0.5)', transform: 'scale(1)' },
          '50%': { boxShadow: '0 0 32px hsla(var(--crimson) / 0.7)', transform: 'scale(1.01)' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'pulse-warning': 'pulseWarning 2s infinite',
        'pulse-danger': 'pulseDanger 0.8s infinite',
        'slide-in': 'slideIn 0.3s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
