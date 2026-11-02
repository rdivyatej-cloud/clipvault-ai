/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#0A0B10',
          surface: '#12151E',
          surfaceHover: '#181B26',
          border: '#1F2433',
          borderLight: '#2C3246',
          muted: '#8B95A5',
          silver: '#E2E8F0',
          silverLight: '#F8FAFC',
          red: '#EF4444',
          redHover: '#DC2626',
          redDark: '#991B1B',
          redGlow: 'rgba(239, 68, 68, 0.25)',
          gold: '#F59E0B',
          green: '#10B981',
          blue: '#3B82F6',
          purple: '#8B5CF6'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Cabinet Grotesk', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glow-red': '0 0 25px -5px rgba(239, 68, 68, 0.35)',
        'glow-red-lg': '0 0 45px -5px rgba(239, 68, 68, 0.5)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}

