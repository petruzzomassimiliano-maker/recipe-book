/** @type {import('tailwindcss').Config} */

/*
 * Palette from the Stitch project "Recipe Book Redesign".
 * `stone` and `teal` are remapped to the Stitch warm neutrals / sage green so the
 * screens that were not redesigned pick up the same look without rewriting them.
 */
const stone = {
  50: '#F5F1EB', // surface-container-low
  100: '#EDE7DF', // surface-container
  200: '#E2D9D2', // outline-variant
  300: '#CDBDB4',
  400: '#8C716B', // outline
  500: '#6E5650',
  600: '#58413C', // on-surface-variant
  700: '#46322D',
  800: '#3B2D2A', // inverse-surface
  900: '#251916', // on-surface
  950: '#1A100E'
}

const sage = {
  50: '#EEF8EF',
  100: '#D5FADB', // secondary-container
  200: '#B5E2BD',
  300: '#8DC49A',
  400: '#68A177',
  500: '#558060',
  600: '#45664E', // secondary
  700: '#3A5742',
  800: '#173722', // on-secondary-container
  900: '#0F2617',
  950: '#08170D'
}

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stone,
        teal: sage,
        primary: {
          DEFAULT: '#A6331B',
          light: '#C84B31',
          dark: '#8A2813',
          container: '#C84B31',
          tint: '#FFEDE9',
          'on-tint': '#3E0500'
        },
        'on-primary': '#FFFFFF',
        secondary: {
          DEFAULT: '#45664E',
          light: '#68A177',
          dark: '#3A5742',
          container: '#D5FADB',
          'on-container': '#173722'
        },
        tertiary: {
          DEFAULT: '#00647D',
          dark: '#004E62',
          container: '#DDF4FF',
          'on-container': '#001F28'
        },
        amber: {
          tint: '#FEF3C7',
          'on-tint': '#451A03'
        },
        surface: {
          DEFAULT: '#FAF8F5',
          dark: '#121212',
          'container-lowest': '#FFFFFF',
          'container-low': '#F5F1EB',
          container: '#EDE7DF',
          'container-high': '#E4DCD2',
          'container-dark': '#1E1E1E'
        },
        'on-surface': {
          DEFAULT: '#251916',
          variant: '#58413C'
        },
        outline: {
          DEFAULT: '#8C716B',
          variant: '#E2D9D2'
        }
      },
      fontFamily: {
        sans: ['Geologica', 'system-ui', 'sans-serif'],
        body: ['Geologica', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        headline: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"Source Code Pro"', 'ui-monospace', 'monospace']
      },
      fontSize: {
        'display-lg': ['40px', { lineHeight: '46px', letterSpacing: '-0.5px', fontWeight: '600' }],
        'display-sm': ['30px', { lineHeight: '36px', letterSpacing: '-0.25px', fontWeight: '600' }],
        'headline-lg': ['28px', { lineHeight: '34px', letterSpacing: '-0.25px', fontWeight: '600' }],
        'headline-md': ['22px', { lineHeight: '28px', fontWeight: '600' }],
        'title-lg': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'title-md': ['16px', { lineHeight: '22px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '21px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.25px', fontWeight: '500' }],
        'mono-md': ['14px', { lineHeight: '20px', fontWeight: '500' }]
      },
      boxShadow: {
        sm: '0 1px 2px rgba(37, 25, 22, 0.04), 0 1px 3px rgba(37, 25, 22, 0.05)',
        md: '0 2px 8px rgba(37, 25, 22, 0.06), 0 1px 2px rgba(37, 25, 22, 0.04)',
        lg: '0 10px 28px rgba(37, 25, 22, 0.10), 0 2px 6px rgba(37, 25, 22, 0.05)'
      },
      transitionDuration: {
        'state-change': '120ms',
        'surface-enter': '220ms'
      },
      animation: {
        'fade-in': 'fadeIn 0.22s cubic-bezier(0.2, 0, 0, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.2, 0, 0, 1)',
        'spin-slow': 'spin 2s linear infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
