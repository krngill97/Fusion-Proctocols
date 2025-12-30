/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Sharp dark theme - maximum contrast
        dark: {
          50: '#f8fafc',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
          800: '#111827',
          900: '#0d1117',
          950: '#010409',
        },
        // Primary - Electric blue
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Accent colors - vibrant
        accent: {
          purple: '#a855f7',
          pink: '#ec4899',
          cyan: '#06b6d4',
          emerald: '#10b981',
          orange: '#f97316',
          yellow: '#eab308',
        },
        // Status colors
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#0ea5e9',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        'xs': ['0.6875rem', { lineHeight: '1rem' }],
        'sm': ['0.75rem', { lineHeight: '1rem' }],
        'base': ['0.8125rem', { lineHeight: '1.25rem' }],
        'lg': ['0.875rem', { lineHeight: '1.25rem' }],
        'xl': ['1rem', { lineHeight: '1.5rem' }],
        '2xl': ['1.125rem', { lineHeight: '1.75rem' }],
        '3xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '4xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
      },
      borderRadius: {
        'none': '0',
        'sm': '2px',
        'DEFAULT': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(0, 0, 0, 0.5)',
        'sm': '0 1px 3px rgba(0, 0, 0, 0.4)',
        'DEFAULT': '0 2px 4px rgba(0, 0, 0, 0.4)',
        'md': '0 4px 8px rgba(0, 0, 0, 0.4)',
        'lg': '0 8px 16px rgba(0, 0, 0, 0.4)',
        'inner': 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
        'glow-blue': '0 0 12px rgba(59, 130, 246, 0.4)',
        'glow-green': '0 0 12px rgba(16, 185, 129, 0.4)',
        'glow-red': '0 0 12px rgba(239, 68, 68, 0.4)',
        'glow-purple': '0 0 12px rgba(168, 85, 247, 0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.1s ease-out',
        'slide-up': 'slideUp 0.1s ease-out',
        'pulse-fast': 'pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
