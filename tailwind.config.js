/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#16324F', deep: '#0E2438' },
        gold: { DEFAULT: '#F2AC1E', deep: '#C98A0E', light: '#FFE8B8' },
        mint: { DEFAULT: '#3FB68B', deep: '#2C8A68' },
        coral: { DEFAULT: '#E2574C', deep: '#B93F36' },
        grape: { DEFAULT: '#7C5CBF', deep: '#5E44A0' },
        paper: '#F5F6F0',
      },
      fontFamily: {
        display: ['"Do Hyeon"', 'sans-serif'],
        body: ['"Noto Sans KR"', 'sans-serif'],
      },
      keyframes: {
        popIn: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        floatUp: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-40px)', opacity: '0' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        coinSpin: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
      },
      animation: {
        popIn: 'popIn 0.35s ease-out',
        floatUp: 'floatUp 1s ease-out forwards',
        shake: 'shake 0.3s ease-in-out',
        coinSpin: 'coinSpin 1.2s linear infinite',
      },
    },
  },
  plugins: [],
};
