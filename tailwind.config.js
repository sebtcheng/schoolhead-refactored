import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./apps/**/*.{js,ts,jsx,tsx,html}",
    "./packages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deped-blue': '#10346B',
        'deped-blue-dk': '#002580',
        'deped-red': '#CE1126',
        'deped-gold': '#FCD116',
        'siif-blue': '#0e83bd',
        'siif-gray': '#b3b3b3',
        'siif-yellow': '#ffd93b',
        'surface': '#fafbff',
        navy: 'var(--navy)',
        // SIIF theme tokens are merged INTO Tailwind's default palettes (not replacing
        // them) so `bg-amber`, `text-blue-600` etc. keep the theme vars while the other
        // shades (`bg-amber-500`, `text-red-600`, `bg-green-50`...) still exist.
        blue: {
          ...colors.blue,
          DEFAULT: 'var(--blue)',
          600: 'var(--blue-600)',
          400: 'var(--blue-400)',
          100: 'var(--blue-100)',
          50: 'var(--blue-50)',
        },
        gold: 'var(--gold)',
        amber: { ...colors.amber, DEFAULT: 'var(--amber)' },
        red: { ...colors.red, DEFAULT: 'var(--red)' },
        green: { ...colors.green, DEFAULT: 'var(--green)' },
        purple: { ...colors.purple, DEFAULT: 'var(--purple)' },
        card: 'var(--card)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        line: 'var(--line)',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      borderRadius: {
        'siif': 'var(--radius)',
      },
      animation: {
        'blob': 'blob 7s infinite',
        'gradient-xy': 'gradient-xy 15s ease infinite',
        'pop-up': 'pop-up 0.5s ease-out forwards',
        'shimmer': 'shimmer 2s infinite',
        'pulse-subtle': 'pulse-subtle 3s ease-in-out infinite',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        'gradient-xy': {
          '0%, 100%': { 'background-size': '400% 400%', 'background-position': '0% 0%' },
          '50%': { 'background-size': '200% 200%', 'background-position': '100% 100%' },
        },
        'pop-up': {
          '0%': { transform: 'translateY(20px) scale(0.9)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-subtle': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.01)', opacity: '0.95' },
        },
      },
    },
  },
  plugins: [],
}