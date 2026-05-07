/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'deped-blue': '#0038A8',
        'deped-red': '#CE1126',
        'deped-gold': '#FCD116',
      }
    },
  },
  plugins: [],
};
