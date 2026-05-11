/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0D2340',            // deep navy за доверие и стабилност
        graphite: '#163250',
        paper: '#F8FBFF',
        soft: '#EEF4FA',
        cloud: '#E1EAF2',
        cream: '#EEF4FA',
        line: '#D2DEE9',
        muted: '#61758F',
        accent: '#2C6FE8',         // trust blue
        accentDeep: '#163EA2',
        accentSoft: '#E5EEFF',
        trustGreen: '#2F8F74',
        trustPurple: '#6657B7'
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      maxWidth: {
        page: '88rem'
      }
    }
  },
  plugins: []
}
