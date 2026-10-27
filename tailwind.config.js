/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        jade: {
          deep: '#1a3a2a',
          dark: '#12281d',
          mid: '#245038',
          light: '#2f6647',
        },
        gold: {
          DEFAULT: '#c9a84c',
          light: '#e0c878',
          dark: '#9c7f30',
        },
        cream: '#f5f0e0',
        tilebg: '#f5f0e0',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0.7)' },
          '50%': { boxShadow: '0 0 18px 4px rgba(201,168,76,0.9)' },
        },
        pop: {
          '0%': { transform: 'scale(0.85)' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        pulseGold: 'pulseGold 1.4s ease-in-out infinite',
        pop: 'pop 0.18s ease-out',
        slideUp: 'slideUp 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
