/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        control: '#7c8a9c',
        forest: '#245b48',
        paper: '#f7f7f2',
        sun: '#f4c95d',
      },
      boxShadow: { soft: '0 8px 28px rgba(31, 41, 51, 0.07)' },
    },
  },
  plugins: [],
};
