/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Material Design 3 — Recipe Book palette
        primary: {
          DEFAULT: '#FF6B6B',
          light: '#FF8A80',
          dark: '#E53935'
        },
        secondary: {
          DEFAULT: '#4ECDC4',
          light: '#80DEEA',
          dark: '#26A69A'
        },
        tertiary: {
          DEFAULT: '#FFD93D',
          dark: '#F9A825'
        },
        surface: {
          DEFAULT: '#FAFAFA',
          dark: '#121212',
          container: '#F3F3F3',
          'container-dark': '#1E1E1E'
        }
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        lora: ['Lora', 'serif'],
        opensans: ['Open Sans', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
