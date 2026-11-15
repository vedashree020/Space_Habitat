/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#04070d',
          900: '#070d18',
          850: '#0a1320',
          800: '#0e1a2e',
          700: '#15243f',
          600: '#1d3358',
          500: '#2a4778',
        },
        cyan: {
          glow: '#22d3ee',
        },
        status: {
          danger: '#ef4444',
          warn: '#f59e0b',
          ok: '#22c55e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'score-pop': 'scorePop 0.5s ease-out',
        'flash': 'flash 0.4s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 4px currentColor)' },
          '50%': { opacity: '0.6', filter: 'drop-shadow(0 0 12px currentColor)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scorePop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        flash: {
          '0%': { backgroundColor: 'rgba(34, 211, 238, 0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
};
