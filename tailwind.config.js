/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1B1D1F',           // графит (по-меко от черно)
        graphite: '#2A2D30',
        paper: '#FFFFFF',          // чисто бяло
        soft: '#F5F6F7',           // леко сиво за секции
        cloud: '#ECEEF0',          // по-плътно сиво
        cream: '#F5F6F7',          // alias за стара употреба
        line: '#E3E5E8',
        muted: '#6B7075',
        accent: '#B8825A',         // топъл бронз/охра (запазен акцент)
        accentDeep: '#8C5E3C',
        accentSoft: '#EFE3D5'      // много меко за подложки
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
