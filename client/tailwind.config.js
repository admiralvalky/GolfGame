/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        golf: {
          green: '#2d6a4f',
          light: '#52b788',
          dark: '#1b4332',
          fairway: '#40916c',
          gold: '#d97706',
        },
      },
    },
  },
  plugins: [],
};
